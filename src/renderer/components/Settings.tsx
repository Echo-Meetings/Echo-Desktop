import { useState, useEffect } from 'react'
import { useAppStore } from '@/stores/appStore'
import { SUPPORTED_LANGUAGES } from '@/types/models'
import { useT, fmt } from '@/i18n'
import { UI_LANGUAGES } from '@/i18n/translations'
import { ComboBox } from './ComboBox'
import { Button } from './Button'

interface DiagnosticResult {
  ok: boolean
  whisperInstalled: boolean
  whisperBinaryValid: boolean
  ffmpegInstalled: boolean
  vcRuntimeInstalled: boolean
  missingDlls: string[]
  arch: string
  platform: string
  whisperPath: string | null
  ffmpegPath: string | null
  whisperVersion: string
}

interface SettingsProps {
  onClose: () => void
}

export function Settings({ onClose }: SettingsProps) {
  const t = useT()
  const { languageOverride, setLanguageOverride, setHasCompletedOnboarding, uiLanguage, setUiLanguage } = useAppStore()
  const [storageDir, setStorageDir] = useState('')
  const [storageSize, setStorageSize] = useState(0)
  const [privacyConsent, setPrivacyConsent] = useState(false)
  const [modelInfo, setModelInfo] = useState<{ size: number; path: string } | null>(null)
  const [modelDeleting, setModelDeleting] = useState(false)
  const [appVersion, setAppVersion] = useState('')
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'latest' | 'error'>('idle')
  const [updateInfo, setUpdateInfo] = useState<{ latestVersion?: string; releaseUrl?: string }>({})
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult | null>(null)
  const [reinstalling, setReinstalling] = useState(false)
  const [availableModels, setAvailableModels] = useState<Array<{
    id: string; filename: string; sizeBytes: number; ramRequiredMB: number
    labelKey: string; accuracy: string; speedMultiplier: number; multilingual: boolean
  }>>([])
  const [downloadedModels, setDownloadedModels] = useState<Record<string, boolean>>({})
  const [activeModelId, setActiveModelId] = useState('large-v3-turbo')
  const [downloadingModelId, setDownloadingModelId] = useState<string | null>(null)
  const [hardwareInfo, setHardwareInfo] = useState<{
    cpuCores: number; totalMemoryMB: number; optimalThreads: number
  } | null>(null)

  useEffect(() => {
    window.electronAPI.update.getVersion().then(setAppVersion)
  }, [])

  const handleCheckUpdate = async () => {
    setUpdateStatus('checking')
    const result = await window.electronAPI.update.check()
    if (result.error) {
      setUpdateStatus('error')
    } else if (result.hasUpdate) {
      setUpdateStatus('available')
      setUpdateInfo({ latestVersion: result.latestVersion, releaseUrl: result.releaseUrl })
    } else {
      setUpdateStatus('latest')
    }
  }

  useEffect(() => {
    window.electronAPI.settings.getStorageDirectory().then(setStorageDir)
    window.electronAPI.settings.getStorageSize().then(setStorageSize)
    window.electronAPI.settings.get('privacyConsent').then((v) => setPrivacyConsent(!!v))
    window.electronAPI.model.getSize().then(setModelInfo)
    window.electronAPI.deps.diagnose().then(setDiagnostics)
    window.electronAPI.model.getAvailableModels().then(setAvailableModels)
    window.electronAPI.model.getDownloadedModels().then(setDownloadedModels)
    window.electronAPI.model.getActiveModelId().then(setActiveModelId)
    window.electronAPI.hardware.getInfo().then(setHardwareInfo)
  }, [])

  const handleLanguageChange = async (code: string) => {
    setLanguageOverride(code)
    await window.electronAPI.settings.set('languageOverride', code)
  }

  const handleRevealStorage = () => {
    window.electronAPI.settings.revealStorage()
  }

  const handleChangeStorage = async () => {
    const path = await window.electronAPI.settings.openDirectoryPicker()
    if (path) {
      await window.electronAPI.settings.setStorageDirectory(path)
      setStorageDir(path)
    }
  }

  const handleShowOnboarding = async () => {
    await window.electronAPI.settings.set('hasCompletedOnboarding', false)
    setHasCompletedOnboarding(false)
    onClose()
  }

  const handleDeleteModel = async () => {
    if (!confirm(t.deleteModelConfirm)) return
    setModelDeleting(true)
    await window.electronAPI.model.delete()
    useAppStore.getState().setModelReady(false)
    setModelDeleting(false)
    onClose()
  }

  const handleSelectModel = async (modelId: string) => {
    if (!downloadedModels[modelId]) {
      // Download first
      setDownloadingModelId(modelId)
      await window.electronAPI.model.downloadById(modelId)
      setDownloadingModelId(null)
      const updated = await window.electronAPI.model.getDownloadedModels()
      setDownloadedModels(updated)
    }
    setActiveModelId(modelId)
    await window.electronAPI.model.setActiveModelId(modelId)
    await window.electronAPI.settings.set('activeModel', modelId)
  }

  const handleDeleteSpecificModel = async (modelId: string) => {
    if (!confirm(t.modelDeleteConfirm)) return
    await window.electronAPI.model.delete(modelId)
    const updated = await window.electronAPI.model.getDownloadedModels()
    setDownloadedModels(updated)
    // If the active model was deleted, switch to a downloaded one
    if (modelId === activeModelId) {
      const fallback = availableModels.find((m) => updated[m.id] && m.id !== modelId)
      if (fallback) {
        setActiveModelId(fallback.id)
        await window.electronAPI.model.setActiveModelId(fallback.id)
        await window.electronAPI.settings.set('activeModel', fallback.id)
      }
    }
  }

  const accuracyLabel = (acc: string): string => {
    const map: Record<string, string> = {
      'low': t.modelAccuracyLow,
      'medium-low': t.modelAccuracyMediumLow,
      'medium': t.modelAccuracyMedium,
      'high': t.modelAccuracyHigh,
      'very-high': t.modelAccuracyVeryHigh
    }
    return map[acc] || acc
  }

  const handleReinstallWhisper = async () => {
    if (!confirm(t.diagnosticsReinstallConfirm)) return
    setReinstalling(true)
    await window.electronAPI.deps.deleteWhisper()
    await window.electronAPI.deps.downloadWhisper()
    const diag = await window.electronAPI.deps.diagnose()
    setDiagnostics(diag)
    setReinstalling(false)
  }

  const handleViewPrivacy = () => {
    window.electronAPI.settings.showPrivacyPolicy(uiLanguage)
  }

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.window} onClick={(e) => e.stopPropagation()}>
        {/* Title bar */}
        <div style={styles.titleBar}>
          <button onClick={onClose} style={styles.closeButton} />
          <span style={styles.titleText}>{t.settingsTitle}</span>
        </div>

        <div style={styles.content}>
          {/* Section: Interface */}
          <div style={styles.sectionHeader}>{t.interfaceSection}</div>
          <div style={styles.card}>
            <div style={styles.cardRow}>
              <div>
                <div style={styles.rowLabel}>{t.language}</div>
                <div style={styles.rowDesc}>{t.interfaceLanguageDesc}</div>
              </div>
              <ComboBox
                options={UI_LANGUAGES.map(l => ({ value: l.code, label: l.label }))}
                value={uiLanguage}
                onChange={(code) => {
                  setUiLanguage(code as any)
                  window.electronAPI.settings.set('uiLanguage', code)
                }}
                style={{ minWidth: 140 }}
              />
            </div>
          </div>

          {/* Section: Transcription */}
          <div style={styles.sectionHeader}>{t.transcriptionSection}</div>
          <div style={styles.card}>
            <div style={styles.cardRow}>
              <div>
                <div style={styles.rowLabel}>{t.language}</div>
                <div style={styles.rowDesc}>
                  {t.transcriptionLanguageDesc}
                </div>
              </div>
              <ComboBox
                options={SUPPORTED_LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
                value={languageOverride}
                onChange={handleLanguageChange}
                style={{ minWidth: 160 }}
              />
            </div>
          </div>

          {/* Section: Storage */}
          <div style={styles.sectionHeader}>{t.storageSection}</div>
          <div style={styles.card}>
            <div style={styles.cardRow}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={styles.rowLabel}>{t.transcriptsAndMedia}</div>
                <div style={styles.storagePath}>{storageDir}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, padding: '4px 0' }}>
              <Button size="small" onClick={handleRevealStorage}>{t.revealInFinder}</Button>
              <Button size="small" onClick={handleChangeStorage}>{t.change}</Button>
            </div>
            <div style={styles.cardDivider} />
            <div style={styles.cardRow}>
              <div style={styles.rowLabel}>{t.storageUsed}</div>
              <div style={styles.rowValue}>{formatSize(storageSize)}</div>
            </div>
          </div>

          {/* Section: AI Model */}
          <div style={styles.sectionHeader}>{t.modelPickerSection}</div>
          <div style={styles.card}>
            <div style={styles.rowDesc}>{t.modelPickerDesc}</div>
            <div style={styles.cardDivider} />
            {availableModels.map((model, idx) => {
              const isActive = model.id === activeModelId
              const isDownloaded = downloadedModels[model.id]
              const isDownloading = downloadingModelId === model.id
              const modelLabel = (t as Record<string, string>)[model.labelKey] || model.id
              return (
                <div key={model.id}>
                  {idx > 0 && <div style={styles.cardDivider} />}
                  <div style={{
                    ...styles.cardRow,
                    padding: '8px 0',
                    cursor: isDownloading ? 'wait' : 'pointer',
                    opacity: isDownloading ? 0.6 : 1
                  }}
                    onClick={() => !isDownloading && handleSelectModel(model.id)}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 14,
                          height: 14,
                          borderRadius: '50%',
                          border: isActive ? 'none' : '2px solid var(--color-border)',
                          backgroundColor: isActive ? 'var(--color-foreground)' : 'transparent',
                          flexShrink: 0
                        }} />
                        <span style={{ fontSize: 'var(--font-body)', fontWeight: isActive ? 600 : 400 }}>
                          {modelLabel}
                        </span>
                        {!model.multilingual && (
                          <span style={{ fontSize: 11, color: 'var(--color-secondary)', backgroundColor: 'var(--color-highlight)', padding: '1px 6px', borderRadius: 4 }}>EN</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 12, marginTop: 2, paddingLeft: 22, fontSize: 12, color: 'var(--color-secondary)' }}>
                        <span>{formatSize(model.sizeBytes)}</span>
                        <span>{accuracyLabel(model.accuracy)}</span>
                        <span>{model.speedMultiplier}x {t.modelSpeedLabel.toLowerCase()}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      {isDownloading ? (
                        <span style={{ fontSize: 12, color: 'var(--color-secondary)' }}>{t.modelDownloading}</span>
                      ) : isDownloaded ? (
                        <>
                          <span style={{ fontSize: 12, color: '#22c55e' }}>{t.modelDownloaded}</span>
                          {!isActive && (
                            <Button size="small" variant="destructive" onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteSpecificModel(model.id)
                            }}>
                              {t.delete}
                            </Button>
                          )}
                        </>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--color-secondary)' }}>{t.modelNotDownloaded}</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Section: Hardware */}
          {hardwareInfo && (
            <>
              <div style={styles.sectionHeader}>{t.hardwareSection}</div>
              <div style={styles.card}>
                <div style={styles.cardRow}>
                  <div style={styles.rowLabel}>{t.cpuCores}</div>
                  <div style={styles.rowValue}>{hardwareInfo.cpuCores}</div>
                </div>
                <div style={styles.cardDivider} />
                <div style={styles.cardRow}>
                  <div style={styles.rowLabel}>{t.totalMemory}</div>
                  <div style={styles.rowValue}>{formatSize(hardwareInfo.totalMemoryMB * 1024 * 1024)}</div>
                </div>
                <div style={styles.cardDivider} />
                <div style={styles.cardRow}>
                  <div style={styles.rowLabel}>{t.threadsUsed}</div>
                  <div style={styles.rowValue}>{hardwareInfo.optimalThreads}</div>
                </div>
              </div>
            </>
          )}

          {/* Section: System Diagnostics */}
          <div style={styles.sectionHeader}>{t.diagnosticsSection}</div>
          <div style={styles.card}>
            {/* whisper-cli */}
            <div style={styles.cardRow}>
              <div style={styles.rowLabel}>{t.diagnosticsWhisper}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontSize: 13,
                  color: diagnostics?.whisperInstalled ? '#22c55e' : '#ef4444',
                }}>
                  {diagnostics?.whisperInstalled ? t.diagnosticsInstalled : t.diagnosticsNotFound}
                </span>
                {diagnostics?.platform === 'win32' && (
                  <Button size="small" onClick={handleReinstallWhisper} disabled={reinstalling}>
                    {reinstalling ? t.diagnosticsReinstalling : t.diagnosticsReinstall}
                  </Button>
                )}
              </div>
            </div>
            <div style={styles.cardDivider} />

            {/* ffmpeg */}
            <div style={styles.cardRow}>
              <div style={styles.rowLabel}>{t.diagnosticsFfmpeg}</div>
              <span style={{
                fontSize: 13,
                color: diagnostics?.ffmpegInstalled ? '#22c55e' : '#ef4444',
              }}>
                {diagnostics?.ffmpegInstalled ? t.diagnosticsInstalled : t.diagnosticsNotFound}
              </span>
            </div>

            {/* Windows-only diagnostics */}
            {diagnostics?.platform === 'win32' && (
              <>
                <div style={styles.cardDivider} />
                {/* VC++ Runtime */}
                <div style={styles.cardRow}>
                  <div style={styles.rowLabel}>{t.diagnosticsVcRuntime}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontSize: 13,
                      color: diagnostics.vcRuntimeInstalled ? '#22c55e' : '#ef4444',
                    }}>
                      {diagnostics.vcRuntimeInstalled ? t.diagnosticsInstalled : t.diagnosticsNotFound}
                    </span>
                    {!diagnostics.vcRuntimeInstalled && (
                      <Button size="small" onClick={() => {
                        window.electronAPI.update.openRelease('https://aka.ms/vs/17/release/vc_redist.x64.exe')
                      }}>
                        {t.diagnosticsDownloadVcRuntime} ↗
                      </Button>
                    )}
                  </div>
                </div>
                <div style={styles.cardDivider} />

                {/* DLLs */}
                <div style={styles.cardRow}>
                  <div style={styles.rowLabel}>{t.diagnosticsDlls}</div>
                  <span style={{
                    fontSize: 13,
                    color: diagnostics.missingDlls.length === 0 ? '#22c55e' : '#ef4444',
                  }}>
                    {diagnostics.missingDlls.length === 0
                      ? t.diagnosticsAllPresent
                      : fmt(t.diagnosticsMissing, { dlls: diagnostics.missingDlls.join(', ') })}
                  </span>
                </div>
              </>
            )}

            <div style={styles.cardDivider} />
            {/* Architecture */}
            <div style={styles.cardRow}>
              <div style={styles.rowLabel}>{t.diagnosticsArchitecture}</div>
              <div style={styles.rowValue}>{diagnostics?.arch || '—'}</div>
            </div>
            <div style={styles.cardDivider} />
            {/* Whisper version */}
            <div style={styles.cardRow}>
              <div style={styles.rowLabel}>{t.diagnosticsWhisperVersion}</div>
              <div style={styles.rowValue}>{diagnostics?.whisperVersion || '—'}</div>
            </div>
          </div>

          {/* Section: Privacy & Legal */}
          <div style={styles.sectionHeader}>{t.privacySection}</div>
          <div style={styles.card}>
            <div style={styles.rowDesc}>
              {t.privacyDesc}
            </div>
            <div style={styles.cardDivider} />
            <div style={styles.cardRow}>
              <div style={styles.rowLabel}>{t.privacyConsent}</div>
              <div style={{
                ...styles.rowValue,
                color: privacyConsent ? '#22c55e' : 'var(--color-secondary)',
              }}>
                {privacyConsent ? t.accepted : t.notAccepted}
              </div>
            </div>
            <div style={styles.cardDivider} />
            <div style={{ padding: '4px 0' }}>
              <Button size="small" onClick={handleViewPrivacy}>{t.viewPrivacyPolicy}</Button>
            </div>
          </div>

          {/* Section: About */}
          <div style={styles.sectionHeader}>{t.aboutSection}</div>
          <div style={styles.card}>
            <div style={styles.cardRow}>
              <div style={styles.rowLabel}>{t.version}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={styles.rowValue}>{appVersion}</div>
                {updateStatus === 'idle' && (
                  <Button size="small" onClick={handleCheckUpdate}>{t.checkForUpdates}</Button>
                )}
                {updateStatus === 'checking' && (
                  <span style={{ fontSize: 12, color: 'var(--color-secondary)' }}>{t.checking}</span>
                )}
                {updateStatus === 'available' && (
                  <Button size="small" onClick={() => window.electronAPI.update.openRelease(updateInfo.releaseUrl!)}>
                    {fmt(t.updateAvailable, { version: updateInfo.latestVersion! })} — {t.download}
                  </Button>
                )}
                {updateStatus === 'latest' && (
                  <span style={{ fontSize: 12, color: '#22c55e' }}>{t.updateNotAvailable}</span>
                )}
                {updateStatus === 'error' && (
                  <span style={{ fontSize: 12, color: '#ef4444' }}>{t.updateError}</span>
                )}
              </div>
            </div>
            <div style={styles.cardDivider} />
            <div style={styles.cardRow}>
              <div style={styles.rowLabel}>{t.thirdPartySoftware}</div>
              <div style={{
                fontSize: 12,
                color: 'var(--color-secondary)',
                textAlign: 'right' as const,
                lineHeight: 1.6,
              }}>
                <div>{t.whisperCredit}</div>
                <div>{t.ffmpegCredit}</div>
              </div>
            </div>
            <div style={styles.cardDivider} />
            <div style={{ padding: '4px 0' }}>
              <Button size="small" onClick={handleShowOnboarding}>{t.showOnboarding}</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: 60,
    zIndex: 300,
  },
  window: {
    width: 560,
    maxHeight: 'calc(100vh - 120px)',
    backgroundColor: 'var(--color-background)',
    borderRadius: 10,
    boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  titleBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 16px',
    borderBottom: '1px solid var(--color-border)',
    flexShrink: 0,
  },
  closeButton: {
    width: 12,
    height: 12,
    borderRadius: '50%',
    backgroundColor: '#ff5f57',
    border: 'none',
    cursor: 'pointer',
    flexShrink: 0,
  },
  titleText: {
    fontSize: 'var(--font-body)',
    fontWeight: 600,
    flex: 1,
    textAlign: 'center',
    marginRight: 22,
  },
  content: {
    padding: 16,
    overflowY: 'auto',
    flex: 1,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--color-secondary)',
    marginTop: 16,
    marginBottom: 6,
    paddingLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: 'var(--color-surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--color-border)',
    padding: '12px 16px',
    marginBottom: 10,
  },
  cardRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 0',
    gap: 12,
  },
  cardDivider: {
    height: 1,
    backgroundColor: 'var(--color-border)',
    margin: '4px 0',
  },
  rowLabel: {
    fontSize: 'var(--font-body)',
    flexShrink: 0,
  },
  rowDesc: {
    fontSize: 12,
    color: 'var(--color-secondary)',
    lineHeight: 1.5,
    marginTop: 2,
  },
  rowValue: {
    fontSize: 'var(--font-body)',
    color: 'var(--color-secondary)',
  },
  storagePath: {
    fontSize: 12,
    color: 'var(--color-secondary)',
    fontFamily: "'SF Mono', 'Menlo', monospace",
    marginTop: 2,
    wordBreak: 'break-all',
  },
}

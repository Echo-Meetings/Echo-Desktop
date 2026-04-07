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
  gpuBackend: 'vulkan' | 'metal' | 'none'
}

interface SettingsProps {
  onClose: () => void
}

type SectionId = 'general' | 'storage' | 'model' | 'system' | 'about'

export function Settings({ onClose }: SettingsProps) {
  const t = useT()
  const { languageOverride, setLanguageOverride, setHasCompletedOnboarding, uiLanguage, setUiLanguage } = useAppStore()
  const [activeSection, setActiveSection] = useState<SectionId>('general')
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
    gpu: { available: boolean; backend: 'metal' | 'vulkan' | 'none'; name: string | null; vramMB: number | null }
    gpuBinarySupport: 'vulkan' | 'metal' | 'none'
    gpuEffective: boolean
  } | null>(null)
  const [recommendedModel, setRecommendedModel] = useState<string | null>(null)
  const [accelerationMode, setAccelerationMode] = useState<'gpu' | 'cpu'>('gpu')
  const [flashAttention, setFlashAttention] = useState(true)
  const [threadCount, setThreadCount] = useState<'auto' | number>('auto')
  const [logContent, setLogContent] = useState<string | null>(null)
  const [logLoading, setLogLoading] = useState(false)
  const [backupDir, setBackupDir] = useState('')
  const [backupStatus, setBackupStatus] = useState<'idle' | 'backing-up' | 'restoring' | 'done' | 'error'>('idle')
  const [backupProgress, setBackupProgress] = useState(0)
  const [backupMessage, setBackupMessage] = useState('')

  const sections: Array<{ id: SectionId; label: string }> = [
    { id: 'general', label: t.generalSection },
    { id: 'storage', label: t.storageSection },
    { id: 'model', label: t.modelPickerSection },
    { id: 'system', label: t.systemSection },
    { id: 'about', label: t.aboutSection },
  ]

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
    window.electronAPI.hardware.getRecommendedModel().then(setRecommendedModel)
    window.electronAPI.settings.get('accelerationMode').then((v) => setAccelerationMode((v as 'gpu' | 'cpu') || 'gpu'))
    window.electronAPI.settings.get('flashAttention').then((v) => setFlashAttention(v !== false))
    window.electronAPI.settings.get('threadCount').then((v) => setThreadCount((v as 'auto' | number) || 'auto'))
    window.electronAPI.settings.getBackupDirectory().then(setBackupDir)
  }, [])

  useEffect(() => {
    const unsub = window.electronAPI.on('backup:progress', (fraction) => {
      setBackupProgress(Math.round((fraction as number) * 100))
    })
    return unsub
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

  const handleAccelerationChange = async (mode: 'gpu' | 'cpu') => {
    setAccelerationMode(mode)
    await window.electronAPI.settings.set('accelerationMode', mode)
  }

  const handleFlashAttentionChange = async (enabled: boolean) => {
    setFlashAttention(enabled)
    await window.electronAPI.settings.set('flashAttention', enabled)
  }

  const handleThreadCountChange = async (value: 'auto' | number) => {
    setThreadCount(value)
    await window.electronAPI.settings.set('threadCount', value)
  }

  const handleChangeBackupDir = async () => {
    const path = await window.electronAPI.settings.openDirectoryPicker()
    if (path) {
      await window.electronAPI.settings.setBackupDirectory(path)
      setBackupDir(path)
    }
  }

  const handleCreateBackup = async () => {
    setBackupStatus('backing-up')
    setBackupProgress(0)
    setBackupMessage('')
    const result = await window.electronAPI.settings.createBackup()
    if (result.success) {
      setBackupStatus('done')
      setBackupMessage(fmt(t.backupComplete, { count: String(result.entryCount || 0), size: formatSize(result.totalSize || 0) }))
    } else {
      setBackupStatus('error')
      setBackupMessage(fmt(t.backupFailed, { error: result.error || 'Unknown error' }))
    }
    setTimeout(() => setBackupStatus('idle'), 5000)
  }

  const handleRestoreBackup = async () => {
    const dirPath = await window.electronAPI.settings.openDirectoryPicker()
    if (!dirPath) return

    const manifestResult = await window.electronAPI.settings.readBackupManifest(dirPath)
    if (manifestResult.error || !manifestResult.manifest) {
      alert(t.backupNoManifest)
      return
    }

    const m = manifestResult.manifest
    if (!confirm(fmt(t.backupConfirmRestore, { count: String(m.entryCount), size: formatSize(m.totalSizeBytes) }))) return

    setBackupStatus('restoring')
    setBackupProgress(0)
    setBackupMessage('')
    const result = await window.electronAPI.settings.restoreBackup(dirPath)
    if (result.success) {
      setBackupStatus('done')
      setBackupMessage(fmt(t.restoreComplete, { count: String(result.restoredCount || 0), skipped: String(result.skippedCount || 0) }))
      // Refresh history and storage size
      const entries = await window.electronAPI.history.getAll()
      useAppStore.getState().setHistoryEntries(entries as any[])
      window.electronAPI.settings.getStorageSize().then(setStorageSize)
    } else {
      setBackupStatus('error')
      setBackupMessage(fmt(t.restoreFailed, { error: result.error || 'Unknown error' }))
    }
    setTimeout(() => setBackupStatus('idle'), 5000)
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

  const renderSection = () => {
    switch (activeSection) {
      case 'general':
        return (
          <div style={styles.card}>
            <div style={styles.cardRow}>
              <div style={{ flex: 1, minWidth: 0 }}>
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
                style={{ width: 200, flexShrink: 0 }}
              />
            </div>
            <div style={styles.cardDivider} />
            <div style={styles.cardRow}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={styles.rowLabel}>{t.language}</div>
                <div style={styles.rowDesc}>{t.transcriptionLanguageDesc}</div>
              </div>
              <ComboBox
                options={SUPPORTED_LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
                value={languageOverride}
                onChange={handleLanguageChange}
                style={{ width: 200, flexShrink: 0 }}
              />
            </div>
          </div>
        )

      case 'storage':
        return (
          <>
            <div style={styles.card}>
              <div style={styles.cardRow}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={styles.rowLabel}>{t.transcriptsAndMedia}</div>
                  <div style={styles.storagePath}>{storageDir}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, padding: '4px 0' }}>
                <Button size="small" onClick={handleRevealStorage}>{t.revealInFileManager}</Button>
                <Button size="small" onClick={handleChangeStorage}>{t.change}</Button>
              </div>
              <div style={styles.cardDivider} />
              <div style={styles.cardRow}>
                <div style={styles.rowLabel}>{t.storageUsed}</div>
                <div style={styles.rowValue}>{formatSize(storageSize)}</div>
              </div>
            </div>

            <div style={styles.subSectionHeader}>{t.backupSection}</div>
            <div style={styles.card}>
              <div style={styles.cardRow}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={styles.rowLabel}>{t.backupDirectory}</div>
                  <div style={styles.storagePath}>{backupDir || t.backupDirectoryNotSet}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, padding: '4px 0' }}>
                <Button size="small" onClick={handleChangeBackupDir}>{t.backupChangeDirectory}</Button>
              </div>
              <div style={styles.cardDivider} />
              <div style={{ display: 'flex', gap: 8, padding: '6px 0' }}>
                <Button
                  size="small"
                  onClick={handleCreateBackup}
                  disabled={!backupDir || backupStatus === 'backing-up' || backupStatus === 'restoring'}
                >
                  {t.createBackup}
                </Button>
                <Button
                  size="small"
                  onClick={handleRestoreBackup}
                  disabled={backupStatus === 'backing-up' || backupStatus === 'restoring'}
                >
                  {t.restoreFromBackup}
                </Button>
              </div>
              {(backupStatus === 'backing-up' || backupStatus === 'restoring') && (
                <>
                  <div style={styles.cardDivider} />
                  <div style={styles.rowDesc}>
                    {fmt(backupStatus === 'backing-up' ? t.backupInProgress : t.restoreInProgress, { progress: String(backupProgress) })}
                  </div>
                  <div style={{
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: 'var(--color-border)',
                    overflow: 'hidden',
                    marginTop: 4,
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${backupProgress}%`,
                      backgroundColor: 'var(--color-foreground)',
                      borderRadius: 2,
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                </>
              )}
              {(backupStatus === 'done' || backupStatus === 'error') && (
                <>
                  <div style={styles.cardDivider} />
                  <div style={{
                    fontSize: 12,
                    color: backupStatus === 'done' ? '#22c55e' : '#ef4444',
                    padding: '6px 0',
                    lineHeight: 1.5,
                  }}>
                    {backupMessage}
                  </div>
                </>
              )}
            </div>
          </>
        )

      case 'model':
        return (
          <div style={styles.card}>
            <div style={styles.rowDesc}>{t.modelPickerDesc}</div>
            <div style={styles.cardDivider} />
            {availableModels.map((model, idx) => {
              const isActive = model.id === activeModelId
              const isDownloaded = downloadedModels[model.id]
              const isDownloading = downloadingModelId === model.id
              const modelLabel = (t as unknown as Record<string, string>)[model.labelKey] || model.id
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
                        {recommendedModel === model.id && (
                          <span style={{ fontSize: 11, color: '#22c55e', backgroundColor: 'rgba(34,197,94,0.1)', padding: '1px 6px', borderRadius: 4, fontWeight: 500 }}>{t.recommendedForHardware}</span>
                        )}
                        {!model.multilingual && (
                          <span style={{ fontSize: 11, color: 'var(--color-secondary)', backgroundColor: 'var(--color-highlight)', padding: '1px 6px', borderRadius: 4 }}>EN</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 12, marginTop: 2, paddingLeft: 22, fontSize: 12, color: 'var(--color-secondary)' }}>
                        <span>{formatSize(model.sizeBytes)}</span>
                        <span>{t.modelAccuracyPrefix} {accuracyLabel(model.accuracy).toLowerCase()}</span>
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
        )

      case 'system':
        return (
          <>
            {/* Hardware */}
            {hardwareInfo && (
              <>
                <div style={styles.subSectionHeader}>{t.hardwareSection}</div>
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

            {/* Performance */}
            <div style={styles.subSectionHeader}>{t.performanceSection}</div>
            <div style={styles.card}>
              {/* GPU Info */}
              <div style={styles.cardRow}>
                <div style={styles.rowLabel}>{t.gpuName}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={styles.rowValue}>
                    {hardwareInfo?.gpu.name || t.gpuNotDetected}
                  </span>
                  {hardwareInfo?.gpu.available && (
                    <span style={{
                      fontSize: 11,
                      padding: '1px 6px',
                      borderRadius: 4,
                      fontWeight: 500,
                      color: hardwareInfo.gpuEffective ? '#22c55e' : 'var(--color-secondary)',
                      backgroundColor: hardwareInfo.gpuEffective ? 'rgba(34,197,94,0.1)' : 'var(--color-highlight)',
                    }}>
                      {hardwareInfo.gpuEffective
                        ? `${hardwareInfo.gpu.backend === 'metal' ? 'Metal' : 'Vulkan'} — ${t.gpuActive}`
                        : t.gpuBinaryNotSupported}
                    </span>
                  )}
                </div>
              </div>
              {hardwareInfo?.gpu.vramMB && (
                <>
                  <div style={styles.cardDivider} />
                  <div style={styles.cardRow}>
                    <div style={styles.rowLabel}>{t.vram}</div>
                    <div style={styles.rowValue}>{formatSize(hardwareInfo.gpu.vramMB * 1024 * 1024)}</div>
                  </div>
                </>
              )}
              <div style={styles.cardDivider} />

              {/* Acceleration Mode */}
              <div style={styles.cardRow}>
                <div>
                  <div style={styles.rowLabel}>{t.accelerationMode}</div>
                </div>
                <div style={{ display: 'flex', gap: 0, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                  {(['gpu', 'cpu'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => handleAccelerationChange(mode)}
                      style={{
                        padding: '4px 14px',
                        fontSize: 12,
                        fontWeight: 500,
                        border: 'none',
                        cursor: 'pointer',
                        backgroundColor: accelerationMode === mode ? 'var(--color-foreground)' : 'var(--color-surface)',
                        color: accelerationMode === mode ? 'var(--color-background)' : 'var(--color-secondary)',
                        fontFamily: 'inherit',
                      }}
                    >
                      {mode === 'gpu' ? t.accelerationGpu : t.accelerationCpu}
                    </button>
                  ))}
                </div>
              </div>
              <div style={styles.cardDivider} />

              {/* Flash Attention */}
              <div style={styles.cardRow}>
                <div>
                  <div style={styles.rowLabel}>{t.flashAttention}</div>
                  <div style={styles.rowDesc}>{t.flashAttentionDesc}</div>
                </div>
                <div style={{ display: 'flex', gap: 0, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                  {[true, false].map((val) => (
                    <button
                      key={String(val)}
                      onClick={() => handleFlashAttentionChange(val)}
                      style={{
                        padding: '4px 14px',
                        fontSize: 12,
                        fontWeight: 500,
                        border: 'none',
                        cursor: 'pointer',
                        backgroundColor: flashAttention === val ? 'var(--color-foreground)' : 'var(--color-surface)',
                        color: flashAttention === val ? 'var(--color-background)' : 'var(--color-secondary)',
                        fontFamily: 'inherit',
                      }}
                    >
                      {val ? t.on : t.off}
                    </button>
                  ))}
                </div>
              </div>
              <div style={styles.cardDivider} />

              {/* Thread Count */}
              <div style={styles.cardRow}>
                <div style={styles.rowLabel}>{t.threadCount}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 0, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                    <button
                      onClick={() => handleThreadCountChange('auto')}
                      style={{
                        padding: '4px 14px',
                        fontSize: 12,
                        fontWeight: 500,
                        border: 'none',
                        cursor: 'pointer',
                        backgroundColor: threadCount === 'auto' ? 'var(--color-foreground)' : 'var(--color-surface)',
                        color: threadCount === 'auto' ? 'var(--color-background)' : 'var(--color-secondary)',
                        fontFamily: 'inherit',
                      }}
                    >
                      {t.threadCountAuto}
                    </button>
                    <button
                      onClick={() => handleThreadCountChange(hardwareInfo?.optimalThreads || 4)}
                      style={{
                        padding: '4px 14px',
                        fontSize: 12,
                        fontWeight: 500,
                        border: 'none',
                        cursor: 'pointer',
                        backgroundColor: threadCount !== 'auto' ? 'var(--color-foreground)' : 'var(--color-surface)',
                        color: threadCount !== 'auto' ? 'var(--color-background)' : 'var(--color-secondary)',
                        fontFamily: 'inherit',
                      }}
                    >
                      {t.threadCountManual}
                    </button>
                  </div>
                  {threadCount !== 'auto' && (
                    <input
                      type="range"
                      min={1}
                      max={hardwareInfo?.cpuCores || 8}
                      value={threadCount}
                      onChange={(e) => handleThreadCountChange(parseInt(e.target.value))}
                      style={{ width: 80, accentColor: 'var(--color-foreground)' }}
                    />
                  )}
                  <span style={{ fontSize: 12, color: 'var(--color-secondary)', minWidth: 16, textAlign: 'center' }}>
                    {threadCount === 'auto' ? hardwareInfo?.optimalThreads || '—' : threadCount}
                  </span>
                </div>
              </div>
            </div>

            {/* Diagnostics */}
            <div style={styles.subSectionHeader}>{t.diagnosticsSection}</div>
            <div style={styles.card}>
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
              <div style={styles.cardRow}>
                <div style={styles.rowLabel}>{t.diagnosticsFfmpeg}</div>
                <span style={{
                  fontSize: 13,
                  color: diagnostics?.ffmpegInstalled ? '#22c55e' : '#ef4444',
                }}>
                  {diagnostics?.ffmpegInstalled ? t.diagnosticsInstalled : t.diagnosticsNotFound}
                </span>
              </div>
              {diagnostics?.platform === 'win32' && (
                <>
                  <div style={styles.cardDivider} />
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
                          const url = diagnostics?.arch === 'arm64'
                            ? 'https://aka.ms/vs/17/release/vc_redist.arm64.exe'
                            : 'https://aka.ms/vs/17/release/vc_redist.x64.exe'
                          window.electronAPI.update.openRelease(url)
                        }}>
                          {t.diagnosticsDownloadVcRuntime} ({diagnostics?.arch === 'arm64' ? 'ARM64' : 'x64'}) ↗
                        </Button>
                      )}
                    </div>
                  </div>
                  <div style={styles.cardDivider} />
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
              <div style={styles.cardRow}>
                <div style={styles.rowLabel}>{t.diagnosticsArchitecture}</div>
                <div style={styles.rowValue}>{diagnostics?.arch || '—'}</div>
              </div>
              <div style={styles.cardDivider} />
              <div style={styles.cardRow}>
                <div style={styles.rowLabel}>{t.diagnosticsWhisperVersion}</div>
                <div style={styles.rowValue}>{diagnostics?.whisperVersion || '—'}</div>
              </div>
            </div>

            {/* Logs */}
            <div style={styles.subSectionHeader}>{t.logsSection}</div>
            <div style={styles.card}>
              <div style={{ display: 'flex', gap: 8, padding: '4px 0' }}>
                <Button size="small" onClick={async () => {
                  setLogLoading(true)
                  const content = await window.electronAPI.logs.readFile()
                  setLogContent(logContent === null ? content : null)
                  setLogLoading(false)
                }}>
                  {logLoading ? '...' : logContent === null ? t.logsShow : t.logsHide}
                </Button>
                <Button size="small" onClick={() => window.electronAPI.logs.reveal()}>
                  {t.logsOpenFile}
                </Button>
              </div>
              {logContent !== null && (
                <pre style={styles.logViewer}>{logContent || t.logsEmpty}</pre>
              )}
            </div>
          </>
        )

      case 'about':
        return (
          <>
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

            {/* Privacy */}
            <div style={styles.subSectionHeader}>{t.privacySection}</div>
            <div style={styles.card}>
              <div style={styles.rowDesc}>{t.privacyDesc}</div>
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
          </>
        )
    }
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.window} onClick={(e) => e.stopPropagation()}>
        {/* Title bar */}
        <div style={styles.titleBar}>
          <span style={styles.titleText}>{t.settingsTitle}</span>
          <button onClick={onClose} style={styles.closeButton}>✕</button>
        </div>

        <div style={styles.body}>
          {/* Sidebar */}
          <div style={styles.sidebar}>
            {sections.map((s) => (
              <div
                key={s.id}
                style={{
                  ...styles.sidebarItem,
                  ...(activeSection === s.id ? styles.sidebarItemActive : {}),
                }}
                onClick={() => setActiveSection(s.id)}
              >
                {s.label}
              </div>
            ))}
          </div>

          {/* Content */}
          <div style={styles.content}>
            <div style={styles.sectionHeader}>
              {sections.find((s) => s.id === activeSection)?.label}
            </div>
            {renderSection()}
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
    width: 720,
    minHeight: 520,
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
    width: 24,
    height: 24,
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    flexShrink: 0,
    fontSize: 14,
    color: 'var(--color-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: {
    fontSize: 'var(--font-body)',
    fontWeight: 600,
    flex: 1,
    textAlign: 'center',
    marginLeft: 24,
  },
  body: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  sidebar: {
    width: 170,
    flexShrink: 0,
    borderRight: '1px solid var(--color-border)',
    padding: '12px 0',
    overflowY: 'auto',
  },
  sidebarItem: {
    padding: '10px 20px',
    fontSize: 13,
    cursor: 'pointer',
    color: 'var(--color-secondary)',
    borderRadius: 0,
    transition: 'background-color 0.1s, color 0.1s',
  },
  sidebarItemActive: {
    color: 'var(--color-foreground)',
    fontWeight: 600,
    backgroundColor: 'var(--color-highlight)',
  },
  content: {
    padding: 16,
    overflowY: 'auto',
    flex: 1,
    minWidth: 0,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--color-foreground)',
    marginBottom: 10,
    paddingLeft: 4,
  },
  subSectionHeader: {
    fontSize: 11,
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
  logViewer: {
    maxHeight: 300,
    overflow: 'auto',
    backgroundColor: 'var(--color-surface)',
    borderRadius: 'var(--radius-sm)',
    padding: 12,
    fontSize: 11,
    fontFamily: "ui-monospace, 'SF Mono', 'Menlo', monospace",
    color: 'var(--color-secondary)',
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    margin: '8px 0 0',
  },
}

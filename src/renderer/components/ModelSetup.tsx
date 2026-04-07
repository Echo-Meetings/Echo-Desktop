import { useEffect, useState } from 'react'
import { useAppStore } from '@/stores/appStore'
import { useT } from '@/i18n'

type SetupStep = 'checking' | 'vcruntime' | 'ffmpeg' | 'whisper' | 'model' | 'done'

interface StepInfo {
  label: string
  status: 'pending' | 'active' | 'done' | 'skipped'
  progress: number // 0-100
}

export function ModelSetup() {
  const t = useT()
  const { modelDownloadProgress } = useAppStore()
  const [currentStep, setCurrentStep] = useState<SetupStep>('checking')
  const [ffmpegProgress, setFfmpegProgress] = useState(0)
  const [whisperProgress, setWhisperProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [vcRuntimeInfo, setVcRuntimeInfo] = useState<{ downloadUrl: string } | null>(null)
  const [manualInstallInstructions, setManualInstallInstructions] = useState<string | null>(null)

  useEffect(() => {
    runSetup()
  }, [])

  // Listen for download progress events
  useEffect(() => {
    const unsubs = [
      window.electronAPI.on('deps:ffmpegDownloadProgress', (p) => {
        setFfmpegProgress(Math.round((p as number) * 100))
      }),
      window.electronAPI.on('deps:whisperDownloadProgress', (p) => {
        setWhisperProgress(Math.round((p as number) * 100))
      }),
      window.electronAPI.on('deps:ffmpegReady', () => {
        setFfmpegProgress(100)
      }),
      window.electronAPI.on('deps:whisperReady', () => {
        setWhisperProgress(100)
      }),
      window.electronAPI.on('deps:ffmpegError', (msg) => {
        setError(`FFmpeg: ${msg as string}`)
      }),
      window.electronAPI.on('deps:whisperError', (msg) => {
        setError(`Whisper: ${msg as string}`)
      })
    ]
    return () => unsubs.forEach((u) => u())
  }, [])

  async function runSetup() {
    try {
      // Step 1: Check what's needed
      setCurrentStep('checking')
      const deps = await window.electronAPI.deps.getStatus()
      const modelStatus = await window.electronAPI.model.getStatus()

      // Step 2: Check VC++ Runtime (Windows only)
      if (deps.platform === 'win32' && !deps.vcRuntimeInstalled) {
        setCurrentStep('vcruntime')
        setVcRuntimeInfo({ downloadUrl: deps.vcRuntimeDownloadUrl })
        return // Block setup until user installs VC++ Runtime
      }

      // Step 3: Download ffmpeg if missing
      if (!deps.ffmpegAvailable) {
        if (deps.canAutoDownloadFFmpeg) {
          setCurrentStep('ffmpeg')
          await window.electronAPI.deps.downloadFFmpeg()
        }
      }

      // Step 4: Download whisper-cli if missing
      if (!deps.whisperAvailable) {
        if (deps.canAutoDownloadWhisper) {
          setCurrentStep('whisper')
          await window.electronAPI.deps.downloadWhisper()
        } else {
          // Can't auto-download (e.g. Linux ARM64) — show manual install instructions
          setManualInstallInstructions(deps.whisperInstallInstructions)
          setCurrentStep('whisper')
          return
        }
      }

      // Step 4: Download model if missing
      if (!modelStatus.loaded) {
        setCurrentStep('model')
        await window.electronAPI.model.load()
        // model:loaded event will trigger setModelReady(true) in App.tsx
      } else {
        setCurrentStep('done')
        useAppStore.getState().setModelReady(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed')
    }
  }

  const modelPercent = Math.round(modelDownloadProgress * 100)

  const stepLabels: Record<string, string> = {
    ffmpeg: t.ffmpegLabel,
    whisper: t.whisperLabel,
    model: t.modelLabel
  }

  const steps: StepInfo[] = buildStepInfo(currentStep, ffmpegProgress, whisperProgress, modelPercent, stepLabels)

  // Overall progress across all steps
  const totalProgress = Math.round(steps.reduce((sum, s) => sum + s.progress, 0) / steps.length)

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>{t.settingUpEcho}</h1>
      <p style={styles.subtitle}>
        {t.downloadingComponents}
      </p>

      {/* Step list */}
      <div style={styles.stepList}>
        {steps.map((step, i) => (
          <div key={i} style={styles.stepRow}>
            <div style={styles.stepIcon}>
              {step.status === 'done' || step.status === 'skipped' ? (
                <CheckIcon />
              ) : step.status === 'active' ? (
                <SpinnerIcon />
              ) : (
                <CircleIcon />
              )}
            </div>
            <div style={styles.stepLabel}>
              <span style={{
                color: step.status === 'active' ? 'var(--color-foreground)' : 'var(--color-secondary)',
                fontWeight: step.status === 'active' ? 500 : 400
              }}>
                {step.label}
              </span>
              {step.status === 'active' && step.progress > 0 && (
                <span style={styles.stepPercent}>{step.progress}%</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Overall progress bar */}
      <div style={styles.progressWrapper}>
        <div style={styles.progressTrack}>
          <div style={{ ...styles.progressFill, width: `${totalProgress}%` }} />
        </div>
      </div>

      {vcRuntimeInfo && (
        <div style={styles.warningBox}>
          <p style={styles.warningTitle}>{t.vcRuntimeRequired}</p>
          <p style={styles.warningText}>{t.vcRuntimeRequiredDesc}</p>
          <div style={styles.warningActions}>
            <button style={styles.primaryBtn} onClick={() => window.open(vcRuntimeInfo.downloadUrl)}>
              {t.downloadVcRuntime}
            </button>
            <button style={styles.retryBtn} onClick={() => { setVcRuntimeInfo(null); runSetup() }}>
              {t.retry}
            </button>
          </div>
        </div>
      )}

      {manualInstallInstructions && (
        <div style={styles.warningBox}>
          <p style={styles.warningTitle}>{t.manualInstallRequired}</p>
          <pre style={styles.codeBlock}>{manualInstallInstructions}</pre>
          <button style={styles.retryBtn} onClick={() => { setManualInstallInstructions(null); runSetup() }}>
            {t.retry}
          </button>
        </div>
      )}

      {error && (
        <div style={styles.errorBox}>
          <p style={styles.errorText}>{error}</p>
          <button style={styles.retryBtn} onClick={() => { setError(null); runSetup() }}>
            {t.retry}
          </button>
        </div>
      )}
    </div>
  )
}

function buildStepInfo(
  currentStep: SetupStep,
  ffmpegProgress: number,
  whisperProgress: number,
  modelPercent: number,
  stepLabels: Record<string, string>
): StepInfo[] {
  const stepOrder: SetupStep[] = ['ffmpeg', 'whisper', 'model']

  const currentIdx = stepOrder.indexOf(currentStep)

  return stepOrder.map((step, i) => {
    let status: StepInfo['status'] = 'pending'
    let progress = 0

    if (currentStep === 'checking') {
      status = 'pending'
    } else if (currentStep === 'done' || i < currentIdx) {
      status = 'done'
      progress = 100
    } else if (step === currentStep) {
      status = 'active'
      if (step === 'ffmpeg') progress = ffmpegProgress
      else if (step === 'whisper') progress = whisperProgress
      else if (step === 'model') progress = modelPercent
    }

    return { label: stepLabels[step], status, progress }
  })
}

// --- Icons ---

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" stroke="var(--color-foreground)" strokeWidth="1.5" fill="var(--color-foreground)" />
      <path d="M5 8l2 2 4-4" stroke="var(--color-background)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
      <circle cx="8" cy="8" r="7" stroke="var(--color-border)" strokeWidth="1.5" />
      <path d="M8 1a7 7 0 0 1 7 7" stroke="var(--color-foreground)" strokeWidth="1.5" strokeLinecap="round" />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </svg>
  )
}

function CircleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" stroke="var(--color-border)" strokeWidth="1.5" />
    </svg>
  )
}

// --- Styles ---

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    padding: 'var(--spacing-xl)'
  },
  title: {
    fontSize: 'var(--font-heading)',
    fontWeight: 600
  },
  subtitle: {
    fontSize: 'var(--font-body)',
    color: 'var(--color-secondary)',
    textAlign: 'center',
    maxWidth: 380
  },
  stepList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    width: '100%',
    maxWidth: 340
  },
  stepRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10
  },
  stepIcon: {
    width: 16,
    height: 16,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  stepLabel: {
    fontSize: 'var(--font-body)',
    display: 'flex',
    justifyContent: 'space-between',
    flex: 1
  },
  stepPercent: {
    fontSize: 'var(--font-caption)',
    color: 'var(--color-secondary)',
    fontVariantNumeric: 'tabular-nums'
  },
  progressWrapper: {
    width: '100%',
    maxWidth: 340,
    marginTop: 4
  },
  progressTrack: {
    height: 6,
    borderRadius: 'var(--radius-full)',
    backgroundColor: 'var(--color-border)',
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    borderRadius: 'var(--radius-full)',
    backgroundColor: 'var(--color-foreground)',
    transition: 'width 300ms ease-in-out'
  },
  errorBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    padding: 16,
    borderRadius: 'var(--radius-lg)',
    backgroundColor: 'rgba(255,59,48,0.08)',
    maxWidth: 340,
    width: '100%'
  },
  errorText: {
    fontSize: 'var(--font-caption)',
    color: 'rgb(255,59,48)',
    textAlign: 'center',
    whiteSpace: 'pre-wrap'
  },
  retryBtn: {
    fontSize: 'var(--font-caption)',
    padding: '6px 16px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
    backgroundColor: 'transparent',
    color: 'var(--color-foreground)',
    cursor: 'pointer'
  },
  warningBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    padding: 16,
    borderRadius: 'var(--radius-lg)',
    backgroundColor: 'rgba(255,159,10,0.08)',
    maxWidth: 340,
    width: '100%'
  },
  warningTitle: {
    fontSize: 'var(--font-body)',
    fontWeight: 600,
    color: 'var(--color-foreground)'
  },
  warningText: {
    fontSize: 'var(--font-caption)',
    color: 'var(--color-secondary)',
    textAlign: 'center' as const
  },
  warningActions: {
    display: 'flex',
    gap: 8,
    marginTop: 4
  },
  primaryBtn: {
    fontSize: 'var(--font-caption)',
    padding: '6px 16px',
    borderRadius: 'var(--radius-md)',
    border: 'none',
    backgroundColor: 'var(--color-foreground)',
    color: 'var(--color-background)',
    cursor: 'pointer'
  },
  codeBlock: {
    fontSize: 'var(--font-caption)',
    color: 'var(--color-foreground)',
    backgroundColor: 'var(--color-surface)',
    padding: 12,
    borderRadius: 'var(--radius-md)',
    whiteSpace: 'pre-wrap' as const,
    fontFamily: 'monospace',
    width: '100%'
  }
}

import { useState } from 'react'
import { useAppStore } from '@/stores/appStore'
import { SUPPORTED_LANGUAGES } from '@/types/models'

export function Onboarding() {
  const { languageOverride, setLanguageOverride, setHasCompletedOnboarding } = useAppStore()
  const [page, setPage] = useState(0)
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [thirdPartyAccepted, setThirdPartyAccepted] = useState(false)

  const canComplete = privacyAccepted && thirdPartyAccepted

  const handleComplete = async () => {
    await window.electronAPI.settings.set('hasCompletedOnboarding', true)
    await window.electronAPI.settings.set('languageOverride', languageOverride)
    await window.electronAPI.settings.set('privacyConsent', true)
    setHasCompletedOnboarding(true)
  }

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        {page === 0 && <WelcomePage />}
        {page === 1 && (
          <SetupPage
            languageOverride={languageOverride}
            onLanguageChange={setLanguageOverride}
          />
        )}
        {page === 2 && (
          <PrivacyPage
            privacyAccepted={privacyAccepted}
            thirdPartyAccepted={thirdPartyAccepted}
            onPrivacyChange={setPrivacyAccepted}
            onThirdPartyChange={setThirdPartyAccepted}
          />
        )}
      </div>

      {/* Page dots */}
      <div style={styles.dots}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              ...styles.dot,
              backgroundColor: i === page ? 'var(--color-foreground)' : 'var(--color-border)'
            }}
          />
        ))}
      </div>

      {/* Navigation */}
      <div style={styles.nav}>
        {page > 0 && (
          <button onClick={() => setPage(page - 1)} style={styles.backButton}>
            Back
          </button>
        )}
        <div style={{ flex: 1 }} />
        {page < 2 ? (
          <button onClick={() => setPage(page + 1)} style={styles.nextButton}>
            Next
          </button>
        ) : (
          <button
            onClick={handleComplete}
            disabled={!canComplete}
            style={{
              ...styles.nextButton,
              opacity: canComplete ? 1 : 0.4,
              cursor: canComplete ? 'pointer' : 'not-allowed'
            }}
          >
            Get Started
          </button>
        )}
      </div>
    </div>
  )
}

function WelcomePage() {
  return (
    <div style={styles.page}>
      <div style={styles.pageIcon}>〰</div>
      <h1 style={styles.pageTitle}>Welcome to Echo</h1>
      <p style={styles.pageSubtitle}>
        Private, offline transcription for your audio and video files.
        Everything stays on your device.
      </p>
      <div style={styles.featureList}>
        <FeatureRow icon="🔒" title="Privacy by design" desc="No data ever leaves your device" />
        <FeatureRow icon="⚡" title="On-device AI" desc="Powered by whisper.cpp, runs locally" />
        <FeatureRow icon="📄" title="Drop files" desc="MP3, WAV, MP4, MOV and more" />
      </div>
    </div>
  )
}

function SetupPage({
  languageOverride,
  onLanguageChange
}: {
  languageOverride: string
  onLanguageChange: (lang: string) => void
}) {
  return (
    <div style={styles.page}>
      <div style={styles.pageIcon}>⚙</div>
      <h1 style={styles.pageTitle}>Quick Setup</h1>

      <div style={styles.formGroup}>
        <label style={styles.formLabel}>Default language</label>
        <select
          value={languageOverride}
          onChange={(e) => onLanguageChange(e.target.value)}
          style={styles.select}
        >
          {SUPPORTED_LANGUAGES.map(({ code, label }) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div style={styles.infoBanner}>
        <span>🖥</span>
        <span>Model: Whisper Large V3 Turbo (~1.5 GB, downloaded once)</span>
      </div>
    </div>
  )
}

function PrivacyPage({
  privacyAccepted,
  thirdPartyAccepted,
  onPrivacyChange,
  onThirdPartyChange
}: {
  privacyAccepted: boolean
  thirdPartyAccepted: boolean
  onPrivacyChange: (v: boolean) => void
  onThirdPartyChange: (v: boolean) => void
}) {
  return (
    <div style={styles.page}>
      <div style={styles.pageIcon}>🛡</div>
      <h1 style={styles.pageTitle}>Privacy & Security</h1>
      <p style={styles.pageSubtitle}>
        Echo processes everything locally. Your files and transcripts never leave your device.
      </p>

      <div style={styles.disclosureCard}>
        <div style={styles.disclosureTitle}>Third-party software</div>
        <div style={styles.disclosureItem}>
          <strong>whisper.cpp</strong> — Open-source speech recognition (MIT License)
        </div>
        <div style={styles.disclosureItem}>
          <strong>ffmpeg</strong> — Media format conversion (LGPL/GPL)
        </div>
      </div>

      <label style={styles.checkbox}>
        <input
          type="checkbox"
          checked={privacyAccepted}
          onChange={(e) => onPrivacyChange(e.target.checked)}
        />
        <span>I have read and agree to the Privacy Policy</span>
      </label>

      <label style={styles.checkbox}>
        <input
          type="checkbox"
          checked={thirdPartyAccepted}
          onChange={(e) => onThirdPartyChange(e.target.checked)}
        />
        <span>I acknowledge the use of third-party software</span>
      </label>
    </div>
  )
}

function FeatureRow({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div style={styles.featureRow}>
      <span style={styles.featureIcon}>{icon}</span>
      <div>
        <div style={styles.featureTitle}>{title}</div>
        <div style={styles.featureDesc}>{desc}</div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'var(--spacing-xl)'
  },
  content: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 480
  },
  page: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    textAlign: 'center'
  },
  pageIcon: {
    fontSize: 56,
    marginBottom: 8
  },
  pageTitle: {
    fontSize: 'var(--font-title)',
    fontWeight: 700
  },
  pageSubtitle: {
    fontSize: 'var(--font-body)',
    color: 'var(--color-secondary)',
    lineHeight: 1.6,
    maxWidth: 380
  },
  featureList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    marginTop: 16,
    textAlign: 'left'
  },
  featureRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12
  },
  featureIcon: {
    fontSize: 20,
    marginTop: 2
  },
  featureTitle: {
    fontSize: 'var(--font-body)',
    fontWeight: 600
  },
  featureDesc: {
    fontSize: 'var(--font-caption)',
    color: 'var(--color-secondary)',
    marginTop: 2
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    width: '100%',
    maxWidth: 320,
    textAlign: 'left'
  },
  formLabel: {
    fontSize: 'var(--font-caption)',
    color: 'var(--color-secondary)',
    fontWeight: 500
  },
  select: {
    padding: '8px 12px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-foreground)',
    fontSize: 'var(--font-body)'
  },
  infoBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 16px',
    backgroundColor: 'var(--color-surface)',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--font-caption)',
    color: 'var(--color-secondary)',
    marginTop: 16
  },
  disclosureCard: {
    width: '100%',
    maxWidth: 380,
    padding: 16,
    backgroundColor: 'var(--color-surface)',
    borderRadius: 'var(--radius-md)',
    textAlign: 'left'
  },
  disclosureTitle: {
    fontSize: 'var(--font-body)',
    fontWeight: 600,
    marginBottom: 8
  },
  disclosureItem: {
    fontSize: 'var(--font-caption)',
    color: 'var(--color-secondary)',
    marginBottom: 4,
    lineHeight: 1.5
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 'var(--font-caption)',
    cursor: 'pointer',
    marginTop: 4
  },
  dots: {
    display: 'flex',
    gap: 8,
    marginBottom: 24
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    transition: 'var(--transition-fast)'
  },
  nav: {
    display: 'flex',
    width: '100%',
    maxWidth: 480
  },
  backButton: {
    padding: '8px 20px',
    border: 'none',
    background: 'none',
    color: 'var(--color-secondary)',
    fontSize: 'var(--font-button)',
    cursor: 'pointer'
  },
  nextButton: {
    padding: '8px 24px',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--color-foreground)',
    color: 'var(--color-background)',
    fontSize: 'var(--font-button)',
    fontWeight: 500,
    cursor: 'pointer'
  }
}

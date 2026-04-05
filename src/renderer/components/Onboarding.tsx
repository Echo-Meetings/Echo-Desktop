import { useState } from 'react'
import { useAppStore } from '@/stores/appStore'
import { SUPPORTED_LANGUAGES } from '@/types/models'
import { useT } from '@/i18n'
import { EchoLogo } from './EchoLogo'
import { ComboBox } from './ComboBox'
import { Button } from './Button'

export function Onboarding() {
  const t = useT()
  const { languageOverride, setLanguageOverride, setHasCompletedOnboarding, uiLanguage } = useAppStore()
  const [page, setPage] = useState(0)

  const handleComplete = async () => {
    const accepted = await window.electronAPI.settings.showPrivacyPolicy(uiLanguage)
    if (accepted) {
      await window.electronAPI.settings.set('hasCompletedOnboarding', true)
      await window.electronAPI.settings.set('languageOverride', languageOverride)
      await window.electronAPI.settings.set('privacyConsent', true)
      setHasCompletedOnboarding(true)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.contentArea}>
        {page === 0 && <WelcomePage />}
        {page === 1 && (
          <SetupPage
            languageOverride={languageOverride}
            onLanguageChange={setLanguageOverride}
          />
        )}
      </div>
      <div style={styles.bottomNav}>
        <div style={styles.dots}>
          {[0, 1].map((i) => (
            <div
              key={i}
              style={{
                ...styles.dot,
                backgroundColor: i === page ? 'var(--color-foreground)' : 'var(--color-border)'
              }}
            />
          ))}
        </div>
        <div style={styles.navRow}>
          {page > 0 && (
            <Button variant="ghost" onClick={() => setPage(page - 1)}>
              {t.back}
            </Button>
          )}
          <div style={{ flex: 1 }} />
          {page === 0 && (
            <Button onClick={() => setPage(1)}>{t.next}</Button>
          )}
          {page === 1 && (
            <Button onClick={handleComplete}>{t.getStarted}</Button>
          )}
        </div>
      </div>
    </div>
  )
}

function WelcomePage() {
  const t = useT()
  return (
    <div style={styles.page}>
      <EchoLogo size={56} />
      <h1 style={styles.pageTitle}>{t.welcomeTitle}</h1>
      <p style={styles.pageSubtitle}>
        {t.welcomeSubtitle}
      </p>
      <div style={styles.featureList}>
        <div style={styles.featureRow}>
          <span style={styles.featureIcon}>🔒</span>
          <span><strong>{t.featurePrivateTitle}</strong> — {t.featurePrivateDesc}</span>
        </div>
        <div style={styles.featureRow}>
          <span style={styles.featureIcon}>⚡</span>
          <span><strong>{t.featureAITitle}</strong> {t.featureAIDesc}</span>
        </div>
        <div style={styles.featureRow}>
          <span style={styles.featureIcon}>🎥</span>
          <span><strong>{t.featureDropTitle}</strong> {t.featureDropDesc}</span>
        </div>
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
  const t = useT()
  return (
    <div style={styles.page}>
      <div style={styles.gearIcon}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </div>
      <h1 style={styles.pageTitle}>{t.setupTitle}</h1>
      <p style={styles.pageSubtitle}>
        {t.setupSubtitle}
      </p>

      <div style={styles.formGroup}>
        <label style={styles.formLabel}>{t.transcriptionLanguage}</label>
        <ComboBox
          options={SUPPORTED_LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
          value={languageOverride}
          onChange={onLanguageChange}
        />
        <div style={styles.formHint}>{t.changeLaterHint}</div>
      </div>

      <div style={styles.modelCard}>
        <div style={styles.modelRow}>
          <span style={styles.modelLabel}>{t.model}</span>
          <span style={styles.modelValue}>{t.modelName}</span>
        </div>
        <div style={styles.modelRow}>
          <span style={styles.modelLabel}>{t.size}</span>
          <span style={styles.modelValue}>{t.modelSize}</span>
        </div>
        <div style={styles.modelNote}>{t.modelDownloadNote}</div>
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
    padding: 'var(--spacing-xl)'
  },
  contentArea: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 520
  },
  page: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    textAlign: 'center'
  },
  pageTitle: {
    fontSize: 28,
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
  gearIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: 'var(--color-foreground)',
    color: 'var(--color-background)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
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
    fontSize: 12,
    color: 'var(--color-secondary)',
    fontWeight: 500
  },
  formHint: {
    fontSize: 12,
    color: 'var(--color-tertiary)',
    marginTop: 6
  },
  modelCard: {
    width: '100%',
    maxWidth: 320,
    background: 'var(--color-surface)',
    borderRadius: 'var(--radius-md)',
    padding: '12px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginTop: 8
  },
  modelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  modelLabel: {
    fontSize: 'var(--font-caption)',
    color: 'var(--color-secondary)'
  },
  modelValue: {
    fontSize: 'var(--font-caption)',
    fontWeight: 500
  },
  modelNote: {
    fontSize: 12,
    color: 'var(--color-tertiary)'
  },
  bottomNav: {
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    width: '100%',
    maxWidth: 520
  },
  dots: {
    display: 'flex',
    gap: 8
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    transition: 'var(--transition-fast)'
  },
  navRow: {
    display: 'flex',
    width: '100%',
    alignItems: 'center'
  }
}

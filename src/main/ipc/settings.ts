import { ipcMain, dialog, nativeTheme, app, shell, BrowserWindow } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs'
import { copyFile, readdir, readFile, stat, mkdir } from 'fs/promises'
import { join } from 'path'
import { userInfo } from 'os'
import { logger } from '../services/Logger'

// Simple JSON settings store (replaces electron-store which requires ESM)
class SettingsStore {
  private filePath: string
  private data: Record<string, unknown>
  private defaults: Record<string, unknown>

  constructor(defaults: Record<string, unknown>) {
    this.defaults = defaults
    const userDataPath = app.getPath('userData')
    if (!existsSync(userDataPath)) mkdirSync(userDataPath, { recursive: true })
    this.filePath = join(userDataPath, 'settings.json')

    if (existsSync(this.filePath)) {
      try {
        this.data = JSON.parse(readFileSync(this.filePath, 'utf-8'))
      } catch {
        this.data = { ...defaults }
      }
    } else {
      this.data = { ...defaults }
    }
  }

  get(key: string): unknown {
    return key in this.data ? this.data[key] : this.defaults[key]
  }

  set(key: string, value: unknown): void {
    this.data[key] = value
    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8')
  }
}

const store = new SettingsStore({
  languageOverride: 'auto',
  hasCompletedOnboarding: false,
  privacyConsent: false,
  storageDirectory: '',
  backupDirectory: '',
  activeModel: 'large-v3-turbo',
  // Performance — all acceleration enabled by default
  accelerationMode: 'gpu',       // 'cpu' | 'gpu'
  flashAttention: true,           // flash attention for GPU decoder
  threadCount: 'auto'             // 'auto' | number
})

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:get', (_event, key: string) => {
    return store.get(key)
  })

  ipcMain.handle('settings:set', (_event, key: string, value: unknown) => {
    store.set(key, value)
  })

  ipcMain.handle('settings:getStorageDirectory', () => {
    const dir = store.get('storageDirectory') as string
    if (dir) return dir
    const home = process.env.HOME || process.env.USERPROFILE || ''
    return join(home, 'Documents', 'EchoTranscripts')
  })

  ipcMain.handle('settings:setStorageDirectory', async (_event, _path: string) => {
    // TODO: Implement storage migration
    return {}
  })

  ipcMain.handle('settings:openDirectoryPicker', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      message: 'Choose where to save your transcripts'
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('settings:getStorageSize', () => {
    const dir = store.get('storageDirectory') as string
    const home = process.env.HOME || process.env.USERPROFILE || ''
    const storageDir = dir || join(home, 'Documents', 'EchoTranscripts')
    return getDirSize(storageDir)
  })

  ipcMain.handle('settings:revealStorage', () => {
    const dir = store.get('storageDirectory') as string
    const home = process.env.HOME || process.env.USERPROFILE || ''
    const storageDir = dir || join(home, 'Documents', 'EchoTranscripts')
    shell.openPath(storageDir)
  })

  // --- Backup & Restore ---

  ipcMain.handle('settings:getBackupDirectory', () => {
    return (store.get('backupDirectory') as string) || ''
  })

  ipcMain.handle('settings:setBackupDirectory', (_event, path: string) => {
    if (!existsSync(path)) mkdirSync(path, { recursive: true })
    store.set('backupDirectory', path)
  })

  ipcMain.handle('settings:createBackup', async () => {
    try {
      const backupDir = (store.get('backupDirectory') as string) || ''
      if (!backupDir) return { error: 'no_backup_dir' }

      const dir = store.get('storageDirectory') as string
      const home = process.env.HOME || process.env.USERPROFILE || ''
      const storageDir = dir || join(home, 'Documents', 'EchoTranscripts')
      if (!existsSync(storageDir)) return { error: 'storage_not_found' }

      // Create timestamped subfolder
      const now = new Date()
      const ts = now.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)
      const backupSubDir = join(backupDir, `Echo-Backup-${ts}`)
      await mkdir(backupSubDir, { recursive: true })
      await mkdir(join(backupSubDir, '.echo', 'media'), { recursive: true })

      // Enumerate files to copy
      const filesToCopy: Array<{ src: string; dest: string; size: number }> = []
      const echoDir = join(storageDir, '.echo')
      const mediaDir = join(echoDir, 'media')

      // .echo/*.json and .echo/*_thumb.jpg
      if (existsSync(echoDir)) {
        const echoFiles = await readdir(echoDir)
        for (const f of echoFiles) {
          const fullPath = join(echoDir, f)
          const s = await stat(fullPath)
          if (s.isFile() && (f.endsWith('.json') || f.endsWith('.jpg'))) {
            filesToCopy.push({ src: fullPath, dest: join(backupSubDir, '.echo', f), size: s.size })
          }
        }
      }

      // .echo/media/*
      if (existsSync(mediaDir)) {
        const mediaFiles = await readdir(mediaDir)
        for (const f of mediaFiles) {
          const fullPath = join(mediaDir, f)
          const s = await stat(fullPath)
          if (s.isFile()) {
            filesToCopy.push({ src: fullPath, dest: join(backupSubDir, '.echo', 'media', f), size: s.size })
          }
        }
      }

      // *_transcript.txt at root
      if (existsSync(storageDir)) {
        const rootFiles = await readdir(storageDir)
        for (const f of rootFiles) {
          if (f.endsWith('_transcript.txt')) {
            const fullPath = join(storageDir, f)
            const s = await stat(fullPath)
            if (s.isFile()) {
              filesToCopy.push({ src: fullPath, dest: join(backupSubDir, f), size: s.size })
            }
          }
        }
      }

      const totalBytes = filesToCopy.reduce((sum, f) => sum + f.size, 0)
      let copiedBytes = 0
      const win = BrowserWindow.getAllWindows()[0]

      for (const file of filesToCopy) {
        await copyFile(file.src, file.dest)
        copiedBytes += file.size
        if (win && !win.isDestroyed()) {
          win.webContents.send('backup:progress', totalBytes > 0 ? copiedBytes / totalBytes : 1)
        }
      }

      // Count entries (UUID .json files only)
      const entryCount = filesToCopy.filter(f => {
        const name = f.src.split('/').pop() || f.src.split('\\').pop() || ''
        return f.src.includes('.echo') && name.endsWith('.json') && !name.includes('_thumb')
      }).length

      // Write manifest
      const manifest = {
        version: '1.0',
        appVersion: app.getVersion(),
        createdAt: now.toISOString(),
        entryCount,
        totalSizeBytes: totalBytes
      }
      writeFileSync(join(backupSubDir, 'echo-backup.json'), JSON.stringify(manifest, null, 2), 'utf-8')

      return { success: true, path: backupSubDir, entryCount, totalSize: totalBytes }
    } catch (err) {
      logger.error('backup', `Backup failed: ${err}`)
      return { error: String(err) }
    }
  })

  ipcMain.handle('settings:readBackupManifest', async (_event, dirPath: string) => {
    try {
      const manifestPath = join(dirPath, 'echo-backup.json')
      if (!existsSync(manifestPath)) return { error: 'no_manifest' }
      const data = await readFile(manifestPath, 'utf-8')
      return { manifest: JSON.parse(data) }
    } catch (err) {
      return { error: String(err) }
    }
  })

  ipcMain.handle('settings:restoreBackup', async (_event, backupDirPath: string) => {
    try {
      const manifestPath = join(backupDirPath, 'echo-backup.json')
      if (!existsSync(manifestPath)) return { error: 'no_manifest' }

      const dir = store.get('storageDirectory') as string
      const home = process.env.HOME || process.env.USERPROFILE || ''
      const storageDir = dir || join(home, 'Documents', 'EchoTranscripts')
      const echoDir = join(storageDir, '.echo')
      const mediaDir = join(echoDir, 'media')
      if (!existsSync(echoDir)) mkdirSync(echoDir, { recursive: true })
      if (!existsSync(mediaDir)) mkdirSync(mediaDir, { recursive: true })

      // Find which entry IDs already exist
      const existingIds = new Set<string>()
      if (existsSync(echoDir)) {
        const files = readdirSync(echoDir)
        for (const f of files) {
          const match = f.match(/^([0-9a-f-]{36})\.json$/)
          if (match) existingIds.add(match[1])
        }
      }

      // Enumerate backup entry IDs
      const backupEchoDir = join(backupDirPath, '.echo')
      const backupMediaDir = join(backupEchoDir, 'media')
      const skippedIds = new Set<string>()
      const filesToCopy: Array<{ src: string; dest: string; size: number }> = []

      if (existsSync(backupEchoDir)) {
        const backupFiles = await readdir(backupEchoDir)
        for (const f of backupFiles) {
          const fullPath = join(backupEchoDir, f)
          const s = await stat(fullPath)
          if (!s.isFile()) continue

          // Check if this is an entry JSON and if it conflicts
          const jsonMatch = f.match(/^([0-9a-f-]{36})\.json$/)
          if (jsonMatch && existingIds.has(jsonMatch[1])) {
            skippedIds.add(jsonMatch[1])
            continue
          }

          // Check if thumbnail belongs to a skipped entry
          const thumbMatch = f.match(/^([0-9a-f-]{36})_thumb\.jpg$/)
          if (thumbMatch && existingIds.has(thumbMatch[1])) {
            skippedIds.add(thumbMatch[1])
            continue
          }

          filesToCopy.push({ src: fullPath, dest: join(echoDir, f), size: s.size })
        }
      }

      // Media files
      if (existsSync(backupMediaDir)) {
        const mediaFiles = await readdir(backupMediaDir)
        for (const f of mediaFiles) {
          const fullPath = join(backupMediaDir, f)
          const s = await stat(fullPath)
          if (!s.isFile()) continue

          // Check if media belongs to a skipped entry
          const idMatch = f.match(/^([0-9a-f-]{36})\./)
          if (idMatch && skippedIds.has(idMatch[1])) continue

          filesToCopy.push({ src: fullPath, dest: join(mediaDir, f), size: s.size })
        }
      }

      // Transcript txt files
      const backupRootFiles = await readdir(backupDirPath)
      for (const f of backupRootFiles) {
        if (!f.endsWith('_transcript.txt')) continue
        const fullPath = join(backupDirPath, f)
        const destPath = join(storageDir, f)
        if (existsSync(destPath)) continue // skip existing
        const s = await stat(fullPath)
        if (s.isFile()) {
          filesToCopy.push({ src: fullPath, dest: destPath, size: s.size })
        }
      }

      const totalBytes = filesToCopy.reduce((sum, f) => sum + f.size, 0)
      let copiedBytes = 0
      const win = BrowserWindow.getAllWindows()[0]

      for (const file of filesToCopy) {
        await copyFile(file.src, file.dest)
        copiedBytes += file.size
        if (win && !win.isDestroyed()) {
          win.webContents.send('backup:progress', totalBytes > 0 ? copiedBytes / totalBytes : 1)
        }
      }

      const restoredCount = filesToCopy.filter(f => {
        const name = f.src.split('/').pop() || f.src.split('\\').pop() || ''
        return f.src.includes('.echo') && name.endsWith('.json') && !name.includes('_thumb') && name !== 'echo-backup.json'
      }).length

      return { success: true, restoredCount, skippedCount: skippedIds.size }
    } catch (err) {
      logger.error('backup', `Restore failed: ${err}`)
      return { error: String(err) }
    }
  })

  ipcMain.handle('platform:getTheme', () => {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  })

  ipcMain.handle('platform:getUsername', () => {
    try {
      return userInfo().username
    } catch {
      return null
    }
  })

  nativeTheme.on('updated', () => {
    const windows = BrowserWindow.getAllWindows()
    const theme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
    windows.forEach((w: Electron.BrowserWindow) => {
      if (!w.isDestroyed()) w.webContents.send('theme:changed', theme)
    })
  })

  ipcMain.handle('settings:showPrivacyPolicy', async (_event, locale?: string) => {
    const parent = BrowserWindow.getAllWindows()[0] || null
    const isDark = nativeTheme.shouldUseDarkColors
    const bg = isDark ? '#1f1f1f' : '#ffffff'
    const fg = isDark ? '#f0f0f0' : '#0a0a0a'
    const secondary = isDark ? '#999999' : '#4a4a4a'
    const border = isDark ? '#404040' : '#c8c8c8'
    const surface = isDark ? '#111111' : '#f5f5f5'

    const pp = getPrivacyPolicyStrings(locale || 'en')

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
    background: ${bg}; color: ${fg}; display: flex; flex-direction: column; height: 100vh;
    -webkit-font-smoothing: antialiased;
  }
  h1 { font-size: 18px; font-weight: 700; padding: 20px 24px 12px; flex-shrink: 0; }
  .content {
    flex: 1; overflow-y: auto; padding: 0 24px 16px; font-size: 13px; line-height: 1.7; color: ${secondary};
  }
  .content h2 { font-size: 14px; font-weight: 600; color: ${fg}; margin: 16px 0 6px; }
  .content h2:first-child { margin-top: 0; }
  .content p { margin-bottom: 8px; }
  .footer {
    flex-shrink: 0; display: flex; justify-content: flex-end; gap: 8px;
    padding: 12px 24px; border-top: 1px solid ${border};
  }
  button {
    padding: 6px 16px; border-radius: 6px; font-size: 13px; font-weight: 500;
    cursor: pointer; font-family: inherit;
  }
  .btn-cancel { border: 1px solid ${border}; background: ${surface}; color: ${fg}; }
  .btn-accept { border: none; background: ${fg}; color: ${bg}; }
</style>
</head>
<body>
<h1>${pp.title}</h1>
<div class="content">
  <h2>${pp.s1t}</h2><p>${pp.s1}</p>
  <h2>${pp.s2t}</h2><p>${pp.s2}</p>
  <h2>${pp.s3t}</h2><p>${pp.s3}</p>
  <h2>${pp.s4t}</h2><p>${pp.s4}</p>
  <h2>${pp.s5t}</h2><p>${pp.s5}</p>
  <h2>${pp.s6t}</h2><p>${pp.s6}</p>
  <h2>${pp.s7t}</h2><p>${pp.s7}</p>
  <h2>${pp.s8t}</h2><p>${pp.s8}</p>
</div>
<div class="footer" id="footer"></div>
</body>
</html>`

    return new Promise<boolean>((resolve) => {
      const modal = new BrowserWindow({
        width: 520,
        height: 600,
        resizable: false,
        modal: true,
        parent: parent || undefined,
        title: pp.title,
        backgroundColor: bg,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      })

      modal.setMenu(null)
      modal.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

      let resolved = false
      const cancelLabel = JSON.stringify(pp.cancel)
      const acceptLabel = JSON.stringify(pp.accept)

      modal.webContents.on('did-finish-load', () => {
        modal.webContents.executeJavaScript(`
          const footer = document.getElementById('footer');
          const cancelBtn = document.createElement('button');
          cancelBtn.className = 'btn-cancel';
          cancelBtn.textContent = ${cancelLabel};
          cancelBtn.onclick = () => { document.title = 'CANCEL'; };
          const acceptBtn = document.createElement('button');
          acceptBtn.className = 'btn-accept';
          acceptBtn.textContent = ${acceptLabel};
          acceptBtn.onclick = () => { document.title = 'ACCEPT'; };
          footer.appendChild(cancelBtn);
          footer.appendChild(acceptBtn);
        `)
      })

      modal.on('page-title-updated', (_event, title) => {
        if (title === 'ACCEPT') {
          resolved = true
          modal.close()
          resolve(true)
        } else if (title === 'CANCEL' || title === 'CLOSE') {
          resolved = true
          modal.close()
          resolve(false)
        }
      })

      modal.on('closed', () => {
        if (!resolved) resolve(false)
      })
    })
  })

  // --- Logs ---

  ipcMain.handle('logs:getRecent', () => {
    return logger.getRecentLogs()
  })

  ipcMain.handle('logs:readFile', () => {
    return logger.readLogFile()
  })

  ipcMain.handle('logs:reveal', () => {
    shell.showItemInFolder(logger.getLogFilePath())
  })
}

function getPrivacyPolicyStrings(locale: string) {
  const strings: Record<string, {
    title: string; cancel: string; accept: string
    s1t: string; s1: string; s2t: string; s2: string; s3t: string; s3: string
    s4t: string; s4: string; s5t: string; s5: string; s6t: string; s6: string
    s7t: string; s7: string; s8t: string; s8: string
  }> = {
    en: {
      title: 'Privacy Policy',
      cancel: 'Cancel',
      accept: 'Accept & Get Started',
      s1t: 'Overview',
      s1: 'Echo is a privacy-first transcription application. All audio and video processing happens entirely on your device. No data is sent to external servers.',
      s2t: 'Data Collection',
      s2: 'Echo does not collect, transmit, or store any personal data on remote servers. All transcriptions, settings, and media files remain on your local machine.',
      s3t: 'Audio & Video Files',
      s3: 'Your audio and video files are processed locally using on-device AI models. Original files are never modified. Transcription results are stored in the location you choose.',
      s4t: 'Network Access',
      s4: 'Echo requires an internet connection only to download the AI model during initial setup. After that, the app works entirely offline.',
      s5t: 'Third-Party Services',
      s5: 'Echo does not integrate with any third-party analytics, advertising, or tracking services. No data is shared with third parties.',
      s6t: 'Local Storage',
      s6: 'Transcriptions and app settings are stored locally on your device. You can view, export, or delete your data at any time from within the app.',
      s7t: 'Analytics',
      s7: 'Echo does not collect usage analytics or telemetry data. Your usage patterns are not tracked or recorded.',
      s8t: 'Changes to This Policy',
      s8: 'Any changes to this privacy policy will be included in app updates. We are committed to maintaining your privacy and will never introduce data collection without your explicit consent.'
    },
    ru: {
      title: 'Политика конфиденциальности',
      cancel: 'Отмена',
      accept: 'Принять и начать',
      s1t: 'Обзор',
      s1: 'Echo — приложение для транскрибации с приоритетом конфиденциальности. Вся обработка аудио и видео происходит исключительно на вашем устройстве. Никакие данные не отправляются на внешние серверы.',
      s2t: 'Сбор данных',
      s2: 'Echo не собирает, не передаёт и не хранит персональные данные на удалённых серверах. Все транскрипции, настройки и медиафайлы остаются на вашем устройстве.',
      s3t: 'Аудио и видеофайлы',
      s3: 'Ваши аудио- и видеофайлы обрабатываются локально с помощью ИИ-моделей на устройстве. Исходные файлы не изменяются. Результаты транскрибации сохраняются в выбранном вами месте.',
      s4t: 'Доступ к сети',
      s4: 'Echo требует подключения к интернету только для загрузки ИИ-модели при первоначальной настройке. После этого приложение работает полностью офлайн.',
      s5t: 'Сторонние сервисы',
      s5: 'Echo не использует сторонние сервисы аналитики, рекламы или отслеживания. Никакие данные не передаются третьим лицам.',
      s6t: 'Локальное хранилище',
      s6: 'Транскрипции и настройки хранятся локально на вашем устройстве. Вы можете просматривать, экспортировать или удалять свои данные в любое время.',
      s7t: 'Аналитика',
      s7: 'Echo не собирает аналитику использования или телеметрию. Ваши паттерны использования не отслеживаются.',
      s8t: 'Изменения политики',
      s8: 'Любые изменения в этой политике конфиденциальности будут включены в обновления приложения. Мы никогда не введём сбор данных без вашего явного согласия.'
    },
    de: {
      title: 'Datenschutzrichtlinie',
      cancel: 'Abbrechen',
      accept: 'Akzeptieren & Starten',
      s1t: 'Überblick',
      s1: 'Echo ist eine datenschutzorientierte Transkriptionsanwendung. Die gesamte Audio- und Videoverarbeitung erfolgt ausschließlich auf Ihrem Gerät. Es werden keine Daten an externe Server gesendet.',
      s2t: 'Datenerfassung',
      s2: 'Echo erfasst, überträgt oder speichert keine personenbezogenen Daten auf Remote-Servern. Alle Transkriptionen, Einstellungen und Mediendateien verbleiben auf Ihrem lokalen Gerät.',
      s3t: 'Audio- & Videodateien',
      s3: 'Ihre Audio- und Videodateien werden lokal mit KI-Modellen auf dem Gerät verarbeitet. Originaldateien werden nie verändert. Transkriptionsergebnisse werden am von Ihnen gewählten Ort gespeichert.',
      s4t: 'Netzwerkzugriff',
      s4: 'Echo benötigt eine Internetverbindung nur zum Herunterladen des KI-Modells bei der Ersteinrichtung. Danach funktioniert die App vollständig offline.',
      s5t: 'Drittanbieterdienste',
      s5: 'Echo integriert keine Analyse-, Werbe- oder Tracking-Dienste von Drittanbietern. Es werden keine Daten an Dritte weitergegeben.',
      s6t: 'Lokale Speicherung',
      s6: 'Transkriptionen und App-Einstellungen werden lokal auf Ihrem Gerät gespeichert. Sie können Ihre Daten jederzeit anzeigen, exportieren oder löschen.',
      s7t: 'Analytik',
      s7: 'Echo erfasst keine Nutzungsanalysen oder Telemetriedaten. Ihre Nutzungsmuster werden nicht verfolgt oder aufgezeichnet.',
      s8t: 'Änderungen dieser Richtlinie',
      s8: 'Änderungen an dieser Datenschutzrichtlinie werden in App-Updates aufgenommen. Wir werden niemals Datenerfassung ohne Ihre ausdrückliche Zustimmung einführen.'
    },
    fr: {
      title: 'Politique de confidentialité',
      cancel: 'Annuler',
      accept: 'Accepter et commencer',
      s1t: 'Aperçu',
      s1: 'Echo est une application de transcription axée sur la confidentialité. Tout le traitement audio et vidéo se fait entièrement sur votre appareil. Aucune donnée n\'est envoyée à des serveurs externes.',
      s2t: 'Collecte de données',
      s2: 'Echo ne collecte, ne transmet et ne stocke aucune donnée personnelle sur des serveurs distants. Toutes les transcriptions, paramètres et fichiers multimédias restent sur votre appareil.',
      s3t: 'Fichiers audio et vidéo',
      s3: 'Vos fichiers audio et vidéo sont traités localement à l\'aide de modèles d\'IA sur l\'appareil. Les fichiers originaux ne sont jamais modifiés. Les résultats sont stockés à l\'emplacement de votre choix.',
      s4t: 'Accès réseau',
      s4: 'Echo nécessite une connexion Internet uniquement pour télécharger le modèle d\'IA lors de la configuration initiale. Ensuite, l\'application fonctionne entièrement hors ligne.',
      s5t: 'Services tiers',
      s5: 'Echo n\'intègre aucun service d\'analyse, de publicité ou de suivi tiers. Aucune donnée n\'est partagée avec des tiers.',
      s6t: 'Stockage local',
      s6: 'Les transcriptions et les paramètres sont stockés localement sur votre appareil. Vous pouvez consulter, exporter ou supprimer vos données à tout moment.',
      s7t: 'Analytique',
      s7: 'Echo ne collecte pas de données d\'utilisation ni de télémétrie. Vos habitudes d\'utilisation ne sont ni suivies ni enregistrées.',
      s8t: 'Modifications de cette politique',
      s8: 'Toute modification de cette politique de confidentialité sera incluse dans les mises à jour de l\'application. Nous ne mettrons jamais en place de collecte de données sans votre consentement explicite.'
    }
  }
  return strings[locale] || strings['en']
}

function getDirSize(dirPath: string): number {
  if (!existsSync(dirPath)) return 0
  let total = 0
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name)
      if (entry.isDirectory()) {
        total += getDirSize(fullPath)
      } else {
        total += statSync(fullPath).size
      }
    }
  } catch { /* ignore permission errors */ }
  return total
}

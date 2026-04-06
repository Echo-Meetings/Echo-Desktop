import { ipcMain, shell } from 'electron'
import { app } from 'electron'

const GITHUB_REPO = 'Echo-Meetings/Echo-Desktop'

interface GitHubRelease {
  tag_name: string
  html_url: string
}

function compareVersions(current: string, latest: string): number {
  const a = current.replace(/^v/, '').split('.').map(Number)
  const b = latest.replace(/^v/, '').split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((b[i] || 0) > (a[i] || 0)) return 1
    if ((b[i] || 0) < (a[i] || 0)) return -1
  }
  return 0
}

export function registerUpdateIpc(): void {
  ipcMain.handle('update:check', async () => {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
        {
          headers: { 'User-Agent': `Echo-Desktop/${app.getVersion()}` }
        }
      )
      if (!response.ok) {
        return { error: `GitHub API returned ${response.status}` }
      }
      const release = (await response.json()) as GitHubRelease
      const currentVersion = app.getVersion()
      const latestVersion = release.tag_name.replace(/^v/, '')
      const hasUpdate = compareVersions(currentVersion, latestVersion) > 0
      return {
        hasUpdate,
        currentVersion,
        latestVersion,
        releaseUrl: release.html_url
      }
    } catch (err) {
      return { error: (err as Error).message }
    }
  })

  ipcMain.handle('update:openRelease', (_event, url: string) => {
    shell.openExternal(url)
  })

  ipcMain.handle('update:getVersion', () => {
    return app.getVersion()
  })
}

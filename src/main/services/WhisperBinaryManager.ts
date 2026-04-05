import { existsSync, mkdirSync, createWriteStream, chmodSync, unlinkSync, readdirSync, renameSync, rmdirSync } from 'fs'
import { join } from 'path'
import { get as httpsGet } from 'https'
import { IncomingMessage } from 'http'
import { execSync } from 'child_process'
import { locateWhisperCli, locateFFmpeg, locateFFprobe, getWhisperBinDir } from './BinaryPaths'

const WHISPER_VERSION = '1.8.4'

// FFmpeg release from BtbN — reliable, up-to-date, includes ffmpeg + ffprobe
const FFMPEG_WIN64_URL = 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip'

function getWhisperDownloadInfo(): { url: string; archiveType: 'zip' | 'tar.gz'; binariesInDir: string } | null {
  if (process.platform === 'win32') {
    return {
      url: `https://github.com/ggml-org/whisper.cpp/releases/download/v${WHISPER_VERSION}/whisper-bin-x64.zip`,
      archiveType: 'zip',
      binariesInDir: 'Release'
    }
  }
  return null
}

export class WhisperBinaryManager {
  private binDir: string

  constructor() {
    this.binDir = getWhisperBinDir()
  }

  isAvailable(): boolean {
    return locateWhisperCli() !== null
  }

  isFFmpegAvailable(): boolean {
    return locateFFmpeg() !== null
  }

  getInstallInstructions(): string {
    if (process.platform === 'darwin') {
      return 'Install whisper-cli via Homebrew:\n  brew install whisper-cpp'
    }
    if (process.platform === 'linux') {
      return 'Install whisper.cpp from source:\n  git clone https://github.com/ggerganov/whisper.cpp\n  cd whisper.cpp && make'
    }
    return 'whisper-cli not found'
  }

  canAutoDownload(): boolean {
    return getWhisperDownloadInfo() !== null
  }

  canAutoDownloadFFmpeg(): boolean {
    return process.platform === 'win32'
  }

  /**
   * Download whisper-cli binary for Windows.
   */
  async download(onProgress: (fraction: number) => void): Promise<string> {
    const existing = locateWhisperCli()
    if (existing) {
      onProgress(1)
      return existing
    }

    const info = getWhisperDownloadInfo()
    if (!info) throw new Error(this.getInstallInstructions())

    if (!existsSync(this.binDir)) mkdirSync(this.binDir, { recursive: true })

    const archivePath = join(this.binDir, 'whisper-download.zip')
    await this.downloadFile(info.url, archivePath, onProgress)

    onProgress(0.9)
    this.extractZip(archivePath, this.binDir)
    this.flattenDir(this.binDir, info.binariesInDir)
    try { unlinkSync(archivePath) } catch { /* ok */ }

    const whisperPath = locateWhisperCli()
    if (!whisperPath) throw new Error('whisper-cli download succeeded but binary not found after extraction')

    onProgress(1)
    return whisperPath
  }

  /**
   * Download ffmpeg + ffprobe for Windows.
   * The BtbN build archive has: ffmpeg-master-latest-win64-gpl/bin/ffmpeg.exe + ffprobe.exe
   */
  async downloadFFmpeg(onProgress: (fraction: number) => void): Promise<void> {
    if (locateFFmpeg() && locateFFprobe()) {
      onProgress(1)
      return
    }

    if (!this.canAutoDownloadFFmpeg()) {
      throw new Error('Auto-download of ffmpeg is only supported on Windows. Install ffmpeg via your package manager.')
    }

    if (!existsSync(this.binDir)) mkdirSync(this.binDir, { recursive: true })

    const archivePath = join(this.binDir, 'ffmpeg-download.zip')
    await this.downloadFile(FFMPEG_WIN64_URL, archivePath, onProgress)

    onProgress(0.9)
    this.extractZip(archivePath, this.binDir)

    // Find the extracted directory (name varies: ffmpeg-master-latest-win64-gpl)
    const extracted = readdirSync(this.binDir).find(
      (f) => f.startsWith('ffmpeg-') && existsSync(join(this.binDir, f, 'bin'))
    )
    if (extracted) {
      const binSrc = join(this.binDir, extracted, 'bin')
      // Copy ffmpeg.exe and ffprobe.exe to binDir
      for (const exe of ['ffmpeg.exe', 'ffprobe.exe']) {
        const src = join(binSrc, exe)
        const dst = join(this.binDir, exe)
        if (existsSync(src)) {
          try { if (existsSync(dst)) unlinkSync(dst) } catch { /* ok */ }
          try { renameSync(src, dst) } catch { /* ok */ }
        }
      }
      // Clean up extracted directory
      try { execSync(`rmdir /s /q "${join(this.binDir, extracted)}"`, { stdio: 'ignore' }) } catch { /* ok */ }
    }

    try { unlinkSync(archivePath) } catch { /* ok */ }
    onProgress(1)
  }

  private downloadFile(url: string, destPath: string, onProgress: (fraction: number) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const downloadWithRedirects = (downloadUrl: string, redirectCount = 0): void => {
        if (redirectCount > 10) {
          reject(new Error('Too many redirects'))
          return
        }

        httpsGet(downloadUrl, (response: IncomingMessage) => {
          if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            downloadWithRedirects(response.headers.location, redirectCount + 1)
            return
          }

          if (response.statusCode !== 200) {
            reject(new Error(`Download failed with status ${response.statusCode}`))
            return
          }

          const totalBytes = parseInt(response.headers['content-length'] || '0', 10) || 80_000_000
          let downloadedBytes = 0
          const fileStream = createWriteStream(destPath)

          response.on('data', (chunk: Buffer) => {
            downloadedBytes += chunk.length
            onProgress(Math.min(downloadedBytes / totalBytes, 1) * 0.85)
          })

          response.pipe(fileStream)
          fileStream.on('finish', () => { fileStream.close(); resolve() })
          fileStream.on('error', (err) => { fileStream.close(); reject(err) })
        }).on('error', reject)
      }

      downloadWithRedirects(url)
    })
  }

  private extractZip(archivePath: string, destDir: string): void {
    if (process.platform === 'win32') {
      execSync(`powershell -command "Expand-Archive -Path '${archivePath}' -DestinationPath '${destDir}' -Force"`)
    } else {
      execSync(`unzip -o "${archivePath}" -d "${destDir}"`)
    }
  }

  private flattenDir(destDir: string, subDirName: string): void {
    const subDir = join(destDir, subDirName)
    if (!existsSync(subDir)) return

    const files = readdirSync(subDir)
    for (const file of files) {
      const src = join(subDir, file)
      const dst = join(destDir, file)
      try {
        if (existsSync(dst)) unlinkSync(dst)
        renameSync(src, dst)
      } catch { /* ok */ }
    }
    try { rmdirSync(subDir) } catch { /* ok */ }

    // Make binaries executable on Unix
    if (process.platform !== 'win32') {
      for (const name of ['whisper-cli', 'ffmpeg', 'ffprobe']) {
        const binPath = join(destDir, name)
        if (existsSync(binPath)) chmodSync(binPath, 0o755)
      }
    }
  }
}

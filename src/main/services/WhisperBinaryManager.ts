import { existsSync, mkdirSync, createWriteStream, chmodSync, unlinkSync, readdirSync, renameSync, rmdirSync, statSync, readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { get as httpsGet } from 'https'
import { IncomingMessage } from 'http'
import { execSync } from 'child_process'
import { locateWhisperCli, locateFFmpeg, locateFFprobe, getWhisperBinDir } from './BinaryPaths'

const WHISPER_VERSION = '1.8.4'

/** DLLs expected alongside whisper-cli.exe in the download package */
const WHISPER_EXPECTED_DLLS = ['whisper.dll', 'ggml.dll', 'ggml-base.dll', 'ggml-cpu.dll']
/** Optional GPU DLLs — present when built with Vulkan support */
const WHISPER_GPU_DLLS = ['ggml-vulkan.dll']

export interface DiagnosticResult {
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

// FFmpeg release from BtbN — reliable, up-to-date, includes ffmpeg + ffprobe
const FFMPEG_WIN64_URL = 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip'

const VC_REDIST_URLS: Record<string, string> = {
  x64: 'https://aka.ms/vs/17/release/vc_redist.x64.exe',
  arm64: 'https://aka.ms/vs/17/release/vc_redist.arm64.exe'
}

function getVcRedistUrl(): string {
  return VC_REDIST_URLS[process.arch] || VC_REDIST_URLS['x64']
}

function getWhisperDownloadInfo(): { url: string; archiveType: 'zip' | 'tar.gz'; binariesInDir: string } | null {
  const echoRelease = 'https://github.com/Echo-Meetings/Echo-Desktop/releases/latest/download'

  if (process.platform === 'win32') {
    if (process.arch === 'arm64') {
      return {
        url: `${echoRelease}/whisper-bin-arm64-windows.zip`,
        archiveType: 'zip',
        binariesInDir: ''
      }
    }
    return {
      url: `${echoRelease}/whisper-bin-x64-windows.zip`,
      archiveType: 'zip',
      binariesInDir: ''
    }
  }

  if (process.platform === 'darwin') {
    return {
      url: `${echoRelease}/whisper-bin-universal-macos.tar.gz`,
      archiveType: 'tar.gz',
      binariesInDir: ''
    }
  }

  if (process.platform === 'linux' && process.arch === 'x64') {
    return {
      url: `${echoRelease}/whisper-bin-x64-linux.tar.gz`,
      archiveType: 'tar.gz',
      binariesInDir: ''
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

  /**
   * On ARM64 Windows, check if the installed whisper binary is the wrong architecture (x64).
   * x64 binaries crash with ACCESS_VIOLATION on ARM64 due to AVX/SSE instructions.
   * Returns true if the binary needs to be replaced.
   */
  needsArchFix(): boolean {
    if (process.platform !== 'win32' || process.arch !== 'arm64') return false
    const whisperPath = locateWhisperCli()
    if (!whisperPath) return false

    const markerPath = join(this.binDir, '.whisper-arch')
    try {
      if (existsSync(markerPath)) {
        const marker = readFileSync(markerPath, 'utf-8').trim()
        return marker !== 'arm64'
      }
    } catch { /* ok */ }
    // No marker = old download (was x64), needs replacement with native ARM64 build
    return true
  }

  /**
   * Check if the installed whisper binary needs upgrading to a GPU-enabled build.
   * Returns true if the current binary is CPU-only and should be replaced.
   */
  needsGpuUpgrade(): boolean {
    const whisperPath = locateWhisperCli()
    if (!whisperPath) return false

    const gpuMarkerPath = join(this.binDir, '.whisper-gpu')
    try {
      if (existsSync(gpuMarkerPath)) {
        const marker = readFileSync(gpuMarkerPath, 'utf-8').trim()
        return marker === 'cpu' || marker === 'none'
      }
    } catch { /* ok */ }
    // No GPU marker = old CPU-only download, needs GPU upgrade
    return true
  }

  /**
   * Detect what GPU backend the installed whisper binary supports.
   */
  detectGpuSupport(): 'vulkan' | 'metal' | 'none' {
    const whisperPath = locateWhisperCli()
    if (!whisperPath) return 'none'

    const whisperDir = dirname(whisperPath)

    if (process.platform === 'darwin') {
      // Metal: check for embedded library or shader file
      if (existsSync(join(whisperDir, 'ggml-metal.metal')) ||
          existsSync(join(whisperDir, 'ggml-metal.metallib'))) {
        return 'metal'
      }
      // Metal can also be embedded in the binary via GGML_METAL_EMBED_LIBRARY
      // In that case no external file is needed — check GPU marker
      const gpuMarkerPath = join(this.binDir, '.whisper-gpu')
      try {
        if (existsSync(gpuMarkerPath)) {
          const marker = readFileSync(gpuMarkerPath, 'utf-8').trim()
          if (marker === 'metal') return 'metal'
        }
      } catch { /* ok */ }
      return 'none'
    }

    if (process.platform === 'win32') {
      // Vulkan: check for ggml-vulkan.dll
      for (const dll of WHISPER_GPU_DLLS) {
        if (existsSync(join(whisperDir, dll))) return 'vulkan'
      }
      return 'none'
    }

    if (process.platform === 'linux') {
      // Vulkan: check for libggml-vulkan.so
      const files = readdirSync(whisperDir)
      if (files.some(f => f.includes('ggml-vulkan'))) return 'vulkan'
      return 'none'
    }

    return 'none'
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
  async download(onProgress: (fraction: number) => void, force = false): Promise<string> {
    if (!force) {
      const existing = locateWhisperCli()
      if (existing) {
        onProgress(1)
        return existing
      }
    }
    // Delete old binary before re-downloading (only when force=true)
    if (force) this.deleteWhisperBinary()

    const info = getWhisperDownloadInfo()
    if (!info) throw new Error(this.getInstallInstructions())

    if (!existsSync(this.binDir)) mkdirSync(this.binDir, { recursive: true })

    const ext = info.archiveType === 'tar.gz' ? 'tar.gz' : 'zip'
    const archivePath = join(this.binDir, `whisper-download.${ext}`)
    await this.downloadFile(info.url, archivePath, onProgress)

    onProgress(0.9)
    if (info.archiveType === 'tar.gz') {
      this.extractTarGz(archivePath, this.binDir)
    } else {
      this.extractZip(archivePath, this.binDir)
    }
    this.flattenDir(this.binDir, info.binariesInDir)
    try { unlinkSync(archivePath) } catch { /* ok */ }

    const whisperPath = locateWhisperCli()
    if (!whisperPath) throw new Error('whisper-cli download succeeded but binary not found after extraction')

    // Write arch marker so we can detect wrong-arch binaries later
    const variant = process.arch === 'arm64' ? 'arm64' : 'x64'
    try { writeFileSync(join(this.binDir, '.whisper-arch'), variant) } catch { /* ok */ }

    // Write GPU marker — detect from extracted files (handles ARM64 Windows with no Vulkan)
    const gpuVariant = this.detectGpuSupport()
    try { writeFileSync(join(this.binDir, '.whisper-gpu'), gpuVariant) } catch { /* ok */ }

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

  /**
   * Run diagnostics on whisper-cli and its dependencies.
   * Checks binary presence, DLLs, VC++ runtime, ffmpeg.
   */
  diagnose(): DiagnosticResult {
    const whisperPath = locateWhisperCli()
    const ffmpegPath = locateFFmpeg()

    let whisperBinaryValid = false
    let missingDlls: string[] = []
    let vcRuntimeInstalled = true

    if (whisperPath) {
      // Check binary is not empty
      try {
        const stat = statSync(whisperPath)
        whisperBinaryValid = stat.size > 0
      } catch {
        whisperBinaryValid = false
      }

      // Check companion DLLs (Windows only)
      if (process.platform === 'win32') {
        const whisperDir = dirname(whisperPath)
        missingDlls = WHISPER_EXPECTED_DLLS.filter(
          (dll) => !existsSync(join(whisperDir, dll))
        )
      }
    }

    // Check VC++ Runtime (Windows only)
    if (process.platform === 'win32') {
      const sys32 = 'C:\\Windows\\System32'
      vcRuntimeInstalled = existsSync(join(sys32, 'vcruntime140.dll')) &&
        existsSync(join(sys32, 'msvcp140.dll'))
    }

    const gpuBackend = this.detectGpuSupport()

    const ok = !!whisperPath && whisperBinaryValid && missingDlls.length === 0 &&
      vcRuntimeInstalled && !!ffmpegPath

    return {
      ok,
      whisperInstalled: !!whisperPath,
      whisperBinaryValid,
      ffmpegInstalled: !!ffmpegPath,
      vcRuntimeInstalled,
      missingDlls,
      arch: process.arch,
      platform: process.platform,
      whisperPath,
      ffmpegPath,
      whisperVersion: WHISPER_VERSION,
      gpuBackend
    }
  }

  /**
   * Delete the downloaded whisper-cli binary and companion DLLs.
   * Used for manual reinstallation from Settings UI.
   */
  deleteWhisperBinary(): void {
    const binDir = getWhisperBinDir()
    if (!existsSync(binDir)) return

    try {
      const files = readdirSync(binDir)
      for (const f of files) {
        if (f === 'whisper-cli.exe' || f === 'whisper-cli' || f.endsWith('.dll') || f === '.whisper-arch' || f === '.whisper-gpu' || f.endsWith('.metal') || f.endsWith('.metallib')) {
          try { unlinkSync(join(binDir, f)) } catch { /* ok */ }
        }
      }
    } catch { /* ok */ }
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

  /**
   * Check if VC++ Runtime is installed (Windows only).
   */
  checkVcRuntime(): { installed: boolean; downloadUrl: string } {
    if (process.platform !== 'win32') {
      return { installed: true, downloadUrl: '' }
    }
    const sys32 = 'C:\\Windows\\System32'
    const installed = existsSync(join(sys32, 'vcruntime140.dll')) &&
      existsSync(join(sys32, 'msvcp140.dll'))
    return { installed, downloadUrl: getVcRedistUrl() }
  }

  private extractTarGz(archivePath: string, destDir: string): void {
    execSync(`tar xzf "${archivePath}" -C "${destDir}"`)
    // Remove macOS quarantine attributes so the binary can run
    if (process.platform === 'darwin') {
      try { execSync(`xattr -cr "${destDir}"`) } catch { /* ok */ }
    }
  }

  private extractZip(archivePath: string, destDir: string): void {
    if (process.platform === 'win32') {
      execSync(`powershell -command "Expand-Archive -Path '${archivePath}' -DestinationPath '${destDir}' -Force"`)
    } else {
      execSync(`unzip -o "${archivePath}" -d "${destDir}"`)
    }
  }

  private flattenDir(destDir: string, subDirName: string): void {
    if (!subDirName) return // flat archive, nothing to flatten
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

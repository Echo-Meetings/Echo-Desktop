import { existsSync } from 'fs'
import { join, dirname } from 'path'
import { app } from 'electron'

/**
 * Resolve the path to a binary from an npm package, handling both dev and packaged Electron.
 * In packaged apps, node_modules is inside app.asar — asarUnpack extracts binaries to app.asar.unpacked.
 */
function resolveUnpackedPath(modulePath: string): string {
  if (!app.isPackaged) return modulePath
  return modulePath.replace('app.asar', 'app.asar.unpacked')
}

/**
 * Locate the ffmpeg binary.
 * Priority: downloaded in userData → ffmpeg-static (bundled) → system paths
 */
export function locateFFmpeg(): string | null {
  // 1. Downloaded binary in app data (used on Windows cross-compiled builds)
  const binDir = getWhisperBinDir() // shared bin dir
  const ffmpegName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
  const downloadedPath = join(binDir, ffmpegName)
  if (existsSync(downloadedPath)) return downloadedPath

  // 2. Bundled via ffmpeg-static
  try {
    const ffmpegStatic = require('ffmpeg-static') as string
    const resolved = resolveUnpackedPath(ffmpegStatic)
    if (existsSync(resolved)) return resolved
  } catch { /* not available */ }

  // 3. System paths
  const paths = process.platform === 'win32'
    ? [
        'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
        'C:\\ffmpeg\\bin\\ffmpeg.exe'
      ]
    : [
        '/opt/homebrew/bin/ffmpeg',
        '/usr/local/bin/ffmpeg',
        '/usr/bin/ffmpeg'
      ]

  for (const p of paths) {
    if (existsSync(p)) return p
  }
  return null
}

/**
 * Locate the ffprobe binary.
 * Priority: downloaded in userData → ffprobe-static (bundled) → same dir as ffmpeg → system paths
 */
export function locateFFprobe(): string | null {
  // 1. Downloaded binary in app data
  const binDir = getWhisperBinDir()
  const ffprobeName = process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe'
  const downloadedPath = join(binDir, ffprobeName)
  if (existsSync(downloadedPath)) return downloadedPath

  // 2. Bundled via ffprobe-static
  try {
    const ffprobeStatic = require('ffprobe-static') as { path: string }
    const resolved = resolveUnpackedPath(ffprobeStatic.path)
    if (existsSync(resolved)) return resolved
  } catch { /* not available */ }

  // 3. Co-located with ffmpeg
  const ffmpeg = locateFFmpeg()
  if (ffmpeg) {
    const ffprobeNext = join(dirname(ffmpeg), process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe')
    if (existsSync(ffprobeNext)) return ffprobeNext
  }

  // 4. System paths
  const paths = process.platform === 'win32'
    ? [
        'C:\\Program Files\\ffmpeg\\bin\\ffprobe.exe',
        'C:\\ffmpeg\\bin\\ffprobe.exe'
      ]
    : [
        '/opt/homebrew/bin/ffprobe',
        '/usr/local/bin/ffprobe',
        '/usr/bin/ffprobe'
      ]

  for (const p of paths) {
    if (existsSync(p)) return p
  }
  return null
}

/**
 * Locate whisper-cli binary.
 * Priority: downloaded binary in userData → system paths
 */
export function locateWhisperCli(): string | null {
  // 1. Downloaded binary in app data
  const binDir = getWhisperBinDir()
  const exeName = process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli'
  const downloadedPath = join(binDir, exeName)
  if (existsSync(downloadedPath)) return downloadedPath

  // 2. System paths
  if (process.platform === 'win32') {
    const winPaths = [
      'C:\\Program Files\\whisper-cpp\\whisper-cli.exe',
      'C:\\whisper\\whisper-cli.exe'
    ]
    for (const p of winPaths) {
      if (existsSync(p)) return p
    }
  } else {
    const unixPaths = [
      '/opt/homebrew/bin/whisper-cli',
      '/usr/local/bin/whisper-cli',
      '/usr/bin/whisper-cli',
      '/usr/local/bin/whisper',
      '/usr/bin/whisper'
    ]
    for (const p of unixPaths) {
      if (existsSync(p)) return p
    }
  }

  return null
}

/**
 * Directory where downloaded whisper binaries are stored.
 */
export function getWhisperBinDir(): string {
  return join(app.getPath('userData'), 'bin')
}

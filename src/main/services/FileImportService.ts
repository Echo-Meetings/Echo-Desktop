import { existsSync } from 'fs'
import { basename, extname, join } from 'path'
import { tmpdir } from 'os'
import { spawn } from 'child_process'
import { randomUUID } from 'crypto'
import { locateFFmpeg, locateFFprobe } from './BinaryPaths'
import { detectHwEncoder } from './HardwareDetection'

const SUPPORTED_EXTENSIONS = new Set(['mp4', 'mp3', 'webm', 'm4a', 'wav', 'mov', 'ogg', 'mkv', 'm4v', 'opus', 'flac'])
const NEEDS_CONVERSION = new Set(['mkv', 'webm', 'ogg', 'opus', 'flac'])

export type ValidationResult =
  | { status: 'valid'; filePath: string }
  | { status: 'needsConversion'; filePath: string }
  | { status: 'unsupportedFormat' }
  | { status: 'unreadable' }

export function validate(filePath: string): ValidationResult {
  const ext = extname(filePath).slice(1).toLowerCase()
  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    return { status: 'unsupportedFormat' }
  }
  if (!existsSync(filePath)) {
    return { status: 'unreadable' }
  }
  if (NEEDS_CONVERSION.has(ext)) {
    return { status: 'needsConversion', filePath }
  }
  return { status: 'valid', filePath }
}

/**
 * Check if a file has an audio stream using ffprobe.
 */
export async function hasAudioStream(filePath: string): Promise<boolean> {
  const ffprobePath = locateFFprobe()
  if (!ffprobePath) return true // assume yes if we can't check

  return new Promise((resolve) => {
    const proc = spawn(ffprobePath, [
      '-v', 'quiet',
      '-select_streams', 'a:0',
      '-show_entries', 'stream=codec_type',
      '-of', 'csv=p=0',
      filePath
    ])

    let output = ''
    proc.stdout.on('data', (chunk) => { output += chunk.toString() })
    proc.on('close', () => resolve(output.trim().length > 0))
    proc.on('error', () => resolve(true))
  })
}

/**
 * Convert any audio/video to 16kHz mono WAV (optimal for Whisper).
 */
export async function convertToWav(filePath: string): Promise<string> {
  const ffmpegPath = locateFFmpeg()
  if (!ffmpegPath) {
    throw new Error('ffmpeg not found. Please install ffmpeg.')
  }

  // Pre-check: does the file have audio?
  const hasAudio = await hasAudioStream(filePath)
  if (!hasAudio) {
    throw new Error('NO_AUDIO_STREAM')
  }

  const outPath = join(tmpdir(), `echo_${randomUUID()}.wav`)

  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, [
      '-i', filePath,
      '-vn',             // strip video
      '-acodec', 'pcm_s16le',
      '-ar', '16000',    // 16kHz sample rate (Whisper optimal)
      '-ac', '1',        // mono
      '-y',              // overwrite
      outPath
    ])

    let stderr = ''
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString() })

    proc.on('close', (code) => {
      if (code === 0 && existsSync(outPath)) {
        resolve(outPath)
      } else {
        // Parse common ffmpeg errors into friendly messages
        if (stderr.includes('does not contain any stream') || stderr.includes('Output file is empty')) {
          reject(new Error('NO_AUDIO_STREAM'))
        } else if (stderr.includes('Invalid data found')) {
          reject(new Error('CORRUPT_FILE'))
        } else if (stderr.includes('Permission denied')) {
          reject(new Error('PERMISSION_DENIED'))
        } else {
          reject(new Error('CONVERSION_FAILED'))
        }
      }
    })

    proc.on('error', () => reject(new Error('FFMPEG_NOT_WORKING')))
  })
}

/**
 * Convert WebM/OGG to MP4 for playback compatibility.
 * Uses hardware encoder (NVENC/AMF/QSV/VideoToolbox) when available.
 */
export async function convertToMp4(inputPath: string, outputPath: string): Promise<void> {
  const ffmpegPath = locateFFmpeg()
  if (!ffmpegPath) throw new Error('ffmpeg not found')

  const { h264Encoder } = detectHwEncoder(ffmpegPath)
  const encoderArgs = getEncoderArgs(h264Encoder, 'fast')

  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, [
      '-i', inputPath,
      '-c:v', h264Encoder,
      ...encoderArgs,
      '-c:a', 'aac',
      '-threads', '2',
      '-y',
      outputPath
    ])

    let stderr = ''
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString() })

    proc.on('close', (code) => {
      if (code === 0) { resolve(); return }
      // Fallback to software encoder if HW encoder fails
      if (h264Encoder !== 'libx264') {
        console.warn(`[ffmpeg] HW encoder ${h264Encoder} failed, falling back to libx264`)
        const fallback = spawn(ffmpegPath, [
          '-i', inputPath,
          '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28',
          '-c:a', 'aac', '-threads', '2', '-y', outputPath
        ])
        fallback.on('close', (c) => {
          if (c === 0) resolve()
          else reject(new Error(`ffmpeg mp4 conversion failed (code ${c})`))
        })
        fallback.on('error', reject)
      } else {
        reject(new Error(`ffmpeg mp4 conversion failed (code ${code})`))
      }
    })
    proc.on('error', reject)
  })
}

/**
 * Generate a thumbnail from a video file.
 */
export async function generateThumbnail(videoPath: string, outputPath: string): Promise<boolean> {
  const ffmpegPath = locateFFmpeg()
  if (!ffmpegPath) return false

  return new Promise((resolve) => {
    const proc = spawn(ffmpegPath, [
      '-i', videoPath,
      '-ss', '2',
      '-frames:v', '1',
      '-vf', 'scale=176:-1',
      '-y',
      outputPath
    ])

    proc.on('close', (code) => resolve(code === 0))
    proc.on('error', () => resolve(false))
  })
}

const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'webm', 'mkv', 'm4v'])

/**
 * Check if a file is a video (not audio-only).
 */
export function isVideoFile(filePath: string): boolean {
  const ext = extname(filePath).slice(1).toLowerCase()
  return VIDEO_EXTENSIONS.has(ext)
}

/**
 * Check if a video uses HEVC (H.265) codec which Chromium can't play.
 * Uses ffprobe to detect the actual codec regardless of container format.
 */
export function checkIsHevc(filePath: string): Promise<boolean> {
  const ffprobePath = locateFFprobe()
  if (!ffprobePath) return Promise.resolve(false)

  return new Promise((resolve) => {
    const proc = spawn(ffprobePath, [
      '-v', 'quiet',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=codec_name',
      '-of', 'csv=p=0',
      filePath
    ])

    let output = ''
    proc.stdout.on('data', (chunk) => { output += chunk.toString() })
    proc.on('close', () => {
      const codec = output.trim().toLowerCase()
      resolve(codec === 'hevc' || codec === 'h265')
    })
    proc.on('error', () => resolve(false))
  })
}

/**
 * Convert any video to H.264 MP4 for Chromium playback compatibility.
 * HEVC (H.265) MOV files from iPhones are not supported by Chromium.
 * Uses hardware encoder (NVENC/AMF/QSV/VideoToolbox) when available for 5-10x speedup.
 */
export async function convertVideoForPlayback(inputPath: string, outputPath: string): Promise<void> {
  const ffmpegPath = locateFFmpeg()
  if (!ffmpegPath) throw new Error('ffmpeg not found')

  const { h264Encoder } = detectHwEncoder(ffmpegPath)
  const encoderArgs = getEncoderArgs(h264Encoder, 'balanced')

  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, [
      '-i', inputPath,
      '-c:v', h264Encoder,
      ...encoderArgs,
      '-c:a', 'aac',
      '-movflags', '+faststart',
      '-y',
      outputPath
    ])

    let stderr = ''
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString() })

    proc.on('close', (code) => {
      if (code === 0) { resolve(); return }
      // Fallback to software encoder if HW encoder fails
      if (h264Encoder !== 'libx264') {
        console.warn(`[ffmpeg] HW encoder ${h264Encoder} failed, falling back to libx264`)
        const fallback = spawn(ffmpegPath, [
          '-i', inputPath,
          '-c:v', 'libx264', '-crf', '23', '-preset', 'fast',
          '-c:a', 'aac', '-movflags', '+faststart', '-y', outputPath
        ])
        let fallbackStderr = ''
        fallback.stderr.on('data', (chunk) => { fallbackStderr += chunk.toString() })
        fallback.on('close', (c) => {
          if (c === 0) resolve()
          else reject(new Error(`Video conversion failed (code ${c}): ${fallbackStderr.slice(-200)}`))
        })
        fallback.on('error', reject)
      } else {
        reject(new Error(`Video conversion failed (code ${code}): ${stderr.slice(-200)}`))
      }
    })
    proc.on('error', reject)
  })
}

/**
 * Remux a video with faststart (moov atom at beginning) without re-encoding.
 * This fixes "demuxer seek failed" errors in Chromium for files with moov at end.
 */
export async function remuxWithFastStart(inputPath: string, outputPath: string): Promise<void> {
  const ffmpegPath = locateFFmpeg()
  if (!ffmpegPath) throw new Error('ffmpeg not found')

  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, [
      '-i', inputPath,
      '-c', 'copy',                  // no re-encoding — very fast
      '-movflags', '+faststart',     // move moov atom to beginning
      '-y',
      outputPath
    ])

    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Remux failed (code ${code})`))
    })
    proc.on('error', reject)
  })
}

export function getDisplayFormats(): string {
  return [...SUPPORTED_EXTENSIONS].join(', ')
}

export function getFileName(filePath: string): string {
  return basename(filePath)
}

/**
 * Get encoder-specific quality/preset args for the detected HW encoder.
 * mode: 'fast' = prioritize speed (for quick conversions), 'balanced' = balance quality/speed
 */
function getEncoderArgs(encoder: string, mode: 'fast' | 'balanced'): string[] {
  switch (encoder) {
    case 'h264_nvenc':
      return mode === 'fast'
        ? ['-preset', 'p1', '-cq', '28']
        : ['-preset', 'p4', '-cq', '23']
    case 'h264_amf':
      return mode === 'fast'
        ? ['-quality', 'speed', '-rc', 'cqp', '-qp', '28']
        : ['-quality', 'balanced', '-rc', 'cqp', '-qp', '23']
    case 'h264_qsv':
      return mode === 'fast'
        ? ['-preset', 'veryfast', '-global_quality', '28']
        : ['-preset', 'medium', '-global_quality', '23']
    case 'h264_videotoolbox':
      return mode === 'fast'
        ? ['-q:v', '65']
        : ['-q:v', '50']
    default: // libx264
      return mode === 'fast'
        ? ['-preset', 'ultrafast', '-crf', '28']
        : ['-preset', 'fast', '-crf', '23']
  }
}

// ffmpeg and ffprobe paths are resolved via BinaryPaths module

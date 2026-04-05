import { existsSync } from 'fs'
import { basename, extname, join } from 'path'
import { tmpdir } from 'os'
import { spawn } from 'child_process'
import { randomUUID } from 'crypto'
import { locateFFmpeg, locateFFprobe } from './BinaryPaths'

const SUPPORTED_EXTENSIONS = new Set(['webm', 'mp4', 'm4v', 'mp3', 'm4a', 'wav', 'mov', 'ogg'])
const NEEDS_CONVERSION = new Set(['webm', 'ogg'])

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
 */
export async function convertToMp4(inputPath: string, outputPath: string): Promise<void> {
  const ffmpegPath = locateFFmpeg()
  if (!ffmpegPath) throw new Error('ffmpeg not found')

  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, [
      '-i', inputPath,
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-preset', 'ultrafast',
      '-crf', '28',
      '-threads', '2',
      '-y',
      outputPath
    ])

    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg mp4 conversion failed (code ${code})`))
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

const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'm4v', 'webm'])

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
 */
export async function convertVideoForPlayback(inputPath: string, outputPath: string): Promise<void> {
  const ffmpegPath = locateFFmpeg()
  if (!ffmpegPath) throw new Error('ffmpeg not found')

  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, [
      '-i', inputPath,
      '-c:v', 'libx264',     // H.264 — universally supported
      '-crf', '23',           // good quality
      '-preset', 'fast',      // balance speed/compression
      '-c:a', 'aac',          // AAC audio
      '-movflags', '+faststart',  // enable streaming playback
      '-y',
      outputPath
    ])

    let stderr = ''
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString() })

    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Video conversion failed (code ${code}): ${stderr.slice(-200)}`))
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

// ffmpeg and ffprobe paths are resolved via BinaryPaths module

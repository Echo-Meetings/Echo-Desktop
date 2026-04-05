import { spawn } from 'child_process'
import { locateFFmpeg } from './BinaryPaths'

/**
 * Extract waveform amplitude data from an audio/video file using ffmpeg.
 * Returns an array of normalized floats [0, 1].
 */
export async function extractWaveform(filePath: string, sampleCount: number): Promise<number[]> {
  const ffmpegPath = locateFFmpeg()
  if (!ffmpegPath) return new Array(sampleCount).fill(0.1)

  return new Promise((resolve) => {
    // Use ffmpeg to output raw PCM audio data
    const proc = spawn(ffmpegPath, [
      '-i', filePath,
      '-vn',
      '-acodec', 'pcm_s16le',
      '-ar', '8000',    // Low sample rate for fast processing
      '-ac', '1',       // Mono
      '-f', 's16le',    // Raw 16-bit PCM
      'pipe:1'          // Output to stdout
    ])

    const chunks: Buffer[] = []
    proc.stdout.on('data', (chunk: Buffer) => chunks.push(chunk))

    proc.on('close', (code) => {
      if (code !== 0 || chunks.length === 0) {
        resolve(new Array(sampleCount).fill(0.1))
        return
      }

      const pcmData = Buffer.concat(chunks)
      const samples = new Int16Array(pcmData.buffer, pcmData.byteOffset, Math.floor(pcmData.length / 2))

      if (samples.length === 0) {
        resolve(new Array(sampleCount).fill(0.1))
        return
      }

      // Downsample to requested count
      const chunkSize = Math.floor(samples.length / sampleCount)
      const waveform: number[] = []

      for (let i = 0; i < sampleCount; i++) {
        const start = i * chunkSize
        const end = Math.min(start + chunkSize, samples.length)
        let maxAmp = 0
        for (let j = start; j < end; j++) {
          const amp = Math.abs(samples[j])
          if (amp > maxAmp) maxAmp = amp
        }
        waveform.push(maxAmp / 32768) // Normalize to [0, 1]
      }

      resolve(waveform)
    })

    proc.on('error', () => {
      resolve(new Array(sampleCount).fill(0.1))
    })
  })
}

// ffmpeg path is resolved via BinaryPaths module

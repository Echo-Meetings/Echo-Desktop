import { existsSync, mkdirSync, createWriteStream, statSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { get as httpsGet } from 'https'
import { IncomingMessage } from 'http'

// Large V3 Turbo — best quality, ~1.5GB, downloaded once
const MODEL_FILENAME = 'ggml-large-v3-turbo.bin'
const MODEL_URL = `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${MODEL_FILENAME}`
const MODEL_SIZE_BYTES = 1_620_000_000 // ~1.6 GB

export class ModelManager {
  private modelsDir: string
  private modelPath: string

  constructor() {
    this.modelsDir = join(app.getPath('userData'), 'models')
    this.modelPath = join(this.modelsDir, MODEL_FILENAME)
  }

  getModelPath(): string {
    return this.modelPath
  }

  isModelDownloaded(): boolean {
    if (!existsSync(this.modelPath)) return false
    // Check file is reasonably sized (not a partial download)
    try {
      const stat = statSync(this.modelPath)
      return stat.size > 100_000_000 // at least 100MB
    } catch {
      return false
    }
  }

  async downloadModel(onProgress: (fraction: number) => void): Promise<string> {
    if (this.isModelDownloaded()) {
      onProgress(1)
      return this.modelPath
    }

    if (!existsSync(this.modelsDir)) {
      mkdirSync(this.modelsDir, { recursive: true })
    }

    return new Promise((resolve, reject) => {
      const downloadWithRedirects = (url: string, redirectCount = 0): void => {
        if (redirectCount > 5) {
          reject(new Error('Too many redirects'))
          return
        }

        httpsGet(url, (response: IncomingMessage) => {
          // Handle redirects (HuggingFace uses them)
          if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            downloadWithRedirects(response.headers.location, redirectCount + 1)
            return
          }

          if (response.statusCode !== 200) {
            reject(new Error(`Download failed with status ${response.statusCode}`))
            return
          }

          const totalBytes = parseInt(response.headers['content-length'] || '0', 10) || MODEL_SIZE_BYTES
          let downloadedBytes = 0

          const fileStream = createWriteStream(this.modelPath)

          response.on('data', (chunk: Buffer) => {
            downloadedBytes += chunk.length
            onProgress(Math.min(downloadedBytes / totalBytes, 0.99))
          })

          response.pipe(fileStream)

          fileStream.on('finish', () => {
            fileStream.close()
            onProgress(1)
            resolve(this.modelPath)
          })

          fileStream.on('error', (err) => {
            fileStream.close()
            reject(err)
          })
        }).on('error', reject)
      }

      downloadWithRedirects(MODEL_URL)
    })
  }
}

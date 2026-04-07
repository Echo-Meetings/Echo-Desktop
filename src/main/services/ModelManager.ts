import { existsSync, mkdirSync, createWriteStream, statSync, unlinkSync, readdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { get as httpsGet } from 'https'
import { IncomingMessage } from 'http'

export interface ModelDefinition {
  id: string
  filename: string
  url: string
  sizeBytes: number
  /** Approximate RAM needed during inference */
  ramRequiredMB: number
  labelKey: string
  accuracy: 'low' | 'medium-low' | 'medium' | 'high' | 'very-high'
  /** Relative speed vs large-v3-turbo (higher = faster) */
  speedMultiplier: number
  multilingual: boolean
}

const HF_BASE = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main'

export const MODEL_REGISTRY: ModelDefinition[] = [
  {
    id: 'tiny',
    filename: 'ggml-tiny.bin',
    url: `${HF_BASE}/ggml-tiny.bin`,
    sizeBytes: 75_000_000,
    ramRequiredMB: 400,
    labelKey: 'modelTiny',
    accuracy: 'low',
    speedMultiplier: 10,
    multilingual: true
  },
  {
    id: 'base',
    filename: 'ggml-base.bin',
    url: `${HF_BASE}/ggml-base.bin`,
    sizeBytes: 142_000_000,
    ramRequiredMB: 500,
    labelKey: 'modelBase',
    accuracy: 'medium-low',
    speedMultiplier: 7,
    multilingual: true
  },
  {
    id: 'small',
    filename: 'ggml-small.bin',
    url: `${HF_BASE}/ggml-small.bin`,
    sizeBytes: 466_000_000,
    ramRequiredMB: 1000,
    labelKey: 'modelSmall',
    accuracy: 'medium',
    speedMultiplier: 4,
    multilingual: true
  },
  {
    id: 'medium',
    filename: 'ggml-medium.bin',
    url: `${HF_BASE}/ggml-medium.bin`,
    sizeBytes: 1_530_000_000,
    ramRequiredMB: 2500,
    labelKey: 'modelMedium',
    accuracy: 'high',
    speedMultiplier: 2,
    multilingual: true
  },
  {
    id: 'large-v3-turbo',
    filename: 'ggml-large-v3-turbo.bin',
    url: `${HF_BASE}/ggml-large-v3-turbo.bin`,
    sizeBytes: 1_620_000_000,
    ramRequiredMB: 3000,
    labelKey: 'modelLargeV3Turbo',
    accuracy: 'very-high',
    speedMultiplier: 1,
    multilingual: true
  },
  {
    id: 'large-v3-turbo-q5',
    filename: 'ggml-large-v3-turbo-q5_0.bin',
    url: `${HF_BASE}/ggml-large-v3-turbo-q5_0.bin`,
    sizeBytes: 600_000_000,
    ramRequiredMB: 1200,
    labelKey: 'modelLargeV3TurboQ5',
    accuracy: 'very-high',
    speedMultiplier: 1.4,
    multilingual: true
  }
]

const DEFAULT_MODEL_ID = 'large-v3-turbo'

export class ModelManager {
  private modelsDir: string
  private activeModelId: string = DEFAULT_MODEL_ID

  constructor() {
    this.modelsDir = join(app.getPath('userData'), 'models')
  }

  getAvailableModels(): ModelDefinition[] {
    return MODEL_REGISTRY
  }

  getActiveModelId(): string {
    return this.activeModelId
  }

  setActiveModelId(id: string): void {
    const model = MODEL_REGISTRY.find((m) => m.id === id)
    if (!model) return
    this.activeModelId = id
  }

  getActiveModel(): ModelDefinition {
    return MODEL_REGISTRY.find((m) => m.id === this.activeModelId) || MODEL_REGISTRY.find((m) => m.id === DEFAULT_MODEL_ID)!
  }

  getModelPath(modelId?: string): string {
    const id = modelId || this.activeModelId
    const model = MODEL_REGISTRY.find((m) => m.id === id)
    if (!model) return join(this.modelsDir, MODEL_REGISTRY.find((m) => m.id === DEFAULT_MODEL_ID)!.filename)
    return join(this.modelsDir, model.filename)
  }

  isModelDownloaded(modelId?: string): boolean {
    const id = modelId || this.activeModelId
    const model = MODEL_REGISTRY.find((m) => m.id === id)
    if (!model) return false

    const modelPath = join(this.modelsDir, model.filename)
    if (!existsSync(modelPath)) return false
    try {
      const stat = statSync(modelPath)
      return stat.size >= model.sizeBytes * 0.9
    } catch {
      return false
    }
  }

  /**
   * Get download status for all models (which ones are downloaded).
   */
  getDownloadedModels(): Record<string, boolean> {
    const result: Record<string, boolean> = {}
    for (const model of MODEL_REGISTRY) {
      result[model.id] = this.isModelDownloaded(model.id)
    }
    return result
  }

  deleteModel(modelId?: string): void {
    const id = modelId || this.activeModelId
    const model = MODEL_REGISTRY.find((m) => m.id === id)
    if (!model) return
    const modelPath = join(this.modelsDir, model.filename)
    try {
      if (existsSync(modelPath)) unlinkSync(modelPath)
    } catch { /* ignore */ }
  }

  /**
   * Get total disk usage of all downloaded models.
   */
  getModelsDiskUsage(): number {
    if (!existsSync(this.modelsDir)) return 0
    let total = 0
    try {
      for (const file of readdirSync(this.modelsDir)) {
        try { total += statSync(join(this.modelsDir, file)).size } catch { /* ok */ }
      }
    } catch { /* ok */ }
    return total
  }

  async downloadModel(onProgress: (fraction: number) => void, modelId?: string): Promise<string> {
    const id = modelId || this.activeModelId
    const model = MODEL_REGISTRY.find((m) => m.id === id)
    if (!model) throw new Error(`Unknown model: ${id}`)

    if (this.isModelDownloaded(id)) {
      onProgress(1)
      return this.getModelPath(id)
    }

    if (!existsSync(this.modelsDir)) {
      mkdirSync(this.modelsDir, { recursive: true })
    }

    const modelPath = join(this.modelsDir, model.filename)

    return new Promise((resolve, reject) => {
      const downloadWithRedirects = (url: string, redirectCount = 0): void => {
        if (redirectCount > 5) {
          reject(new Error('Too many redirects'))
          return
        }

        httpsGet(url, (response: IncomingMessage) => {
          if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            downloadWithRedirects(response.headers.location, redirectCount + 1)
            return
          }

          if (response.statusCode !== 200) {
            reject(new Error(`Download failed with status ${response.statusCode}`))
            return
          }

          const totalBytes = parseInt(response.headers['content-length'] || '0', 10) || model.sizeBytes
          let downloadedBytes = 0

          const fileStream = createWriteStream(modelPath)

          response.on('data', (chunk: Buffer) => {
            downloadedBytes += chunk.length
            onProgress(Math.min(downloadedBytes / totalBytes, 0.99))
          })

          response.pipe(fileStream)

          fileStream.on('finish', () => {
            fileStream.close()
            try {
              const finalSize = statSync(modelPath).size
              if (finalSize < model.sizeBytes * 0.9) {
                try { unlinkSync(modelPath) } catch { /* ok */ }
                reject(new Error(`Model download incomplete: got ${Math.round(finalSize / 1e6)}MB, expected ~${Math.round(model.sizeBytes / 1e6)}MB`))
                return
              }
            } catch { /* stat failed, let it pass */ }
            onProgress(1)
            resolve(modelPath)
          })

          fileStream.on('error', (err) => {
            fileStream.close()
            reject(err)
          })
        }).on('error', reject)
      }

      downloadWithRedirects(model.url)
    })
  }
}

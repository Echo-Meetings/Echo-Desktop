import {
  existsSync, mkdirSync, writeFileSync, readFileSync,
  readdirSync, unlinkSync, copyFileSync, statSync, renameSync
} from 'fs'
import { readdir, readFile } from 'fs/promises'
import { join, extname, basename } from 'path'
import { app } from 'electron'
import { randomUUID } from 'crypto'
import type { TranscriptResult } from './TranscriptionService'
import { isVideoFile, checkIsHevc, convertVideoForPlayback } from './FileImportService'

export interface HistorySegment {
  id: string
  startTime: number
  endTime: number
  text: string
}

export interface HistoryEntry {
  id: string
  fileName: string
  fileExtension: string | null
  sourceFilePath: string | null
  createdAt: string
  detectedLanguage: string | null
  audioDuration: number | null
  transcriptionDuration: number | null
  wordCount: number | null
  characterCount: number | null
  segments: HistorySegment[]
}

export class HistoryService {
  private rootDir: string
  private echoDir: string
  private mediaDir: string

  constructor(storageDir?: string) {
    const home = process.env.HOME || process.env.USERPROFILE || app.getPath('home')
    this.rootDir = storageDir || join(home, 'Documents', 'EchoTranscripts')
    this.echoDir = join(this.rootDir, '.echo')
    this.mediaDir = join(this.echoDir, 'media')
    this.ensureDirectories()
  }

  private ensureDirectories(): void {
    if (!existsSync(this.rootDir)) mkdirSync(this.rootDir, { recursive: true })
    if (!existsSync(this.echoDir)) mkdirSync(this.echoDir, { recursive: true })
    if (!existsSync(this.mediaDir)) mkdirSync(this.mediaDir, { recursive: true })
  }

  setRootDir(dir: string): void {
    this.rootDir = dir
    this.echoDir = join(this.rootDir, '.echo')
    this.mediaDir = join(this.echoDir, 'media')
    this.ensureDirectories()
  }

  /**
   * Save a transcription result as a history entry.
   * Media is copied immediately. For MOV/M4V (HEVC), conversion happens in background.
   */
  save(result: TranscriptResult, sourceFilePath: string | null): HistoryEntry {
    const id = randomUUID()
    const ext = sourceFilePath ? extname(sourceFilePath).slice(1).toLowerCase() : null

    const entry: HistoryEntry = {
      id,
      fileName: result.fileName,
      fileExtension: ext,
      sourceFilePath,
      createdAt: new Date().toISOString(),
      detectedLanguage: result.detectedLanguage,
      audioDuration: result.stats?.audioDuration ?? null,
      transcriptionDuration: result.stats?.transcriptionDuration ?? null,
      wordCount: result.stats?.wordCount ?? null,
      characterCount: result.stats?.characterCount ?? null,
      segments: result.segments.map((s) => ({
        id: s.id,
        startTime: s.startTime,
        endTime: s.endTime,
        text: s.text
      }))
    }

    // Save JSON metadata
    const jsonPath = join(this.echoDir, `${id}.json`)
    writeFileSync(jsonPath, JSON.stringify(entry, null, 2), 'utf-8')

    // Export plain text transcript
    const baseName = result.fileName.replace(/\.[^.]+$/, '')
    const txtPath = join(this.rootDir, `${baseName}_transcript.txt`)
    const timestampedText = result.segments
      .map((s) => {
        const mins = Math.floor(s.startTime / 60)
        const secs = Math.floor(s.startTime % 60)
        const ts = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
        return `[${ts}] ${s.text}`
      })
      .join('\n')
    writeFileSync(txtPath, timestampedText, 'utf-8')

    // Copy media file for offline playback
    if (sourceFilePath && existsSync(sourceFilePath)) {
      const mediaExt = extname(sourceFilePath)
      const mediaDest = join(this.mediaDir, `${id}${mediaExt}`)
      try {
        copyFileSync(sourceFilePath, mediaDest)
      } catch {
        // Non-critical — original file still accessible
      }

      // Check if video uses HEVC codec and convert to H.264 in background
      if (isVideoFile(sourceFilePath)) {
        checkIsHevc(mediaDest).then((isHevc) => {
          if (!isHevc) return
          const mp4Dest = join(this.mediaDir, `${id}.mp4`)
          convertVideoForPlayback(mediaDest, mp4Dest)
            .then(() => {
              // Update entry to point to converted file
              entry.fileExtension = 'mp4'
              const jsonPath = join(this.echoDir, `${id}.json`)
              writeFileSync(jsonPath, JSON.stringify(entry, null, 2), 'utf-8')
              // Remove original HEVC copy
              try { unlinkSync(mediaDest) } catch { /* ok */ }
            })
            .catch(() => {
              // Conversion failed — keep original copy
            })
        })
      }
    }

    return entry
  }

  /**
   * Load a single history entry by ID (O(1) disk read).
   */
  loadById(id: string): HistoryEntry | null {
    const jsonPath = join(this.echoDir, `${id}.json`)
    try {
      const data = readFileSync(jsonPath, 'utf-8')
      return JSON.parse(data) as HistoryEntry
    } catch {
      return null
    }
  }

  /**
   * Load all history entries from disk (async, non-blocking).
   */
  async loadAll(): Promise<HistoryEntry[]> {
    if (!existsSync(this.echoDir)) return []

    const files = (await readdir(this.echoDir)).filter((f) => f.endsWith('.json'))
    const results = await Promise.all(
      files.map(async (file) => {
        try {
          const data = await readFile(join(this.echoDir, file), 'utf-8')
          return JSON.parse(data) as HistoryEntry
        } catch {
          return null
        }
      })
    )

    const entries = results.filter((e): e is HistoryEntry => e !== null)
    entries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return entries
  }

  /**
   * Delete a history entry and its associated files.
   */
  delete(id: string): void {
    const jsonPath = join(this.echoDir, `${id}.json`)

    // Read entry to find associated files
    try {
      const data = readFileSync(jsonPath, 'utf-8')
      const entry = JSON.parse(data) as HistoryEntry

      // Delete media file
      if (entry.fileExtension) {
        const mediaPath = join(this.mediaDir, `${id}.${entry.fileExtension}`)
        if (existsSync(mediaPath)) unlinkSync(mediaPath)
      }

      // Delete thumbnail
      const thumbPath = join(this.echoDir, `${id}_thumb.jpg`)
      if (existsSync(thumbPath)) unlinkSync(thumbPath)

      // Delete transcript txt (best effort — filename might have changed)
      const baseName = entry.fileName.replace(/\.[^.]+$/, '')
      const txtPath = join(this.rootDir, `${baseName}_transcript.txt`)
      if (existsSync(txtPath)) unlinkSync(txtPath)
    } catch {
      // Entry might not exist, that's ok
    }

    // Delete JSON
    if (existsSync(jsonPath)) unlinkSync(jsonPath)
  }

  /**
   * Rename a history entry's fileName.
   */
  rename(id: string, newName: string): HistoryEntry | null {
    const jsonPath = join(this.echoDir, `${id}.json`)
    if (!existsSync(jsonPath)) return null

    // Sanitize filename: strip characters illegal on Windows (< > : " / \ | ? *)
    // and trim leading/trailing dots and spaces (Windows rejects those too)
    const sanitized = newName
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/^[\s.]+|[\s.]+$/g, '')
    if (!sanitized) return null

    try {
      const data = readFileSync(jsonPath, 'utf-8')
      const entry = JSON.parse(data) as HistoryEntry

      // Rename the transcript txt file
      const oldBaseName = entry.fileName.replace(/\.[^.]+$/, '')
      const oldTxtPath = join(this.rootDir, `${oldBaseName}_transcript.txt`)

      entry.fileName = sanitized

      const newBaseName = sanitized.replace(/\.[^.]+$/, '')
      const newTxtPath = join(this.rootDir, `${newBaseName}_transcript.txt`)

      if (existsSync(oldTxtPath) && oldTxtPath !== newTxtPath) {
        try {
          renameSync(oldTxtPath, newTxtPath)
        } catch {
          // Non-critical — transcript file may not exist
        }
      }

      // Save updated entry
      writeFileSync(jsonPath, JSON.stringify(entry, null, 2), 'utf-8')
      return entry
    } catch {
      return null
    }
  }

  /**
   * Resolve the media file URL for playback.
   * Checks for converted H.264 MP4 first, then original copy, then source file.
   */
  resolveMediaPath(entry: HistoryEntry): string | null {
    // Check for converted MP4 first (HEVC → H.264 background conversion)
    const mp4Path = join(this.mediaDir, `${entry.id}.mp4`)
    if (existsSync(mp4Path)) return mp4Path

    // Check local copy with original extension
    if (entry.fileExtension && entry.fileExtension !== 'mp4') {
      const localPath = join(this.mediaDir, `${entry.id}.${entry.fileExtension}`)
      if (existsSync(localPath)) return localPath
    }

    // Fall back to original source
    if (entry.sourceFilePath && existsSync(entry.sourceFilePath)) {
      return entry.sourceFilePath
    }

    return null
  }

  /**
   * Get thumbnail path for an entry.
   */
  getThumbnailPath(id: string): string | null {
    const thumbPath = join(this.echoDir, `${id}_thumb.jpg`)
    return existsSync(thumbPath) ? thumbPath : null
  }

  /**
   * Get the path where a thumbnail should be saved.
   */
  getThumbnailSavePath(id: string): string {
    return join(this.echoDir, `${id}_thumb.jpg`)
  }
}

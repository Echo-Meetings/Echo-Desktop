// Core data models — mirrors the Swift models for backward-compatible JSON

export interface TranscriptSegment {
  id: string // UUID
  startTime: number // seconds
  endTime: number // seconds
  text: string
}

export interface TranscriptStats {
  audioDuration: number
  transcriptionDuration: number
  wordCount: number
  characterCount: number
  speedRatio: number
}

export interface TranscriptResult {
  fileName: string
  segments: TranscriptSegment[]
  detectedLanguage: string | null
  stats: TranscriptStats | null
}

export interface HistoryEntry {
  id: string // UUID
  fileName: string
  fileExtension: string | null
  sourceFilePath: string | null
  createdAt: string // ISO8601
  detectedLanguage: string | null
  audioDuration: number | null
  transcriptionDuration: number | null
  wordCount: number | null
  characterCount: number | null
  segments: HistorySegment[]
}

export interface HistorySegment {
  id: string
  startTime: number
  endTime: number
  text: string
}

// Queue session types

export type QueueSessionStatus = 'queued' | 'processing' | 'completed' | 'error'

export interface QueueSession {
  sessionId: string
  fileName: string
  filePath: string
  status: QueueSessionStatus
  progress: number            // 0-1
  detectedLanguage: string | null
  etaSeconds: number | null   // estimated time remaining
  liveSegments: TranscriptSegment[]
  error: string | null
  result: TranscriptResult | null
  mediaPath: string | null
  entryId: string | null      // history entry ID after completion
  addedAt: number
}

// App state types

export type AppPhase =
  | { type: 'empty' }
  | { type: 'processing'; fileName: string; filePath: string | null }
  | { type: 'result'; transcript: TranscriptResult; mediaPath: string | null }
  | { type: 'error'; message: string; retryFilePath: string | null }

export type HistoryFilter = 'all' | 'today' | 'yesterday' | 'last7Days' | 'last30Days' | 'custom'

export const SUPPORTED_LANGUAGES = [
  { code: 'auto', label: 'Auto-detect' },
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Russian' },
  { code: 'de', label: 'German' },
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ja', label: 'Japanese' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ko', label: 'Korean' }
] as const

export const SUPPORTED_EXTENSIONS = new Set([
  'webm', 'mp4', 'm4v', 'mp3', 'm4a', 'wav', 'mov', 'ogg'
])

export const VIDEO_EXTENSIONS = new Set(['mp4', 'm4v', 'mov', 'webm'])

// Utility functions

export function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  const mins = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
}

export function getFullText(segments: { text: string }[]): string {
  return segments.map((s) => s.text).join('\n')
}

export function getTimestampedText(segments: { startTime: number; text: string }[]): string {
  return segments.map((s) => `[${formatTimestamp(s.startTime)}] ${s.text}`).join('\n')
}

export function isVideoFile(fileName: string, filePath?: string | null): boolean {
  const ext = (filePath?.split('.').pop() || fileName.split('.').pop() || '').toLowerCase()
  return VIDEO_EXTENSIONS.has(ext)
}

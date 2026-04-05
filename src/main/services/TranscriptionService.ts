import { spawn, ChildProcess } from 'child_process'
import { existsSync, readFileSync, unlinkSync } from 'fs'
import { join, dirname } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { locateWhisperCli } from './BinaryPaths'

export interface TranscriptSegment {
  id: string
  startTime: number
  endTime: number
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

interface WhisperJsonOutput {
  transcription: Array<{
    timestamps: { from: string; to: string }
    offsets: { from: number; to: number }
    text: string
  }>
  result?: {
    language?: string
  }
}

export class TranscriptionService {
  private currentProcess: ChildProcess | null = null
  private cancelled = false

  /**
   * Transcribe an audio file using whisper.cpp CLI.
   * The file should already be converted to WAV format.
   */
  async transcribe(
    wavPath: string,
    displayName: string,
    modelPath: string,
    language: string | null,
    onProgress: (fraction: number, language: string | null) => void,
    onSegment: (segments: TranscriptSegment[]) => void
  ): Promise<TranscriptResult> {
    const whisperPath = locateWhisperCli()
    if (!whisperPath) {
      throw new Error('whisper-cli not found. Download it in Settings or install via: brew install whisper-cpp')
    }

    this.cancelled = false
    const startTime = Date.now()

    // Output to JSON file
    const outputBase = join(tmpdir(), `echo_whisper_${randomUUID()}`)
    const outputJson = `${outputBase}.json`

    const args = [
      '-m', modelPath,
      '-f', wavPath,
      '-oj',                    // output JSON
      '-of', outputBase,        // output file base
      '-pp',                    // print progress
      '-t', '4',                // threads
      '-ml', '80',              // max segment length in characters
      '-sow',                   // split on word boundaries
      '-mc', '64',              // limited context: reduces hallucination loops while keeping quality
      '-et', '2.2',             // entropy threshold — flag low-confidence segments
      '-lpt', '-0.5'            // log probability threshold — reject garbage segments
    ]

    if (language && language !== 'auto') {
      args.push('-l', language)
    } else {
      args.push('-l', 'auto')
    }

    // On Windows, add whisper binary dir to PATH so DLLs (whisper.dll, ggml*.dll) are found
    const spawnEnv = { ...process.env }
    if (process.platform !== 'win32') {
      spawnEnv.STDBUF = 'L' // Line-buffered stdout (Unix only)
    }
    if (process.platform === 'win32') {
      const whisperDir = dirname(whisperPath)
      spawnEnv.PATH = `${whisperDir};${spawnEnv.PATH || ''}`
    }

    return new Promise((resolve, reject) => {
      const proc = spawn(whisperPath, args, {
        env: spawnEnv,
        stdio: ['ignore', 'pipe', 'pipe']
      })
      this.currentProcess = proc

      let stderr = ''
      let detectedLang: string | null = null

      // Parse stderr for progress updates
      proc.stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString()
        stderr += text

        // Detect language from output
        const langMatch = text.match(/auto-detected language:\s*(\w+)/)
        if (langMatch) {
          detectedLang = langMatch[1]
          onProgress(0.05, languageName(detectedLang))
        }

        // Parse progress: whisper.cpp outputs "progress = XX%"
        const progressMatch = text.match(/progress\s*=\s*(\d+)%/)
        if (progressMatch) {
          const pct = Math.min(parseInt(progressMatch[1], 10) / 100, 1.0)
          onProgress(pct, detectedLang ? languageName(detectedLang) : null)
        }
      })

      // whisper.cpp prints segments to stdout as they come
      proc.stdout.on('data', (chunk: Buffer) => {
        const text = chunk.toString()
        // Parse timestamp lines: [00:00.000 --> 00:05.000]  text
        const lines = text.split('\n')
        const newSegments: TranscriptSegment[] = []

        for (const line of lines) {
          const match = line.match(/\[(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})\]\s*(.+)/)
          if (match) {
            const segText = cleanText(match[3])
            if (segText.length > 3 && !isHallucination(segText)) {
              newSegments.push({
                id: randomUUID(),
                startTime: parseTimestamp(match[1]),
                endTime: parseTimestamp(match[2]),
                text: segText
              })
            }
          }
        }

        if (newSegments.length > 0) {
          onSegment(newSegments)
        }
      })

      proc.on('close', (code) => {
        this.currentProcess = null

        if (this.cancelled) {
          reject(new Error('Transcription cancelled'))
          return
        }

        if (code !== 0) {
          reject(new Error(`whisper-cli failed (code ${code}): ${stderr.slice(-300)}`))
          return
        }

        // Parse the JSON output file for final segments
        try {
          const segments = this.parseJsonOutput(outputJson, displayName, detectedLang, startTime)
          // Cleanup temp files
          try { unlinkSync(outputJson) } catch { /* ok */ }
          resolve(segments)
        } catch (err) {
          reject(new Error(`Failed to parse whisper output: ${err}`))
        }
      })

      proc.on('error', (err) => {
        this.currentProcess = null
        reject(err)
      })
    })
  }

  private parseJsonOutput(
    jsonPath: string,
    displayName: string,
    detectedLang: string | null,
    startTime: number
  ): TranscriptResult {
    if (!existsSync(jsonPath)) {
      throw new Error('Whisper JSON output not found')
    }

    const raw = JSON.parse(readFileSync(jsonPath, 'utf-8')) as WhisperJsonOutput
    const lang = raw.result?.language || detectedLang

    // Convert to our segment format
    const rawSegments: TranscriptSegment[] = raw.transcription.map((t) => ({
      id: randomUUID(),
      startTime: t.offsets.from / 1000, // ms to seconds
      endTime: t.offsets.to / 1000,
      text: cleanText(t.text)
    })).filter((s) => s.text.length > 0 && !isHallucination(s.text))

    const segments = rawSegments

    // Build stats
    const fullText = segments.map((s) => s.text).join(' ')
    const wordCount = fullText.split(/\s+/).filter(Boolean).length
    const characterCount = fullText.replace(/\s/g, '').length
    const audioDuration = segments.length > 0
      ? segments[segments.length - 1].endTime
      : 0
    const transcriptionDuration = (Date.now() - startTime) / 1000

    return {
      fileName: displayName,
      segments,
      detectedLanguage: lang ? languageName(lang) : null,
      stats: {
        audioDuration,
        transcriptionDuration,
        wordCount,
        characterCount,
        speedRatio: transcriptionDuration > 0 ? audioDuration / transcriptionDuration : 0
      }
    }
  }

  cancel(): void {
    this.cancelled = true
    if (this.currentProcess) {
      // Windows doesn't support SIGTERM — use default kill
      if (process.platform === 'win32') {
        this.currentProcess.kill()
      } else {
        this.currentProcess.kill('SIGTERM')
      }
      this.currentProcess = null
    }
  }
}

// --- Helpers ---

function parseTimestamp(ts: string): number {
  // Parse "HH:MM:SS.mmm" format
  const match = ts.match(/(\d+):(\d+):(\d+)\.(\d+)/)
  if (!match) return 0
  return parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3]) + parseInt(match[4]) / 1000
}

function cleanText(text: string): string {
  return text
    .replace(/<\|[^|]*\|>/g, '')  // Remove Whisper special tokens
    .replace(/\s+/g, ' ')         // Collapse spaces
    .trim()
}

/**
 * Detect hallucinated segments — repetitive junk whisper.cpp produces on silence.
 * Common patterns: "Okay. Okay. Okay.", "Thank you.", "Thanks for watching.", etc.
 */
function isHallucination(text: string): boolean {
  const normalized = text.trim().toLowerCase()
  if (normalized.length === 0) return true

  // Split into words and check if a single short phrase repeats excessively
  const words = normalized.split(/\s+/)
  if (words.length < 4) return false

  // Check for single-word repetition: "okay. okay. okay. okay."
  const uniqueWords = new Set(words.map((w) => w.replace(/[.,!?]/g, '')))
  if (uniqueWords.size <= 2 && words.length >= 6) return true

  // Check for known hallucination phrases that fill entire segments
  const hallucinationPatterns = [
    /^(okay[\s.,!]*)+$/i,
    /^(thank you[\s.,!]*)+$/i,
    /^(thanks for watching[\s.,!]*)+$/i,
    /^(bye[\s.,!]*)+$/i,
    /^(you[\s.,!]*)+$/i,
    /^(the end[\s.,!]*)+$/i,
    /^(so[\s.,!]*)+$/i,
    /^(\.[\s]*)+$/
  ]
  return hallucinationPatterns.some((p) => p.test(normalized))
}

const LANGUAGE_NAMES: Record<string, string> = {
  af: 'Afrikaans', am: 'Amharic', ar: 'Arabic', as: 'Assamese', az: 'Azerbaijani',
  ba: 'Bashkir', be: 'Belarusian', bg: 'Bulgarian', bn: 'Bengali', bo: 'Tibetan',
  br: 'Breton', bs: 'Bosnian', ca: 'Catalan', cs: 'Czech', cy: 'Welsh',
  da: 'Danish', de: 'German', el: 'Greek', en: 'English', es: 'Spanish',
  et: 'Estonian', eu: 'Basque', fa: 'Persian', fi: 'Finnish', fo: 'Faroese',
  fr: 'French', gl: 'Galician', gu: 'Gujarati', ha: 'Hausa', haw: 'Hawaiian',
  he: 'Hebrew', hi: 'Hindi', hr: 'Croatian', ht: 'Haitian', hu: 'Hungarian',
  hy: 'Armenian', id: 'Indonesian', is: 'Icelandic', it: 'Italian', ja: 'Japanese',
  jw: 'Javanese', ka: 'Georgian', kk: 'Kazakh', km: 'Khmer', kn: 'Kannada',
  ko: 'Korean', la: 'Latin', lb: 'Luxembourgish', ln: 'Lingala', lo: 'Lao',
  lt: 'Lithuanian', lv: 'Latvian', mg: 'Malagasy', mi: 'Maori', mk: 'Macedonian',
  ml: 'Malayalam', mn: 'Mongolian', mr: 'Marathi', ms: 'Malay', mt: 'Maltese',
  my: 'Myanmar', ne: 'Nepali', nl: 'Dutch', nn: 'Nynorsk', no: 'Norwegian',
  oc: 'Occitan', pa: 'Punjabi', pl: 'Polish', ps: 'Pashto', pt: 'Portuguese',
  ro: 'Romanian', ru: 'Russian', sa: 'Sanskrit', sd: 'Sindhi', si: 'Sinhala',
  sk: 'Slovak', sl: 'Slovenian', sn: 'Shona', so: 'Somali', sq: 'Albanian',
  sr: 'Serbian', su: 'Sundanese', sv: 'Swedish', sw: 'Swahili', ta: 'Tamil',
  te: 'Telugu', tg: 'Tajik', th: 'Thai', tk: 'Turkmen', tl: 'Tagalog',
  tr: 'Turkish', tt: 'Tatar', uk: 'Ukrainian', ur: 'Urdu', uz: 'Uzbek',
  vi: 'Vietnamese', yi: 'Yiddish', yo: 'Yoruba', zh: 'Chinese'
}

function languageName(code: string): string {
  return LANGUAGE_NAMES[code.toLowerCase()] || code.charAt(0).toUpperCase() + code.slice(1)
}

/**
 * Merge short segments into longer paragraphs.
 * Min length: 80 chars, max gap: 5 seconds.
 */
function mergeShortSegments(segments: TranscriptSegment[]): TranscriptSegment[] {
  if (segments.length === 0) return []

  const merged: TranscriptSegment[] = []
  let current = { ...segments[0] }

  for (let i = 1; i < segments.length; i++) {
    const next = segments[i]
    const gap = next.startTime - current.endTime
    const shouldMerge = current.text.length < 80 && gap <= 5

    if (shouldMerge) {
      current.endTime = next.endTime
      current.text = current.text + ' ' + next.text
    } else {
      merged.push(current)
      current = { ...next }
    }
  }
  merged.push(current)
  return merged
}

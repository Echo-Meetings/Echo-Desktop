import { writeFileSync, appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, statSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  timestamp: string
  level: LogLevel
  tag: string
  message: string
}

const MAX_LOG_SIZE = 5 * 1024 * 1024  // 5 MB per file
const MAX_LOG_FILES = 5

class Logger {
  private logDir: string
  private logFile: string
  private buffer: LogEntry[] = []

  constructor() {
    const userDataPath = app.getPath('userData')
    this.logDir = join(userDataPath, 'logs')
    if (!existsSync(this.logDir)) mkdirSync(this.logDir, { recursive: true })
    this.logFile = join(this.logDir, 'echo.log')
    this.rotateIfNeeded()
  }

  private rotateIfNeeded(): void {
    try {
      if (!existsSync(this.logFile)) return
      const stat = statSync(this.logFile)
      if (stat.size < MAX_LOG_SIZE) return

      // Rotate: echo.log → echo.1.log, echo.1.log → echo.2.log, etc.
      for (let i = MAX_LOG_FILES - 1; i >= 1; i--) {
        const from = i === 1 ? this.logFile : join(this.logDir, `echo.${i - 1}.log`)
        const to = join(this.logDir, `echo.${i}.log`)
        if (existsSync(from)) {
          try { unlinkSync(to) } catch { /* ok */ }
          try {
            const content = readFileSync(from)
            writeFileSync(to, content)
          } catch { /* ok */ }
        }
      }
      // Clear current log
      writeFileSync(this.logFile, '')
    } catch { /* ok */ }
  }

  private write(level: LogLevel, tag: string, message: string): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      tag,
      message
    }

    this.buffer.push(entry)

    const line = `[${entry.timestamp}] [${level.toUpperCase()}] [${tag}] ${message}\n`

    // Console output
    const fn = level === 'error' ? console.error
      : level === 'warn' ? console.warn
      : console.log
    fn(`[${tag}] ${message}`)

    // File output
    try {
      appendFileSync(this.logFile, line)
    } catch { /* ok */ }
  }

  debug(tag: string, message: string): void { this.write('debug', tag, message) }
  info(tag: string, message: string): void { this.write('info', tag, message) }
  warn(tag: string, message: string): void { this.write('warn', tag, message) }
  error(tag: string, message: string): void { this.write('error', tag, message) }

  /**
   * Get recent log entries from the buffer (in-memory, current session only).
   */
  getRecentLogs(limit = 500): LogEntry[] {
    return this.buffer.slice(-limit)
  }

  /**
   * Read log file from disk.
   */
  readLogFile(maxLines = 1000): string {
    try {
      if (!existsSync(this.logFile)) return ''
      const content = readFileSync(this.logFile, 'utf-8')
      const lines = content.split('\n')
      return lines.slice(-maxLines).join('\n')
    } catch {
      return ''
    }
  }

  getLogFilePath(): string {
    return this.logFile
  }
}

export const logger = new Logger()

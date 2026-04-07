import { cpus, totalmem, freemem } from 'os'

export interface HardwareInfo {
  cpuCores: number
  totalMemoryMB: number
  freeMemoryMB: number
  platform: NodeJS.Platform
  arch: string
}

let cached: HardwareInfo | null = null

export function getHardwareInfo(): HardwareInfo {
  if (cached) return cached
  cached = {
    cpuCores: cpus().length || 4,
    totalMemoryMB: Math.round(totalmem() / (1024 * 1024)),
    freeMemoryMB: Math.round(freemem() / (1024 * 1024)),
    platform: process.platform,
    arch: process.arch
  }
  return cached
}

/**
 * Refresh free memory (called before transcription to get current value).
 */
export function getFreeMemoryMB(): number {
  return Math.round(freemem() / (1024 * 1024))
}

/**
 * Calculate optimal thread count for whisper.cpp.
 * Leaves 1 core free for OS/UI on machines with 3+ cores.
 * On low-core systems (VMs), uses 75% of available cores.
 * Caps at 8 to avoid diminishing returns.
 */
export function getOptimalThreadCount(): number {
  const cores = getHardwareInfo().cpuCores
  if (cores <= 2) return Math.max(1, Math.floor(cores * 0.75))
  return Math.max(1, Math.min(cores - 1, 8))
}

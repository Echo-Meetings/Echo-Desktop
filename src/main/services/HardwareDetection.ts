import { cpus, totalmem, freemem } from 'os'
import { execSync } from 'child_process'

export interface GpuInfo {
  available: boolean
  backend: 'metal' | 'vulkan' | 'none'
  name: string | null
  vramMB: number | null
}

export interface HardwareInfo {
  cpuCores: number
  totalMemoryMB: number
  freeMemoryMB: number
  platform: NodeJS.Platform
  arch: string
  gpu: GpuInfo
}

let cached: HardwareInfo | null = null

export function getHardwareInfo(): HardwareInfo {
  if (cached) return cached
  cached = {
    cpuCores: cpus().length || 4,
    totalMemoryMB: Math.round(totalmem() / (1024 * 1024)),
    freeMemoryMB: Math.round(freemem() / (1024 * 1024)),
    platform: process.platform,
    arch: process.arch,
    gpu: detectGpu()
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
 * When GPU is active, fewer CPU threads are needed.
 * On CPU-only, raised cap for modern multi-core CPUs.
 */
export function getOptimalThreadCount(hasGpu: boolean = false): number {
  const cores = getHardwareInfo().cpuCores
  if (hasGpu) return Math.min(4, Math.max(1, cores - 1))
  if (cores <= 2) return Math.max(1, Math.floor(cores * 0.75))
  if (cores <= 8) return cores - 1
  return Math.min(cores - 2, 14)
}

function detectGpu(): GpuInfo {
  const none: GpuInfo = { available: false, backend: 'none', name: null, vramMB: null }
  try {
    if (process.platform === 'darwin') return detectGpuMacOS()
    if (process.platform === 'win32') return detectGpuWindows()
    if (process.platform === 'linux') return detectGpuLinux()
  } catch { /* fall back to CPU */ }
  return none
}

function detectGpuMacOS(): GpuInfo {
  if (process.arch === 'arm64') {
    let name = 'Apple Silicon GPU'
    let vramMB: number | null = null
    try {
      const output = execSync('system_profiler SPDisplaysDataType -json', { timeout: 5000, encoding: 'utf-8' })
      const data = JSON.parse(output)
      const displays = data?.SPDisplaysDataType
      if (displays?.[0]) {
        name = displays[0].sppci_model || name
        const vramStr = displays[0].spdisplays_vram || displays[0].spdisplays_vram_shared
        if (vramStr) {
          const match = vramStr.match(/(\d+)\s*(GB|MB)/i)
          if (match) vramMB = parseInt(match[1]) * (match[2].toUpperCase() === 'GB' ? 1024 : 1)
        }
      }
    } catch { /* ok */ }
    return { available: true, backend: 'metal', name, vramMB }
  }

  try {
    const output = execSync('system_profiler SPDisplaysDataType -json', { timeout: 5000, encoding: 'utf-8' })
    const data = JSON.parse(output)
    const gpu = data?.SPDisplaysDataType?.[0]
    if (gpu?.spdisplays_mtlgpufamilysupport) {
      let vramMB: number | null = null
      const vramStr = gpu.spdisplays_vram
      if (vramStr) {
        const match = vramStr.match(/(\d+)\s*(GB|MB)/i)
        if (match) vramMB = parseInt(match[1]) * (match[2].toUpperCase() === 'GB' ? 1024 : 1)
      }
      return { available: true, backend: 'metal', name: gpu.sppci_model || 'Unknown GPU', vramMB }
    }
  } catch { /* ok */ }
  return { available: false, backend: 'none', name: null, vramMB: null }
}

function detectGpuWindows(): GpuInfo {
  try {
    const output = execSync(
      'powershell -NoProfile -Command "Get-CimInstance Win32_VideoController | Select-Object Name,AdapterRAM | ConvertTo-Json"',
      { timeout: 10000, encoding: 'utf-8' }
    )
    const parsed = JSON.parse(output)
    const gpus = Array.isArray(parsed) ? parsed : [parsed]

    let best: { name: string; vramMB: number | null } | null = null
    for (const gpu of gpus) {
      if (!gpu?.Name || gpu.Name.includes('Microsoft Basic')) continue
      const vramMB = gpu.AdapterRAM ? Math.round(gpu.AdapterRAM / (1024 * 1024)) : null
      if (!best || (vramMB && (!best.vramMB || vramMB > best.vramMB))) {
        best = { name: gpu.Name, vramMB }
      }
    }
    if (best) return { available: true, backend: 'vulkan', name: best.name, vramMB: best.vramMB }
  } catch { /* ok */ }
  return { available: false, backend: 'none', name: null, vramMB: null }
}

function detectGpuLinux(): GpuInfo {
  try {
    const lspci = execSync('lspci 2>/dev/null | grep -i vga', { timeout: 5000, encoding: 'utf-8' })
    if (lspci.trim()) {
      const match = lspci.match(/:\s*(.+)/)
      const name = match ? match[1].trim() : 'Unknown GPU'
      let vulkanAvailable = false
      try { execSync('vulkaninfo --summary 2>/dev/null', { timeout: 5000 }); vulkanAvailable = true } catch { /* */ }
      if (vulkanAvailable) return { available: true, backend: 'vulkan', name, vramMB: null }
      return { available: false, backend: 'none', name, vramMB: null }
    }
  } catch { /* ok */ }
  return { available: false, backend: 'none', name: null, vramMB: null }
}

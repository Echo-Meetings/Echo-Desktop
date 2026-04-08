import { cpus, totalmem, freemem } from 'os'
import { execSync } from 'child_process'

export type GpuBackend = 'cuda' | 'metal' | 'vulkan' | 'none'
export type GpuVendor = 'nvidia' | 'amd' | 'intel' | 'apple' | 'unknown'

export interface GpuInfo {
  available: boolean
  backend: GpuBackend
  vendor: GpuVendor
  name: string | null
  vramMB: number | null
  cudaAvailable: boolean
  vulkanAvailable: boolean
  driverVersion: string | null
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
 * CUDA offloads more work to GPU, so fewer CPU threads needed.
 * Vulkan/Metal still benefit from reduced threads.
 * On CPU-only, raised cap for modern multi-core CPUs.
 */
export function getOptimalThreadCount(hasGpu: boolean = false, backend: GpuBackend = 'none'): number {
  const cores = getHardwareInfo().cpuCores
  if (hasGpu && backend === 'cuda') return Math.min(2, Math.max(1, cores - 1))
  if (hasGpu) return Math.min(4, Math.max(1, cores - 1))
  if (cores <= 2) return Math.max(1, Math.floor(cores * 0.75))
  if (cores <= 8) return cores - 1
  return Math.min(cores - 2, 14)
}

/**
 * Determine the recommended GPU backend for the detected hardware.
 * NVIDIA with CUDA available → cuda, otherwise vulkan.
 * AMD/Intel → vulkan. Apple → metal.
 */
export function getRecommendedBackend(gpu: GpuInfo): GpuBackend {
  if (!gpu.available) return 'none'
  if (gpu.vendor === 'apple') return 'metal'
  if (gpu.vendor === 'nvidia' && gpu.cudaAvailable) return 'cuda'
  if (gpu.vulkanAvailable) return 'vulkan'
  return 'none'
}

const GPU_NONE: GpuInfo = {
  available: false, backend: 'none', vendor: 'unknown', name: null,
  vramMB: null, cudaAvailable: false, vulkanAvailable: false, driverVersion: null
}

function detectGpu(): GpuInfo {
  try {
    if (process.platform === 'darwin') return detectGpuMacOS()
    if (process.platform === 'win32') return detectGpuWindows()
    if (process.platform === 'linux') return detectGpuLinux()
  } catch { /* fall back to CPU */ }
  return { ...GPU_NONE }
}

function detectVendorFromName(name: string): GpuVendor {
  const lower = name.toLowerCase()
  if (lower.includes('nvidia') || lower.includes('geforce') || lower.includes('quadro') || lower.includes('rtx') || lower.includes('gtx')) return 'nvidia'
  if (lower.includes('amd') || lower.includes('radeon') || lower.includes('rx ')) return 'amd'
  if (lower.includes('intel') || lower.includes('iris') || lower.includes('uhd graphics') || lower.includes('hd graphics') || lower.includes('arc ')) return 'intel'
  if (lower.includes('apple')) return 'apple'
  return 'unknown'
}

function detectCuda(): { available: boolean; driverVersion: string | null } {
  try {
    const output = execSync('nvidia-smi --query-gpu=driver_version --format=csv,noheader,nounits 2>/dev/null', {
      timeout: 5000, encoding: 'utf-8'
    })
    const version = output.trim().split('\n')[0]?.trim() || null
    return { available: true, driverVersion: version }
  } catch { /* nvidia-smi not available */ }
  return { available: false, driverVersion: null }
}

function getNvidiaVram(): number | null {
  try {
    const output = execSync('nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits 2>/dev/null', {
      timeout: 5000, encoding: 'utf-8'
    })
    const mb = parseInt(output.trim().split('\n')[0]?.trim() || '', 10)
    return isNaN(mb) ? null : mb
  } catch { /* ok */ }
  return null
}

function parseVramString(vramStr: string | undefined): number | null {
  if (!vramStr) return null
  const match = vramStr.match(/(\d+)\s*(GB|MB)/i)
  if (match) return parseInt(match[1]) * (match[2].toUpperCase() === 'GB' ? 1024 : 1)
  return null
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
        vramMB = parseVramString(displays[0].spdisplays_vram || displays[0].spdisplays_vram_shared)
      }
    } catch { /* ok */ }
    return {
      available: true, backend: 'metal', vendor: 'apple', name, vramMB,
      cudaAvailable: false, vulkanAvailable: false, driverVersion: null
    }
  }

  try {
    const output = execSync('system_profiler SPDisplaysDataType -json', { timeout: 5000, encoding: 'utf-8' })
    const data = JSON.parse(output)
    const gpu = data?.SPDisplaysDataType?.[0]
    if (gpu?.spdisplays_mtlgpufamilysupport) {
      const name = gpu.sppci_model || 'Unknown GPU'
      return {
        available: true, backend: 'metal', vendor: detectVendorFromName(name), name,
        vramMB: parseVramString(gpu.spdisplays_vram),
        cudaAvailable: false, vulkanAvailable: false, driverVersion: null
      }
    }
  } catch { /* ok */ }
  return { ...GPU_NONE }
}

function detectGpuWindows(): GpuInfo {
  try {
    const output = execSync(
      'powershell -NoProfile -Command "Get-CimInstance Win32_VideoController | Select-Object Name,AdapterRAM,DriverVersion | ConvertTo-Json"',
      { timeout: 10000, encoding: 'utf-8' }
    )
    const parsed = JSON.parse(output)
    const gpus = Array.isArray(parsed) ? parsed : [parsed]

    let best: { name: string; vramMB: number | null; driverVersion: string | null } | null = null
    for (const gpu of gpus) {
      if (!gpu?.Name || gpu.Name.includes('Microsoft Basic')) continue
      const vramMB = gpu.AdapterRAM ? Math.round(gpu.AdapterRAM / (1024 * 1024)) : null
      if (!best || (vramMB && (!best.vramMB || vramMB > best.vramMB))) {
        best = { name: gpu.Name, vramMB, driverVersion: gpu.DriverVersion || null }
      }
    }
    if (best) {
      const vendor = detectVendorFromName(best.name)
      const cuda = vendor === 'nvidia' ? detectCuda() : { available: false, driverVersion: null }
      let vulkanAvailable = false
      try { execSync('vulkaninfo --summary 2>nul', { timeout: 5000 }); vulkanAvailable = true } catch { /* */ }
      const backend = getRecommendedBackendFromCapabilities(vendor, cuda.available, vulkanAvailable)
      return {
        available: true, backend, vendor, name: best.name,
        vramMB: (vendor === 'nvidia' ? getNvidiaVram() : null) || best.vramMB,
        cudaAvailable: cuda.available, vulkanAvailable,
        driverVersion: cuda.driverVersion || best.driverVersion
      }
    }
  } catch { /* ok */ }
  return { ...GPU_NONE }
}

function detectGpuLinux(): GpuInfo {
  try {
    const lspci = execSync('lspci 2>/dev/null | grep -i vga', { timeout: 5000, encoding: 'utf-8' })
    if (lspci.trim()) {
      const match = lspci.match(/:\s*(.+)/)
      const name = match ? match[1].trim() : 'Unknown GPU'
      const vendor = detectVendorFromName(name)
      const cuda = vendor === 'nvidia' ? detectCuda() : { available: false, driverVersion: null }
      let vulkanAvailable = false
      try { execSync('vulkaninfo --summary 2>/dev/null', { timeout: 5000 }); vulkanAvailable = true } catch { /* */ }
      const vramMB = vendor === 'nvidia' ? getNvidiaVram() : null
      const backend = getRecommendedBackendFromCapabilities(vendor, cuda.available, vulkanAvailable)
      if (backend !== 'none') {
        return {
          available: true, backend, vendor, name, vramMB,
          cudaAvailable: cuda.available, vulkanAvailable,
          driverVersion: cuda.driverVersion
        }
      }
      return { ...GPU_NONE, name, vendor }
    }
  } catch { /* ok */ }
  return { ...GPU_NONE }
}

function getRecommendedBackendFromCapabilities(vendor: GpuVendor, cudaAvailable: boolean, vulkanAvailable: boolean): GpuBackend {
  if (vendor === 'apple') return 'metal'
  if (vendor === 'nvidia' && cudaAvailable) return 'cuda'
  if (vulkanAvailable) return 'vulkan'
  return 'none'
}

// --- FFmpeg hardware encoder detection ---

export interface HwEncoderInfo {
  h264Encoder: string  // e.g. 'h264_nvenc', 'h264_amf', 'h264_qsv', 'h264_videotoolbox', 'libx264'
}

let cachedHwEncoder: HwEncoderInfo | null = null

/**
 * Detect the best available hardware H.264 encoder for FFmpeg.
 * Runs `ffmpeg -encoders` once and caches the result.
 * Priority: nvenc (NVIDIA) > amf (AMD) > qsv (Intel) > videotoolbox (macOS) > libx264 (software)
 */
export function detectHwEncoder(ffmpegPath: string): HwEncoderInfo {
  if (cachedHwEncoder) return cachedHwEncoder

  const hwEncoders = [
    { name: 'h264_nvenc', vendor: 'nvidia' as GpuVendor },
    { name: 'h264_amf', vendor: 'amd' as GpuVendor },
    { name: 'h264_qsv', vendor: 'intel' as GpuVendor },
    { name: 'h264_videotoolbox', vendor: 'apple' as GpuVendor },
  ]

  try {
    const output = execSync(`"${ffmpegPath}" -encoders 2>/dev/null`, {
      timeout: 10000, encoding: 'utf-8'
    })

    const gpu = getHardwareInfo().gpu
    // Prefer the encoder matching the detected GPU vendor
    for (const enc of hwEncoders) {
      if (output.includes(enc.name) && enc.vendor === gpu.vendor) {
        cachedHwEncoder = { h264Encoder: enc.name }
        return cachedHwEncoder
      }
    }
    // Fallback: use any available HW encoder
    for (const enc of hwEncoders) {
      if (output.includes(enc.name)) {
        cachedHwEncoder = { h264Encoder: enc.name }
        return cachedHwEncoder
      }
    }
  } catch { /* ok */ }

  cachedHwEncoder = { h264Encoder: 'libx264' }
  return cachedHwEncoder
}

import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { ESPLoader, Transport } from 'esptool-js'
import SparkMD5 from 'spark-md5'
import { useToast } from '@nuxt/ui/composables'

import { useFirmwareApi } from '@/lib/api/firmware'
import { buildVendorFilters, isSerialSupported } from '@/lib/serial/ports'
import { silentTerminal } from '@/lib/esptool/terminal'
import { arrayBufferToBinaryString } from '@/lib/esptool/utils'
import type { FlashState, FileToFlash } from '@/types/flash'
import type { components } from '@/types/firmware-api'

type FirmwareManifest = components['schemas']['FirmwareManifest']

/**
 * Normalize chip name from esptool-js format to manifest format.
 * esptool-js returns: "ESP32-S3 (QFN56) (revision v0.2)"
 * Manifest expects: "ESP32-S3"
 */
const normalizeChipFamily = (chip: string): string => {
  const match = chip.match(/^(ESP\d+[-\w]*)/i)
  return match ? match[1].toUpperCase() : chip.toUpperCase()
}

export const useFlashStore = defineStore('flash', () => {
  const firmware = useFirmwareApi()
  const toast = useToast()

  // State
  const state = ref<FlashState>('idle')
  const errorMessage = ref<string | null>(null)

  // Connection
  const port = shallowRef<SerialPort | null>(null)
  const transport = shallowRef<Transport | null>(null)
  const esploader = shallowRef<ESPLoader | null>(null)
  const detectedChip = ref<string | null>(null)

  // Progress
  const downloadProgress = ref(0)
  const flashProgress = ref(0)
  const currentFileIndex = ref(0)
  const totalFiles = ref(0)
  const fileNames = ref<string[]>([])

  // Data
  const manifest = ref<FirmwareManifest | null>(null)
  const filesToFlash = ref<FileToFlash[]>([])

  // Silent terminal (no debug output)
  const terminal = silentTerminal

  const reset = () => {
    state.value = 'idle'
    errorMessage.value = null
    downloadProgress.value = 0
    flashProgress.value = 0
    currentFileIndex.value = 0
    totalFiles.value = 0
    fileNames.value = []
    manifest.value = null
    filesToFlash.value = []
    detectedChip.value = null
  }

  const fetchManifest = async (project: string, variant: string, version: string) => {
    const { data, error } = await firmware.GET('/projects/{project}/{variant}/{version}', {
      params: { path: { project, variant, version } },
    })

    if (error || !data) {
      throw new Error('Failed to fetch firmware manifest')
    }

    manifest.value = data
    return data
  }

  const downloadBinaries = async (detectedChip: string) => {
    if (!manifest.value?.builds) {
      throw new Error('No builds in manifest')
    }

    // Normalize chip name from esptool-js format to manifest format
    const normalizedChip = normalizeChipFamily(detectedChip)

    // Find matching build for chip
    const build = manifest.value.builds.find((b) => b.chipFamily?.toUpperCase() === normalizedChip)

    if (!build?.parts?.length) {
      throw new Error(`No build found for ${normalizedChip}`)
    }

    const parts = build.parts.filter((p) => p.path && p.offset !== undefined)
    totalFiles.value = parts.length

    // Extract file names from paths
    fileNames.value = parts.map((p) => {
      const url = new URL(p.path!, window.location.origin)
      return url.pathname.split('/').pop() ?? p.path!
    })

    // Validate all files exist on the OTA server before downloading
    const headRequests = parts.map(async (part) => {
      const response = await fetch(part.path!, { method: 'HEAD' })
      if (!response.ok) {
        throw new Error(`File not found: ${fileNames.value[parts.indexOf(part)]}`)
      }
    })
    await Promise.all(headRequests)

    // All files validated, start downloading
    state.value = 'downloading'
    downloadProgress.value = 0

    const files: FileToFlash[] = []

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      currentFileIndex.value = i

      const response = await fetch(part.path!)
      if (!response.ok) {
        throw new Error(`Failed to download ${fileNames.value[i]}`)
      }

      const buffer = await response.arrayBuffer()
      const binaryString = arrayBufferToBinaryString(buffer)

      files.push({
        data: binaryString,
        address: part.offset!,
      })

      downloadProgress.value = Math.round(((i + 1) / parts.length) * 100)
    }

    filesToFlash.value = files
    return files
  }

  const requestDevice = async () => {
    if (!isSerialSupported()) {
      throw new Error('Web Serial requires Chrome or Edge 89+')
    }

    const selectedPort = await navigator.serial.requestPort({
      filters: buildVendorFilters(),
    })
    port.value = selectedPort
    return selectedPort
  }

  const connect = async () => {
    if (!port.value) {
      throw new Error('No port selected')
    }

    transport.value = new Transport(port.value, false)

    esploader.value = new ESPLoader({
      transport: transport.value,
      baudrate: 115200,
      romBaudrate: 115200,
      terminal,
      enableTracing: false,
    })

    // Sync with chip and get chip type
    const chip = await esploader.value.main()
    detectedChip.value = chip

    return chip
  }

  const flash = async () => {
    if (!esploader.value || !filesToFlash.value.length) {
      throw new Error('Not ready to flash')
    }

    state.value = 'flashing'
    flashProgress.value = 0

    await esploader.value.writeFlash({
      fileArray: filesToFlash.value,
      flashSize: 'keep',
      flashMode: 'dio',
      flashFreq: '40m',
      eraseAll: false,
      compress: true,
      reportProgress: (fileIndex, written, total) => {
        currentFileIndex.value = fileIndex
        flashProgress.value = Math.round((written / total) * 100)
      },
      calculateMD5Hash: (image) => SparkMD5.hashBinary(image),
    })

    // Hard reset device after flashing to reboot into new firmware
    await esploader.value.after('hard_reset')

    // Small delay to ensure reset completes before disconnect
    await new Promise((resolve) => setTimeout(resolve, 100))

    state.value = 'complete'
  }

  const disconnect = async () => {
    try {
      // Release DTR/RTS before disconnect to ensure chip stays out of bootloader
      if (transport.value) {
        await transport.value.setDTR(false)
        await transport.value.setRTS(false)
      }
      await transport.value?.disconnect()
    } catch {
      // Ignore disconnect errors
    }
    transport.value = null
    esploader.value = null
    port.value = null
  }

  // Main flash workflow
  const startFlash = async (project: string, variant: string, version: string) => {
    try {
      reset()

      // Step 1: Request device from user
      await requestDevice()

      // Step 2: Connect to device
      const chip = await connect()

      // Step 3: Fetch manifest
      await fetchManifest(project, variant, version)

      // Step 4: Download binaries (using detected chip)
      await downloadBinaries(chip)

      // Step 5: Flash
      await flash()

      // Step 6: Cleanup connection
      await disconnect()

      toast.add({
        title: 'Firmware Installed',
        description: 'Your device has been successfully flashed.',
        color: 'success',
      })

      return true
    } catch (e) {
      state.value = 'error'
      errorMessage.value = e instanceof Error ? e.message : 'Flash failed'

      toast.add({
        title: 'Flash Failed',
        description: errorMessage.value,
        color: 'error',
      })

      await disconnect()
      return false
    }
  }

  const currentFileName = computed(() => fileNames.value[currentFileIndex.value] ?? '')

  return {
    // State
    state,
    errorMessage,
    detectedChip,

    // Progress
    downloadProgress,
    flashProgress,
    currentFileIndex,
    totalFiles,
    currentFileName,

    // Data
    manifest,

    // Actions
    startFlash,
    reset,
    disconnect,
  }
})

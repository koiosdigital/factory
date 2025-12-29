import { defineStore } from 'pinia'
import { Transport } from 'esptool-js'
import { ref, shallowRef } from 'vue'
import { useToast } from '@nuxt/ui/composables'
import type { Terminal } from '@xterm/xterm'

import { useLicensingApi } from '@/lib/api/licensing'
import { writeSimple } from '@/lib/serial/chunkedWrite'
import { useAuthStore } from '@/stores/auth'
import { CryptoState } from '@/types/programmer'

const ESPRESSIF_VENDOR_ID = 0x303a

export const useConsoleStore = defineStore('console', () => {
  const auth = useAuthStore()
  const licensingApi = useLicensingApi()
  const toast = useToast()

  // Connection state
  const connected = ref(false)
  const port = shallowRef<SerialPort | null>(null)
  const transport = shallowRef<Transport | null>(null)

  // Crypto state (for authenticated users)
  const deviceSupportsCrypto = ref(false)
  const cryptoStatus = ref<CryptoState | null>(null)
  const needsProvisioning = ref(false)
  const provisioning = ref(false)

  // Internal state
  let terminal: Terminal | null = null
  let consoleAbortController: AbortController | null = null
  let pendingCsr: string | null = null

  const setTerminal = (term: Terminal) => {
    terminal = term
  }

  const connect = async () => {
    if (connected.value) return

    try {
      const selectedPort = await navigator.serial.requestPort({
        filters: [{ usbVendorId: ESPRESSIF_VENDOR_ID }],
      })

      port.value = selectedPort
      transport.value = new Transport(selectedPort, false)
      await transport.value.connect()
      connected.value = true

      // Reset crypto state on new connection
      deviceSupportsCrypto.value = false
      cryptoStatus.value = null
      needsProvisioning.value = false
      pendingCsr = null

      startConsoleLoop()

      // If authenticated, check crypto status after a short delay
      if (auth.isAuthenticated) {
        setTimeout(() => checkCryptoStatus(), 1000)
      }
    } catch (e) {
      toast.add({
        title: 'Connection failed',
        description: e instanceof Error ? e.message : 'Could not connect to device',
        color: 'error',
      })
    }
  }

  const disconnect = async () => {
    if (!connected.value) return

    consoleAbortController?.abort()
    consoleAbortController = null

    try {
      await transport.value?.disconnect()
    } catch {
      // Ignore disconnect errors
    }

    transport.value = null
    port.value = null
    connected.value = false
    deviceSupportsCrypto.value = false
    cryptoStatus.value = null
    needsProvisioning.value = false
    pendingCsr = null
  }

  const resetChip = async () => {
    if (!transport.value) return

    await transport.value.setRTS(true)
    await new Promise((r) => setTimeout(r, 100))
    await transport.value.setRTS(false)
  }

  const writeCommand = async (cmd: string) => {
    if (!transport.value) return
    await writeSimple(transport.value, cmd)
  }

  const startConsoleLoop = async () => {
    if (!transport.value) return

    consoleAbortController = new AbortController()
    const signal = consoleAbortController.signal

    try {
      const reader = transport.value.rawRead()
      let buffer = ''

      for await (const chunk of reader) {
        if (signal.aborted) break

        const text = new TextDecoder().decode(chunk)
        terminal?.write(text)
        buffer += text

        // Process complete lines
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (auth.isAuthenticated) {
            handleConsoleLine(line.trim())
          }
        }
      }
    } catch {
      // Console loop ended
    }
  }

  const handleConsoleLine = (line: string) => {
    // Try to parse JSON responses from device
    try {
      const json = JSON.parse(line)
      if (json && typeof json === 'object') {
        // Handle crypto status response
        if ('status' in json && typeof json.status === 'number') {
          deviceSupportsCrypto.value = true
          cryptoStatus.value = json.status as CryptoState

          // Check if device needs provisioning
          if (json.status === CryptoState.VALID_CSR) {
            needsProvisioning.value = true
            // Request CSR
            void writeCommand('get_csr\n')
          } else if (json.status === CryptoState.VALID_CERT) {
            needsProvisioning.value = false
          }
        }

        // Handle CSR response
        if ('csr' in json && typeof json.csr === 'string') {
          pendingCsr = json.csr
        }
      }
    } catch {
      // Not JSON, ignore
    }
  }

  const checkCryptoStatus = async () => {
    if (!auth.isAuthenticated) return
    if (!connected.value) return
    await writeCommand('crypto_status\n')
  }

  const provisionDevice = async () => {
    if (!auth.isAuthenticated) return
    if (!pendingCsr) {
      toast.add({
        title: 'No CSR available',
        description: 'Device has not provided a certificate signing request',
        color: 'error',
      })
      return
    }

    const accessToken = auth.getAccessToken()
    if (!accessToken) {
      toast.add({
        title: 'Not authenticated',
        description: 'Please sign in to provision devices',
        color: 'error',
      })
      return
    }

    provisioning.value = true

    try {
      // Decode base64 CSR to PEM text
      const csrText = atob(pendingCsr)
      const formData = new FormData()
      formData.append('csr', csrText)

      const { data, error, response } = await licensingApi.POST('/v1/pki/sign', {
        body: formData as unknown as { csr: string },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        parseAs: 'text',
      })

      if (error || !response.ok) {
        throw new Error('Failed to sign CSR')
      }

      // Encode certificate as base64 and send to device
      const certBase64 = btoa(data ?? '')
      await writeCommand(`set_device_cert ${certBase64}\n`)

      toast.add({
        title: 'Success',
        description: 'Device has been provisioned',
        color: 'success',
      })

      needsProvisioning.value = false
      pendingCsr = null

      // Check status again after a delay
      setTimeout(() => checkCryptoStatus(), 2000)
    } catch (e) {
      toast.add({
        title: 'Provisioning failed',
        description: e instanceof Error ? e.message : 'Could not provision device',
        color: 'error',
      })
    } finally {
      provisioning.value = false
    }
  }

  const getCryptoStatusText = (): string => {
    switch (cryptoStatus.value) {
      case CryptoState.UNINITIALIZED:
        return 'Uninitialized'
      case CryptoState.KEY_GENERATED:
        return 'Key Generated'
      case CryptoState.VALID_CSR:
        return 'CSR Ready'
      case CryptoState.VALID_CERT:
        return 'Provisioned'
      case CryptoState.BAD_DS:
        return 'Invalid DS'
      default:
        return 'Unknown'
    }
  }

  return {
    // State
    connected,
    deviceSupportsCrypto,
    cryptoStatus,
    needsProvisioning,
    provisioning,

    // Actions
    connect,
    disconnect,
    resetChip,
    checkCryptoStatus,
    provisionDevice,
    setTerminal,
    getCryptoStatusText,
  }
})

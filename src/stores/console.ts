import { defineStore, storeToRefs } from 'pinia'
import { Transport } from 'esptool-js'
import { ref, shallowRef } from 'vue'
import { useToast } from '@nuxt/ui/composables'
import type { Terminal } from '@xterm/xterm'

import { useLicensingApi } from '@/lib/api/licensing'
import { writeChunked } from '@/lib/serial/chunkedWrite'
import { useAuthStore } from '@/stores/auth'
import { CryptoState } from '@/types/programmer'

const ESPRESSIF_VENDOR_ID = 0x303a

export const useConsoleStore = defineStore('console', () => {
  const authStore = useAuthStore()
  const { isAuthenticated } = storeToRefs(authStore)
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

  // Callback for CSR response
  let csrResolve: ((csr: string) => void) | null = null
  // Accumulator for the multi-line PEM CSR emitted by the device
  let csrBuffer: string[] | null = null
  // Callback for a pending [OK]/[ERROR] command acknowledgement
  let responseHandler: ((line: string) => void) | null = null

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
      csrResolve = null
      csrBuffer = null
      responseHandler = null

      startConsoleLoop()

      // If authenticated, check crypto status after a short delay
      if (isAuthenticated.value) {
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
    csrResolve = null
    csrBuffer = null
    responseHandler = null
  }

  const resetChip = async () => {
    if (!transport.value) return

    await transport.value.setRTS(true)
    await new Promise((r) => setTimeout(r, 100))
    await transport.value.setRTS(false)
  }

  const writeCommand = async (cmd: string) => {
    if (!transport.value) return
    await writeChunked(transport.value, cmd)
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
          if (isAuthenticated.value) {
            handleConsoleLine(line.trim())
          }
        }
      }
    } catch {
      // Console loop ended
    }
  }

  const handleConsoleLine = (line: string) => {
    // The device emits the CSR as raw multi-line PEM (not JSON), so capture the
    // block between the BEGIN/END markers and resolve once it's complete.
    if (line === '-----BEGIN CERTIFICATE REQUEST-----') {
      csrBuffer = [line]
      return
    }
    if (csrBuffer) {
      csrBuffer.push(line)
      if (line === '-----END CERTIFICATE REQUEST-----') {
        const pem = csrBuffer.join('\n')
        csrBuffer = null
        if (csrResolve) {
          csrResolve(pem)
          csrResolve = null
        }
      }
      return
    }

    // Dispatch [OK]/[ERROR] acknowledgements to a pending command waiter
    if (responseHandler && (line.startsWith('[OK]') || line.startsWith('[ERROR]'))) {
      responseHandler(line)
      return
    }

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
          } else if (json.status === CryptoState.VALID_CERT) {
            needsProvisioning.value = false
          }
        }
      }
    } catch {
      // Not JSON, ignore
    }
  }

  const checkCryptoStatus = async () => {
    if (!isAuthenticated.value) return
    if (!connected.value) return
    await writeCommand('crypto_status\n')
  }

  const requestCsr = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeout = setTimeout(() => {
        csrResolve = null
        csrBuffer = null
        reject(new Error('Timeout waiting for CSR from device'))
      }, 10000)

      // Set up callback
      csrResolve = (csr: string) => {
        clearTimeout(timeout)
        resolve(csr)
      }

      // Send command to device
      writeCommand('get_csr\n')
    })
  }

  // Send a command and wait for its [OK] (resolve) / [ERROR] (reject) ack.
  const sendCommandAwaitOk = (cmd: string, timeoutMs = 5000): Promise<void> => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        responseHandler = null
        reject(new Error(`Timeout waiting for response to: ${cmd.trim()}`))
      }, timeoutMs)

      responseHandler = (line: string) => {
        clearTimeout(timeout)
        responseHandler = null
        if (line.startsWith('[OK]')) {
          resolve()
        } else {
          reject(new Error(line))
        }
      }

      writeCommand(cmd)
    })
  }

  const provisionDevice = async () => {
    if (!isAuthenticated.value) return

    const accessToken = authStore.getAccessToken()
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
      // Step 1: Request CSR from device (raw PEM text)
      const csrText = await requestCsr()

      // Step 2: Send the PEM CSR to the licensing API for signing
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

      // Step 3: Encode certificate as base64 and upload to device in chunks.
      // The device concatenates all chunks and decodes them on commit, so the
      // base64 just needs to be split into pieces small enough for the console.
      const certBase64 = btoa(data ?? '')
      const CHUNK_SIZE = 512

      await sendCommandAwaitOk('set_cert_start\n')
      let chunkIndex = 0
      for (let i = 0; i < certBase64.length; i += CHUNK_SIZE) {
        const chunk = certBase64.slice(i, i + CHUNK_SIZE)
        await sendCommandAwaitOk(`set_cert_chunk ${chunkIndex} ${chunk}\n`)
        chunkIndex++
      }
      await sendCommandAwaitOk('set_cert_commit\n')

      toast.add({
        title: 'Success',
        description: 'Device has been provisioned',
        color: 'success',
      })

      needsProvisioning.value = false

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

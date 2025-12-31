<template>
  <UContainer class="py-8 space-y-6">
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-xl font-semibold">Device Console</h1>
            <p class="text-sm text-zinc-600 dark:text-zinc-400">Monitor your device's serial output</p>
          </div>
          <UBadge :color="consoleStore.connected ? 'success' : 'neutral'" size="lg">
            {{ consoleStore.connected ? 'Connected' : 'Disconnected' }}
          </UBadge>
        </div>
      </template>

      <!-- Connection Controls -->
      <div class="flex flex-wrap gap-3 mb-4">
        <UButton
          v-if="!consoleStore.connected"
          color="primary"
          icon="lucide:plug"
          @click="consoleStore.connect"
        >
          Connect Device
        </UButton>
        <template v-else>
          <UButton
            color="neutral"
            variant="outline"
            icon="lucide:rotate-ccw"
            @click="consoleStore.resetChip"
          >
            Reset
          </UButton>
          <UButton
            color="neutral"
            variant="ghost"
            icon="lucide:unplug"
            @click="consoleStore.disconnect"
          >
            Disconnect
          </UButton>
        </template>
      </div>

      <!-- Terminal -->
      <div
        ref="terminalRef"
        class="terminal-container h-96 rounded-lg border border-zinc-300 dark:border-zinc-800 bg-black overflow-hidden"
      />

      <p class="mt-3 text-xs text-zinc-500">
        Serial output from the connected device appears here.
      </p>
    </UCard>

    <!-- Crypto Status (authenticated users + crypto-capable device) -->
    <div
      v-if="auth.isAuthenticated && consoleStore.deviceSupportsCrypto"
      class="grid gap-4 md:grid-cols-2"
    >
      <UCard>
        <div class="flex items-center gap-4">
          <div class="p-3 rounded-full bg-pink-500/10">
            <UIcon name="lucide:shield-check" class="w-6 h-6 text-pink-500" />
          </div>
          <div>
            <p class="text-sm text-zinc-600 dark:text-zinc-400">Crypto Engine</p>
            <p class="font-medium">{{ consoleStore.getCryptoStatusText() }}</p>
          </div>
        </div>
      </UCard>

      <UCard v-if="consoleStore.needsProvisioning">
        <div class="flex items-center justify-between h-full">
          <div>
            <p class="font-medium">Provisioning Required</p>
            <p class="text-sm text-zinc-600 dark:text-zinc-400">This device needs a certificate</p>
          </div>
          <UButton color="primary" icon="lucide:key" @click="showProvisionModal = true">
            Provision
          </UButton>
        </div>
      </UCard>
    </div>

    <!-- Provisioning Modal -->
    <UModal v-model:open="showProvisionModal">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center gap-3">
              <div class="p-2 rounded-full bg-pink-500/10">
                <UIcon name="lucide:shield" class="w-5 h-5 text-pink-500" />
              </div>
              <h3 class="font-semibold">Device Provisioning</h3>
            </div>
          </template>

          <p class="text-zinc-700 dark:text-zinc-300">Device needs provisioning. Provision now?</p>
          <p class="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
            This will sign the device's certificate request and install the certificate.
          </p>

          <template #footer>
            <div class="flex justify-end gap-3">
              <UButton variant="ghost" @click="showProvisionModal = false"> Cancel </UButton>
              <UButton
                color="primary"
                :loading="consoleStore.provisioning"
                @click="handleProvision"
              >
                Provision Device
              </UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </UContainer>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useHead } from '@unhead/vue'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'

import { useAuthStore } from '@/stores/auth'
import { useConsoleStore } from '@/stores/console'

useHead({ title: 'Console' })

const auth = useAuthStore()
const consoleStore = useConsoleStore()

const terminalRef = ref<HTMLElement | null>(null)
const showProvisionModal = ref(false)

let terminal: Terminal | null = null

const handleProvision = async () => {
  await consoleStore.provisionDevice()
  showProvisionModal.value = false
}

onMounted(() => {
  terminal = new Terminal({
    cursorBlink: true,
    fontSize: 14,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    convertEol: true,
    theme: {
      background: '#000000',
      foreground: '#e4e4e7',
      cursor: '#ec4899',
      cursorAccent: '#000000',
      selectionBackground: '#3f3f46',
      // ANSI colors
      black: '#27272a',
      red: '#f87171',
      green: '#4ade80',
      yellow: '#facc15',
      blue: '#60a5fa',
      magenta: '#f472b6',
      cyan: '#22d3ee',
      white: '#e4e4e7',
      // Bright ANSI colors
      brightBlack: '#52525b',
      brightRed: '#fca5a5',
      brightGreen: '#86efac',
      brightYellow: '#fde047',
      brightBlue: '#93c5fd',
      brightMagenta: '#f9a8d4',
      brightCyan: '#67e8f9',
      brightWhite: '#fafafa',
    },
  })

  if (terminalRef.value) {
    terminal.open(terminalRef.value)
    consoleStore.setTerminal(terminal)
  }
})

onUnmounted(() => {
  terminal?.dispose()
})
</script>

<style scoped>
.terminal-container :deep(.xterm) {
  padding: 0.5rem;
  height: 100%;
}

.terminal-container :deep(.xterm-viewport) {
  overflow-y: auto !important;
}
</style>

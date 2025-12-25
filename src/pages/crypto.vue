<template>
  <UContainer class="py-8 space-y-6">
    <UCard>
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="space-y-1">
          <p class="text-xs uppercase tracking-[0.3em] text-white/60">
            Provisioning
          </p>
          <h1 class="text-2xl font-semibold text-white">Crypto station</h1>
          <p class="text-sm text-white/60">
            Connect a Koios device to inspect crypto material, sign CSRs, and
            verify certificates before flashing firmware.
          </p>
        </div>
        <div class="flex flex-wrap gap-3">
          <UButton
            color="primary"
            icon="lucide:plug"
            :loading="connecting"
            :disabled="!canInitiateConnection"
            @click="connect"
          >
            {{ connecting ? "Connecting" : "Connect device" }}
          </UButton>
          <UButton
            color="warning"
            variant="soft"
            icon="lucide:rotate-ccw"
            :disabled="!connected"
            @click="reset"
          >
            Reset chip
          </UButton>
          <UButton
            color="neutral"
            variant="ghost"
            icon="lucide:plug-zap"
            :disabled="!connected && !connecting"
            @click="disconnect"
          >
            Disconnect
          </UButton>
        </div>
      </div>
      <div class="mt-4 flex flex-wrap gap-3 text-xs text-white/60">
        <span>{{ connectionBadge.text }}</span>
        <span class="hidden sm:inline">•</span>
        <span>{{ portInfo ?? "No serial device" }}</span>
      </div>
    </UCard>

    <div class="grid gap-4 md:grid-cols-3">
      <StatusPill v-for="card in statusCards" :key="card.label" v-bind="card" />
    </div>

    <div class="grid gap-6 xl:grid-cols-[2fr,1fr]">
      <UCard :ui="{ body: 'space-y-6' }">
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">Device workflow</h3>
            <UBadge :color="connectionBadge.color">{{
              connectionBadge.text
            }}</UBadge>
          </div>
        </template>

        <section class="space-y-3">
          <h4 class="text-sm font-medium text-white">Connection controls</h4>
          <div class="flex flex-wrap gap-3">
            <UButton
              color="primary"
              icon="lucide:plug"
              :loading="connecting"
              :disabled="!canInitiateConnection"
              @click="connect"
            >
              {{ connecting ? "Connecting" : "Connect" }}
            </UButton>
            <UButton
              color="warning"
              variant="soft"
              icon="lucide:rotate-ccw"
              :disabled="!connected"
              @click="reset"
            >
              Reset chip
            </UButton>
            <UButton
              color="neutral"
              variant="ghost"
              icon="lucide:plug-zap"
              :disabled="!connected && !connecting"
              @click="disconnect"
            >
              Disconnect
            </UButton>
          </div>
          <p class="text-sm text-white/60">
            Authorize a USB serial device to stream KD console logs. Reset is
            helpful if the console stops responding or after provisioning is
            complete.
          </p>
        </section>

        <section class="space-y-4">
          <div class="flex items-center justify-between">
            <h4 class="text-sm font-medium text-white">Provisioning</h4>
            <UBadge variant="soft" :color="cryptoStateBadge.color">
              {{ cryptoStateBadge.text }}
            </UBadge>
          </div>

          <UAlert
            v-if="!connected"
            color="neutral"
            title="Awaiting device"
            description="Connect a board to read its provisioning status."
          />

          <UAlert
            v-else-if="signingCSR"
            color="info"
            title="Signing CSR"
            description="Hold tight while we ask the factory service for a certificate."
          />

          <UAlert
            v-else-if="cryptoStatus === CryptoState.KEY_GENERATED"
            color="warning"
            title="Generating keys"
            description="The device is still creating its secure element."
          />

          <UAlert
            v-else-if="cryptoStatus === CryptoState.VALID_CSR"
            color="info"
            title="CSR ready"
            description="Request a signed device certificate to finish provisioning."
          />

          <UAlert
            v-else-if="cryptoStatus === CryptoState.VALID_CERT"
            color="success"
            title="Provisioned"
            description="Device has a valid certificate and is ready for firmware."
          />

          <div class="flex flex-wrap gap-3">
            <UButton
              color="primary"
              icon="lucide:file-badge"
              :disabled="!canRequestCertificate"
              :loading="signingCSR"
              @click="signCSR"
            >
              Generate certificate
            </UButton>
            <UButton
              color="neutral"
              variant="ghost"
              icon="lucide:trash-2"
              :disabled="!connected"
              @click="reset"
            >
              Clear session
            </UButton>
          </div>
        </section>
      </UCard>

      <UCard :ui="{ body: 'space-y-4' }">
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">Device details</h3>
            <UBadge :color="kdConsoleBadge.color">{{
              kdConsoleBadge.text
            }}</UBadge>
          </div>
        </template>

        <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p class="text-xs uppercase tracking-widest text-white/50">
            USB identifiers
          </p>
          <p class="mt-1 text-lg font-semibold text-white">
            {{ portInfo ?? "No device connected" }}
          </p>
        </div>

        <div class="space-y-3 text-sm">
          <div class="flex items-center justify-between">
            <span class="text-white/70">CSR status</span>
            <UBadge :color="csrReady ? 'success' : 'warning'">
              {{ csrReady ? "Available" : "Waiting" }}
            </UBadge>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-white/70">Certificate</span>
            <UBadge :color="certificateReady ? 'success' : 'error'">
              {{ certificateReady ? "Provisioned" : "Missing" }}
            </UBadge>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-white/70">Console</span>
            <UBadge :color="kdConsoleReady ? 'success' : 'warning'">
              {{ kdConsoleReady ? "TTY ready" : "Listening" }}
            </UBadge>
          </div>
        </div>

        <USeparator />

        <p class="text-xs text-white/50">
          Provisioning requires an authenticated operator session. Keep the
          device connected until the certificate step completes to avoid
          restarting the secure element workflow.
        </p>
      </UCard>
    </div>
  </UContainer>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount } from "vue";

import StatusPill from "@/components/ui/StatusPill.vue";
import { useCryptoStore } from "@/stores/crypto";
import { CryptoState, SerialState } from "@/types/programmer";

type StatusColor =
  | "success"
  | "error"
  | "warning"
  | "neutral"
  | "info"
  | "primary";

type StatusBadge = {
  color: StatusColor;
  icon: string;
  text: string;
  description: string;
};

type StatusCard = {
  label: string;
  value: string;
  description?: string;
  color?: StatusColor;
  icon?: string;
};

const crypto = useCryptoStore();

const port = computed(() => crypto.port);
const state = computed(() => crypto.serialConnectionState);
const kdConsoleReady = computed(() => crypto.kdConsoleReady);
const signingCSR = computed(() => crypto.signingCSR);
const cryptoStatus = computed(() => crypto.cryptoState);

const connected = computed(() => state.value === SerialState.CONNECTED);
const connecting = computed(() => state.value === SerialState.CONNECTING);
const canInitiateConnection = computed(
  () => state.value === SerialState.DISCONNECTED
);

const csrReady = computed(() => cryptoStatus.value >= CryptoState.VALID_CSR);
const certificateReady = computed(
  () => cryptoStatus.value >= CryptoState.VALID_CERT
);

const serialConnectionBadge = computed<StatusBadge>(() => {
  if (connecting.value) {
    return {
      color: "info",
      icon: "lucide:loader",
      text: "Connecting",
      description: "Authorizing serial port",
    };
  }

  if (connected.value) {
    return {
      color: "success",
      icon: "lucide:check-circle",
      text: "Connected",
      description: "Serial link established",
    };
  }

  return {
    color: "neutral",
    icon: "lucide:plug",
    text: "Disconnected",
    description: "No device selected",
  };
});

const cryptoStateBadge = computed<StatusBadge>(() => {
  switch (cryptoStatus.value) {
    case CryptoState.KEY_GENERATED:
      return {
        color: "warning",
        icon: "lucide:key",
        text: "Key generated",
        description: "Waiting on CSR",
      };
    case CryptoState.VALID_CSR:
      return {
        color: "info",
        icon: "lucide:file-text",
        text: "CSR ready",
        description: "Request signing",
      };
    case CryptoState.VALID_CERT:
      return {
        color: "success",
        icon: "lucide:badge-check",
        text: "Provisioned",
        description: "Certificate stored",
      };
    default:
      return {
        color: "neutral",
        icon: "lucide:shield",
        text: "Uninitialized",
        description: "Awaiting crypto status",
      };
  }
});

const kdConsoleBadge = computed<StatusBadge>(() => {
  if (signingCSR.value) {
    return {
      color: "info",
      icon: "lucide:loader",
      text: "Provisioning",
      description: "Factory API in progress",
    };
  }

  if (!connected.value) {
    return {
      color: "neutral",
      icon: "lucide:terminal",
      text: "Offline",
      description: "Connect to read logs",
    };
  }

  if (kdConsoleReady.value) {
    return {
      color: "success",
      icon: "lucide:terminal",
      text: "TTY ready",
      description: "Console streaming",
    };
  }

  return {
    color: "warning",
    icon: "lucide:clock-3",
    text: "Listening",
    description: "Waiting for tty>",
  };
});

const statusCards = computed<StatusCard[]>(() => [
  {
    label: "Serial link",
    value: serialConnectionBadge.value.text,
    description: serialConnectionBadge.value.description,
    color: serialConnectionBadge.value.color,
    icon: serialConnectionBadge.value.icon,
  },
  {
    label: "Crypto stage",
    value: cryptoStateBadge.value.text,
    description: cryptoStateBadge.value.description,
    color: cryptoStateBadge.value.color,
    icon: cryptoStateBadge.value.icon,
  },
  {
    label: "KD console",
    value: kdConsoleBadge.value.text,
    description: kdConsoleBadge.value.description,
    color: kdConsoleBadge.value.color,
    icon: kdConsoleBadge.value.icon,
  },
]);

const connectionBadge = computed(() => serialConnectionBadge.value);

const portInfo = computed(() => {
  const info = port.value?.getInfo?.();
  if (!info) return null;
  const vendor = info.usbVendorId
    ? `0x${info.usbVendorId.toString(16).padStart(4, "0")}`
    : "Unknown";
  const product = info.usbProductId
    ? `0x${info.usbProductId.toString(16).padStart(4, "0")}`
    : "Unknown";
  return `${vendor} : ${product}`;
});

const canRequestCertificate = computed(
  () => connected.value && csrReady.value && !signingCSR.value
);

const connect = () => crypto.connect();
const disconnect = () => crypto.disconnect();
const reset = () => crypto.resetChip();
const signCSR = () => crypto.generateCertificate();

onBeforeUnmount(() => {
  void crypto.disconnect();
});
</script>

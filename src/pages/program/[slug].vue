<template>
  <UContainer class="py-8 space-y-6">
    <UCard>
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="space-y-1">
          <p class="text-xs uppercase tracking-[0.3em] text-white/60">
            Project
          </p>
          <h1 class="text-2xl font-semibold text-white">
            {{ project?.name ?? slug }}
          </h1>
          <p class="text-sm text-white/60">
            Prepare your Koios device for flashing and secure provisioning.
          </p>
        </div>
        <div class="flex flex-wrap gap-3">
          <UButton
            color="primary"
            variant="soft"
            icon="lucide:plug"
            :loading="autoConnecting"
            @click="handleAutoConnect"
          >
            Auto connect
          </UButton>
          <UButton
            color="neutral"
            variant="ghost"
            icon="lucide:refresh-ccw"
            :loading="loading"
            @click="fetchProject"
          >
            Refresh metadata
          </UButton>
        </div>
      </div>
      <div class="mt-4 flex flex-wrap gap-3 text-xs text-white/60">
        <span
          >{{ variantOptions.length }} firmware option{{
            variantOptions.length === 1 ? "" : "s"
          }}</span
        >
        <span class="hidden sm:inline">•</span>
        <span>Slug: {{ slug }}</span>
      </div>
    </UCard>

    <div class="grid gap-4 md:grid-cols-3">
      <StatusPill v-for="card in statusCards" :key="card.label" v-bind="card" />
    </div>

    <div v-if="loadError">
      <UAlert
        color="error"
        title="Unable to load project"
        :description="loadError"
      />
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
              :loading="connectionBusy"
              :disabled="connected"
              @click="programmer.openPortSelection"
            >
              Connect device
            </UButton>
            <UButton
              color="warning"
              variant="soft"
              icon="lucide:rotate-ccw"
              :disabled="!connected"
              @click="programmer.resetChip"
            >
              Reset chip
            </UButton>
            <UButton
              color="neutral"
              variant="ghost"
              icon="lucide:plug-zap"
              :disabled="!connected"
              @click="handleDisconnect"
            >
              Disconnect
            </UButton>
          </div>
          <p class="text-sm text-white/60">
            Use auto connect for approved devices or manually select a serial
            port. Reset the chip if the console becomes unresponsive.
          </p>
        </section>

        <section class="space-y-3">
          <div class="flex items-center justify-between">
            <h4 class="text-sm font-medium text-white">Firmware variant</h4>
            <UBadge variant="soft" color="info">
              {{ selectedVariant ?? "No selection" }}
            </UBadge>
          </div>

          <div v-if="loading" class="space-y-2">
            <USkeleton class="h-10 w-full" />
            <USkeleton class="h-10 w-3/4" />
          </div>
          <UAlert
            v-else-if="!variantOptions.length"
            color="warning"
            title="No variants available"
            description="This project has no published firmware variants yet."
          />
          <div v-else class="flex flex-wrap gap-2">
            <UButton
              v-for="variant in variantOptions"
              :key="variant.value"
              :color="selectedVariant === variant.value ? 'primary' : 'neutral'"
              :variant="selectedVariant === variant.value ? 'solid' : 'ghost'"
              class="rounded-full"
              @click="selectVariant(variant.value)"
            >
              {{ variant.label }}
            </UButton>
          </div>

          <div class="flex flex-wrap gap-3">
            <UButton
              color="primary"
              icon="lucide:flashlight"
              :disabled="!canFlash"
              :loading="
                programmer.firmwareFlashState === FirmwareFlashState.FLASHING
              "
              @click="handleFlash"
            >
              Flash firmware
            </UButton>
            <UButton
              color="neutral"
              variant="ghost"
              icon="lucide:trash-2"
              :disabled="!selectedVariant"
              @click="selectedVariant = null"
            >
              Clear selection
            </UButton>
          </div>
        </section>
      </UCard>

      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">Live console</h3>
            <UBadge :color="connected ? 'success' : 'neutral'">
              {{ connected ? "Streaming" : "Waiting" }}
            </UBadge>
          </div>
        </template>
        <div class="h-72 rounded-2xl border border-white/10 bg-black/80">
          <div ref="terminalRef" class="h-full" />
        </div>
        <p class="mt-3 text-xs text-white/50">
          Output mirrors the KD console whenever a device is connected.
        </p>
      </UCard>
    </div>
  </UContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useToast } from "@nuxt/ui/composables";

import StatusPill from "@/components/ui/StatusPill.vue";
import { useFirmwareApi } from "@/lib/api/firmware";
import { useProgrammerStore } from "@/stores/programmer";
import type { components } from "@/types/firmware-api";
import {
  AutoConnectResult,
  CryptoState,
  FirmwareFlashState,
  SerialState,
} from "@/types/programmer";

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

type ProjectVariantsResponse = components["schemas"]["ProjectVariantsResponse"];

const route = useRoute();
const slug = computed(() => route.params.slug as string);
const firmware = useFirmwareApi();
const programmer = useProgrammerStore();
const toast = useToast();

const project = ref<ProjectVariantsResponse | null>(null);
const loading = ref(false);
const loadError = ref("");
const selectedVariant = ref<string | null>(null);
const autoConnecting = ref(false);
const terminalRef = ref<HTMLElement | null>(null);

const fetchProject = async () => {
  if (!slug.value) return;
  loading.value = true;
  loadError.value = "";

  try {
    const { data, error } = await firmware.GET("/projects/{slug}", {
      params: { path: { slug: slug.value } },
    });

    if (error || !data) {
      throw error ?? new Error("Project not found");
    }

    project.value = data;
    selectedVariant.value = null;
  } catch (error) {
    loadError.value =
      error instanceof Error ? error.message : "Failed to load project";
  } finally {
    loading.value = false;
  }
};

watch(slug, fetchProject, { immediate: true });

const variantOptions = computed(() => {
  if (project.value?.variants?.length) {
    return project.value.variants.map((variant) => ({
      label: variant,
      value: variant,
    }));
  }
  return [];
});

const serialConnectionBadge = computed<StatusBadge>(() => {
  switch (programmer.serialConnectionState) {
    case SerialState.CONNECTED:
      return {
        color: "success",
        icon: "lucide:check-circle",
        text: "Connected",
        description: "Serial link established",
      };
    case SerialState.DISCONNECTED:
      return {
        color: "error",
        icon: "lucide:circle-off",
        text: "Disconnected",
        description: "Awaiting USB pairing",
      };
    case SerialState.CONNECTING:
      return {
        color: "warning",
        icon: "lucide:loader",
        text: "Connecting",
        description: "Authorizing serial port",
      };
    default:
      return {
        color: "neutral",
        icon: "lucide:info",
        text: "Unknown",
        description: "Idle",
      };
  }
});

const firmwareFlashBadge = computed<StatusBadge>(() => {
  switch (programmer.firmwareFlashState) {
    case FirmwareFlashState.FLASHING:
      return {
        color: "warning",
        icon: "lucide:flashlight",
        text: "Flashing",
        description: "Writing images",
      };
    case FirmwareFlashState.FLASHED:
      return {
        color: "success",
        icon: "lucide:check-circle",
        text: "Flashed",
        description: "Firmware verified",
      };
    case FirmwareFlashState.NOT_FLASHED:
      return {
        color: "error",
        icon: "lucide:circle-off",
        text: "Not flashed",
        description: "Select a variant",
      };
    case FirmwareFlashState.DETERMINING:
      return {
        color: "info",
        icon: "lucide:loader",
        text: "Determining",
        description: "Detecting ROM",
      };
    default:
      return {
        color: "neutral",
        icon: "lucide:info",
        text: "Pending",
        description: "Awaiting action",
      };
  }
});

const cryptoStateBadge = computed<StatusBadge>(() => {
  switch (programmer.cryptoState) {
    case CryptoState.KEY_GENERATED:
      return {
        color: "warning",
        icon: "lucide:key",
        text: "Key generated",
        description: "Waiting for CSR",
      };
    case CryptoState.VALID_CSR:
      return {
        color: "info",
        icon: "lucide:shield-check",
        text: "CSR ready",
        description: "Sign via factory",
      };
    case CryptoState.VALID_CERT:
      return {
        color: "success",
        icon: "lucide:badge-check",
        text: "Provisioned",
        description: "Device trusted",
      };
    default:
      return {
        color: "neutral",
        icon: "lucide:info",
        text: "Uninitialized",
        description: "Crypto pending",
      };
  }
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
    label: "Firmware",
    value: firmwareFlashBadge.value.text,
    description: firmwareFlashBadge.value.description,
    color: firmwareFlashBadge.value.color,
    icon: firmwareFlashBadge.value.icon,
  },
  {
    label: "Crypto engine",
    value: cryptoStateBadge.value.text,
    description: cryptoStateBadge.value.description,
    color: cryptoStateBadge.value.color,
    icon: cryptoStateBadge.value.icon,
  },
]);

const connectionBadge = computed(() => serialConnectionBadge.value);
const connectionBusy = computed(
  () => programmer.serialConnectionState === SerialState.CONNECTING
);
const connected = computed(
  () => programmer.serialConnectionState === SerialState.CONNECTED
);

const canFlash = computed(
  () =>
    connected.value &&
    Boolean(selectedVariant.value) &&
    programmer.firmwareFlashState !== FirmwareFlashState.FLASHING &&
    !loadError.value
);

const selectVariant = (value: string) => {
  selectedVariant.value = value;
};

const handleFlash = async () => {
  if (!selectedVariant.value) return;
  await programmer.flashFirmware(selectedVariant.value);
};

const handleDisconnect = () => {
  programmer.disconnectFromDevice();
};

const handleAutoConnect = async () => {
  if (autoConnecting.value) return;
  autoConnecting.value = true;
  try {
    const result = await programmer.attemptDeviceAutoConnect();
    if (result === AutoConnectResult.SUCCESS) {
      toast.add({
        title: "Device connected",
        description: "We reused a previously authorized serial port.",
        color: "success",
      });
    } else if (result === AutoConnectResult.NO_AUTHORIZED_PORTS) {
      toast.add({
        title: "No authorized devices",
        description: "Plug in a Koios board and try again.",
        color: "warning",
      });
    }
  } catch (error) {
    toast.add({
      title: "Auto connect failed",
      description: error instanceof Error ? error.message : String(error),
      color: "error",
    });
  } finally {
    autoConnecting.value = false;
  }
};

onMounted(() => {
  const terminal = new Terminal({
    cursorBlink: true,
    fontSize: 16,
    theme: {
      background: "#050505",
      foreground: "#f5f5f5",
    },
  });

  if (terminalRef.value) {
    terminal.open(terminalRef.value);
    programmer.setTerminal(terminal);
  }
});
</script>

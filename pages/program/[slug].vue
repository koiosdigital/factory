<template>
  <UContainer>
    <div class="w-full flex items-center justify-center mt-8 flex-col gap-4">
      <UPageCard variant="subtle" class="w-full">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold">Flasher</h2>
          <div class="flex gap-4 items-center">
            <UBadge color="info">Project: {{ slug }}</UBadge>
            <UBadge v-if="selectedVariant" color="info">{{
              selectedVariant
            }}</UBadge>
            <UBadge v-else color="warning">Variant: Unselected</UBadge>
          </div>
        </div>
        <USeparator />
        <div class="flex gap-4 items-center justify-start">
          <UBadge
            :color="serialConnectionBadge.color"
            :icon="serialConnectionBadge.icon"
          >
            Serial: {{ serialConnectionBadge.text }}
          </UBadge>
          <UBadge
            :color="firmwareFlashBadge.color"
            :icon="firmwareFlashBadge.icon"
          >
            Firmware: {{ firmwareFlashBadge.text }}
          </UBadge>
          <UBadge :color="cryptoStateBadge.color" :icon="cryptoStateBadge.icon">
            Crypto Engine: {{ cryptoStateBadge.text }}
          </UBadge>
        </div>
      </UPageCard>
      <UPageCard variant="subtle" class="w-full">
        <template
          v-if="programmer.serialConnectionState === SerialState.DISCONNECTED"
        >
          <h2 class="text-lg font-semibold">No Device Connected</h2>

          <p>Click button below if device does not automatically connect</p>

          <UButton size="lg" @click="programmer.openPortSelection"
            >Connect</UButton
          >
        </template>
        <template
          v-else-if="
            programmer.firmwareFlashState === FirmwareFlashState.DETERMINING
          "
        >
          <h2 class="text-lg font-semibold">Wait</h2>

          <UAlert
            color="neutral"
            title="Wait"
            description="Determining Firmware"
          />
        </template>
        <template
          v-else-if="
            programmer.firmwareFlashState === FirmwareFlashState.NOT_FLASHED
          "
        >
          <template v-if="!selectedVariant">
            <h2 class="text-lg font-semibold" size="lg">Select Variant</h2>

            <UButton
              v-for="variant of variantOptions"
              :key="variant.label"
              @click="doFlash(variant.value)"
              >{{ variant.label }}</UButton
            >
          </template>
        </template>
        <div id="terminal" class="w-full" />
      </UPageCard>
    </div>
  </UContainer>
</template>

<script setup lang="ts">
import type { components } from "~/types/firmware-api";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import {
  SerialState,
  FirmwareFlashState,
  CryptoState,
} from "~/types/programmer";
import { useFirmwareApi } from "~/lib/api/firmware";

const slug = useRoute().params.slug as string;
type ProjectVariantsResponse = components["schemas"]["ProjectVariantsResponse"];

const firmware = useFirmwareApi();

const { data: project } = useAsyncData<ProjectVariantsResponse>(
  `project:${slug}`,
  async () => {
    const { data, error } = await firmware.GET("/projects/{slug}", {
      params: { path: { slug } },
    });
    if (error || !data) throw error;
    return data;
  }
);

const selectedVariant = ref<string | null>(null);

const variantOptions = computed(() => {
  if (project.value?.variants?.length) {
    return project.value.variants.map((variant) => ({
      label: variant,
      value: variant,
    }));
  }
  return [];
});

const programmer = useProgrammerStore();

const serialConnectionBadge = computed<{
  color: "success" | "error" | "warning" | "neutral" | "info";
  icon: string;
  text: string;
}>(() => {
  switch (programmer.serialConnectionState) {
    case SerialState.CONNECTED:
      return {
        color: "success",
        icon: "lucide-check-circle",
        text: "Connected",
      };
    case SerialState.DISCONNECTED:
      return {
        color: "error",
        icon: "lucide-circle-x",
        text: "Disconnected",
      };
    case SerialState.CONNECTING:
      return {
        color: "warning",
        icon: "lucide-triangle-alert",
        text: "Connecting",
      };
    default:
      return {
        color: "neutral",
        icon: "lucide-info",
        text: "Not Connected",
      };
  }
});

const firmwareFlashBadge = computed<{
  color: "success" | "error" | "warning" | "neutral" | "info";
  icon: string;
  text: string;
}>(() => {
  switch (programmer.firmwareFlashState) {
    case FirmwareFlashState.FLASHING:
      return {
        color: "warning",
        icon: "lucide-triangle-alert",
        text: "Flashing",
      };
    case FirmwareFlashState.FLASHED:
      return {
        color: "success",
        icon: "lucide-check-circle",
        text: "Flashed",
      };
    case FirmwareFlashState.NOT_FLASHED:
      return {
        color: "error",
        icon: "lucide-circle-x",
        text: "Not Flashed",
      };
    default:
      return {
        color: "neutral",
        icon: "lucide-info",
        text: "Not Flashed",
      };
  }
});

const cryptoStateBadge = computed<{
  color: "success" | "error" | "warning" | "neutral" | "info";
  icon: string;
  text: string;
}>(() => {
  switch (programmer.cryptoState) {
    case CryptoState.UNINITIALIZED:
      return {
        color: "neutral",
        icon: "lucide-info",
        text: "Uninitialized",
      };
    case CryptoState.KEY_GENERATED:
      return {
        color: "warning",
        icon: "lucide-triangle-alert",
        text: "Key Generated",
      };
    case CryptoState.VALID_CSR:
      return {
        color: "info",
        icon: "lucide-info",
        text: "Valid CSR",
      };
    case CryptoState.VALID_CERT:
      return {
        color: "success",
        icon: "lucide-check-circle",
        text: "Valid Certificate",
      };
    default:
      return {
        color: "neutral",
        icon: "lucide-info",
        text: "Not Generated",
      };
  }
});

onMounted(() => {
  const terminal = new Terminal({
    cursorBlink: true,
    fontSize: 16,
    theme: {
      background: "#1e1e1e",
      foreground: "#ffffff",
    },
  });

  terminal.open(document.getElementById("terminal") as HTMLElement);
  programmer.setTerminal(terminal);
});

const doFlash = async (variant: string) => {
  selectedVariant.value = variant;
  await programmer.flashFirmware(selectedVariant.value);
};
</script>

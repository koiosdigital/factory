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
        <UAlert
          v-if="loadError"
          class="mt-4"
          color="error"
          title="Unable to load project"
          :description="loadError"
        />
      </UPageCard>
      <UPageCard variant="subtle" class="w-full">
        <div v-if="loading" class="py-6 flex justify-center">
          <UProgress />
        </div>
        <template
          v-else-if="
            programmer.serialConnectionState === SerialState.DISCONNECTED
          "
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
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";

import { useFirmwareApi } from "@/lib/api/firmware";
import { useProgrammerStore } from "@/stores/programmer";
import type { components } from "@/types/firmware-api";
import {
  CryptoState,
  FirmwareFlashState,
  SerialState,
} from "@/types/programmer";

type ProjectVariantsResponse = components["schemas"]["ProjectVariantsResponse"];

const route = useRoute();
const slug = computed(() => route.params.slug as string);
const firmware = useFirmwareApi();
const programmer = useProgrammerStore();

const project = ref<ProjectVariantsResponse | null>(null);
const loading = ref(false);
const loadError = ref("");
const selectedVariant = ref<string | null>(null);

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

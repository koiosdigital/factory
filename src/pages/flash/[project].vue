<template>
  <UContainer class="py-8 space-y-6">
    <UCard>
      <div class="space-y-2">
        <RouterLink
          to="/"
          class="text-sm text-zinc-400 hover:text-pink-400 flex items-center gap-1"
        >
          <UIcon name="lucide:arrow-left" class="w-4 h-4" />
          Back to devices
        </RouterLink>
        <h1 class="text-2xl font-semibold">{{ project?.name ?? projectSlug }}</h1>
        <p class="text-zinc-400">Select your device variant and firmware version to flash.</p>
      </div>
    </UCard>

    <div v-if="loading" class="space-y-4">
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-24 w-full" />
    </div>

    <UAlert v-else-if="error" color="error" :title="error" />

    <template v-else-if="project">
      <!-- Variant Selection -->
      <UCard>
        <template #header>
          <h2 class="font-medium">Device Variant</h2>
        </template>
        <div class="flex flex-wrap gap-2">
          <UButton
            v-for="variant in project.variants"
            :key="variant.name"
            :color="selectedVariant === variant.name ? 'primary' : 'neutral'"
            :variant="selectedVariant === variant.name ? 'solid' : 'outline'"
            @click="selectVariant(variant.name)"
          >
            {{ variant.name }}
            <UBadge size="xs" color="neutral" variant="subtle" class="ml-2">
              v{{ variant.latest_version }}
            </UBadge>
          </UButton>
        </div>
      </UCard>

      <!-- Version Selection -->
      <UCard v-if="selectedVariant">
        <template #header>
          <h2 class="font-medium">Firmware Version</h2>
        </template>
        <div v-if="loadingVersions" class="py-4">
          <USkeleton class="h-10 w-48" />
        </div>
        <div v-else-if="versions.length" class="space-y-4">
          <USelectMenu
            v-model="selectedVersion"
            :items="versionOptions"
            placeholder="Select a version"
            class="max-w-xs"
          />
          <p v-if="selectedVersion" class="text-sm text-zinc-400">
            Selected: {{ selectedVariant }} v{{ selectedVersion }}
          </p>
        </div>
        <UAlert v-else color="warning" title="No versions available" />
      </UCard>

      <!-- Flash Button -->
      <UCard v-if="selectedVersion && manifestUrl">
        <div class="space-y-4">
          <div class="flex items-center gap-4">
            <esp-web-install-button ref="flashButton" :manifest="manifestUrl" class="esp-button">
              <UButton slot="activate" color="primary" size="lg" icon="lucide:zap">
                Install Firmware
              </UButton>
              <span slot="unsupported">
                <UAlert
                  color="error"
                  title="Browser not supported"
                  description="Please use Chrome or Edge on desktop."
                />
              </span>
              <span slot="not-allowed">
                <UAlert
                  color="warning"
                  title="HTTPS required"
                  description="Firmware installation requires a secure connection."
                />
              </span>
            </esp-web-install-button>
          </div>
          <p class="text-sm text-zinc-400">
            Click to connect your device and install the firmware. After installation, you'll be
            redirected to the console.
          </p>
        </div>
      </UCard>
    </template>
  </UContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useHead } from '@unhead/vue'
import 'esp-web-tools'

import { useFirmwareApi } from '@/lib/api/firmware'
import { getRuntimeConfig } from '@/lib/runtime/config'
import type { components } from '@/types/firmware-api'

type ProjectDetailsResponse = components['schemas']['ProjectDetailsResponse']
type VariantDetailsResponse = components['schemas']['VariantDetailsResponse']

const route = useRoute()
const router = useRouter()
const firmware = useFirmwareApi()
const config = getRuntimeConfig()

const projectSlug = computed(() => route.params.project as string)

const project = ref<ProjectDetailsResponse | null>(null)
const loading = ref(false)
const error = ref('')

const selectedVariant = ref<string | null>(null)
const versions = ref<VariantDetailsResponse['versions']>([])
const loadingVersions = ref(false)
const selectedVersion = ref<string | null>(null)

const flashButton = ref<HTMLElement | null>(null)

useHead({
  title: computed(() => project.value?.name ?? 'Flash Device'),
})

const versionOptions = computed(() =>
  versions.value.map((v) => ({
    label: `v${v.version}`,
    value: v.version,
  }))
)

const manifestUrl = computed(() => {
  if (!selectedVariant.value || !selectedVersion.value) return null
  return `${config.firmwareApiBase}/projects/${projectSlug.value}/${selectedVariant.value}/${selectedVersion.value}`
})

const fetchProject = async () => {
  if (!projectSlug.value) return

  loading.value = true
  error.value = ''

  try {
    const { data, error: apiError } = await firmware.GET('/projects/{project}', {
      params: { path: { project: projectSlug.value } },
    })

    if (apiError || !data) {
      throw new Error('Project not found')
    }

    project.value = data
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load project'
  } finally {
    loading.value = false
  }
}

const selectVariant = async (variantName: string) => {
  selectedVariant.value = variantName
  selectedVersion.value = null
  versions.value = []

  loadingVersions.value = true

  try {
    const { data } = await firmware.GET('/projects/{project}/{variant}', {
      params: {
        path: {
          project: projectSlug.value,
          variant: variantName,
        },
      },
    })

    if (data?.versions) {
      versions.value = data.versions
      // Auto-select latest version
      if (versions.value.length > 0) {
        selectedVersion.value = versions.value[0].version
      }
    }
  } catch {
    // Ignore errors
  } finally {
    loadingVersions.value = false
  }
}

const handleStateChange = (event: CustomEvent) => {
  const state = event.detail?.state
  if (state === 'finished') {
    // Wait a moment for device to reboot, then redirect to console
    setTimeout(() => {
      router.push('/console')
    }, 2000)
  }
}

onMounted(() => {
  fetchProject()
})

// Watch for flash button to add event listener
watch(flashButton, (button) => {
  if (button) {
    button.addEventListener('state-changed', handleStateChange as EventListener)
  }
})

onUnmounted(() => {
  if (flashButton.value) {
    flashButton.value.removeEventListener('state-changed', handleStateChange as EventListener)
  }
})
</script>

<style scoped>
.esp-button {
  --esp-tools-button-color: #ec4899;
  --esp-tools-button-text-color: white;
}
</style>

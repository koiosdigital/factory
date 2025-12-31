<template>
  <UContainer class="py-8 space-y-6">
    <UCard>
      <div class="space-y-2">
        <RouterLink
          to="/"
          class="text-sm text-zinc-600 dark:text-zinc-400 hover:text-pink-400 flex items-center gap-1"
        >
          <UIcon name="lucide:arrow-left" class="w-4 h-4" />
          Back to devices
        </RouterLink>
        <h1 class="text-2xl font-semibold">{{ project?.name ?? projectSlug }}</h1>
        <p class="text-zinc-600 dark:text-zinc-400">
          Select your device variant and firmware version to flash.
        </p>
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
          <p v-if="selectedVersion" class="text-sm text-zinc-600 dark:text-zinc-400">
            Selected: {{ selectedVariant }} v{{ selectedVersion }}
          </p>
        </div>
        <UAlert v-else color="warning" title="No versions available" />
      </UCard>

      <!-- Flash Controls -->
      <UCard v-if="selectedVersion">
        <div class="space-y-6">
          <!-- Browser Not Supported -->
          <UAlert
            v-if="!isSerialSupported"
            color="error"
            icon="lucide:alert-triangle"
            title="Browser Not Supported"
            description="Web Serial API requires Chrome or Edge version 89 or later."
          />

          <!-- Idle State: Select Device Button -->
          <div v-else-if="flashStore.state === 'idle'" class="space-y-4">
            <UButton
              color="primary"
              size="lg"
              icon="lucide:usb"
              :loading="false"
              @click="handleFlash"
            >
              Select Device & Install
            </UButton>
            <p class="text-sm text-zinc-600 dark:text-zinc-400">
              Click to select your ESP32 device and begin installation.
            </p>
          </div>

          <!-- Downloading Progress -->
          <div v-else-if="flashStore.state === 'downloading'" class="space-y-3">
            <div class="flex items-center gap-3">
              <UIcon name="lucide:download" class="w-5 h-5 text-pink-500 animate-pulse" />
              <span class="font-medium">Downloading firmware...</span>
            </div>
            <UProgress :value="flashStore.downloadProgress" color="primary" />
            <p class="text-sm text-zinc-600 dark:text-zinc-400">
              File {{ flashStore.currentFileIndex + 1 }} of {{ flashStore.totalFiles }} -
              {{ flashStore.downloadProgress }}%
            </p>
          </div>

          <!-- Flashing Progress -->
          <div v-else-if="flashStore.state === 'flashing'" class="space-y-3">
            <div class="flex items-center gap-3">
              <UIcon name="lucide:zap" class="w-5 h-5 text-pink-500 animate-pulse" />
              <span class="font-medium">Flashing firmware...</span>
            </div>
            <UProgress :value="flashStore.flashProgress" color="primary" />
            <p class="text-sm text-zinc-600 dark:text-zinc-400">
              File {{ flashStore.currentFileIndex + 1 }} of {{ flashStore.totalFiles }} -
              {{ flashStore.flashProgress }}%
            </p>
          </div>

          <!-- Complete State -->
          <div v-else-if="flashStore.state === 'complete'" class="space-y-3">
            <UAlert
              color="success"
              icon="lucide:check-circle"
              title="Installation Complete"
              description="Firmware has been installed."
            />
          </div>

          <!-- Error State -->
          <div v-else-if="flashStore.state === 'error'" class="space-y-4">
            <UAlert
              color="error"
              icon="lucide:alert-circle"
              title="Installation Failed"
              :description="flashStore.errorMessage ?? 'An unknown error occurred'"
            />
            <UButton color="neutral" variant="outline" @click="flashStore.reset()">
              Try Again
            </UButton>
          </div>
        </div>
      </UCard>
    </template>
  </UContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useHead } from '@unhead/vue'

import { useFirmwareApi } from '@/lib/api/firmware'
import { isSerialSupported as checkSerialSupport } from '@/lib/serial/ports'
import { useFlashStore } from '@/stores/flash'
import type { components } from '@/types/firmware-api'

type ProjectDetailsResponse = components['schemas']['ProjectDetailsResponse']
type VariantDetailsResponse = components['schemas']['VariantDetailsResponse']

const route = useRoute()
const router = useRouter()
const firmware = useFirmwareApi()
const flashStore = useFlashStore()

const projectSlug = computed(() => route.params.project as string)

const project = ref<ProjectDetailsResponse | null>(null)
const loading = ref(false)
const error = ref('')

const selectedVariant = ref<string | null>(null)
const versions = ref<VariantDetailsResponse['versions']>([])
const loadingVersions = ref(false)
const selectedVersion = ref<string | null>(null)

const isSerialSupported = checkSerialSupport()

useHead({
  title: computed(() => project.value?.name ?? 'Flash Device'),
})

const versionOptions = computed(() =>
  versions.value.map((v) => ({
    label: `v${v.version}`,
    value: v.version,
  }))
)

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

const handleFlash = async () => {
  if (!selectedVariant.value || !selectedVersion.value) return

  const success = await flashStore.startFlash(
    projectSlug.value,
    selectedVariant.value,
    selectedVersion.value
  )

  if (success) {
    router.push('/console')
  }
}

onMounted(() => {
  fetchProject()
  // Reset flash store state when entering the page
  flashStore.reset()
})

onUnmounted(() => {
  // Clean up flash store if navigating away
  flashStore.disconnect()
})
</script>

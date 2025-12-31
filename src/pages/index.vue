<template>
  <UContainer class="py-8">
    <div class="text-center mb-8">
      <h1 class="text-3xl font-bold mb-2">Koios Digital Firmware</h1>
      <p class="text-zinc-600 dark:text-zinc-400">
        Select your device to install or update firmware
      </p>
    </div>

    <div v-if="errorMessage" class="mb-6">
      <UAlert color="error" title="Unable to load devices" :description="errorMessage" />
    </div>

    <div v-if="loading" class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <USkeleton v-for="i in 3" :key="i" class="h-32" />
    </div>

    <div v-else-if="projects.length" class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <RouterLink
        v-for="project in projects"
        :key="project.slug"
        :to="`/flash/${project.slug}`"
        class="group"
      >
        <UCard
          class="h-full transition-all hover:border-pink-500/50 hover:shadow-lg hover:shadow-pink-500/10"
        >
          <div class="flex items-start justify-between">
            <div>
              <h3 class="font-semibold text-lg group-hover:text-pink-400 transition-colors">
                {{ project.name }}
              </h3>
              <p class="text-sm text-zinc-500 mt-1">{{ project.slug }}</p>
            </div>
            <div class="p-2 rounded-lg bg-pink-500/10 text-pink-400">
              <UIcon name="lucide:cpu" class="w-5 h-5" />
            </div>
          </div>
          <div class="mt-4 flex items-center text-sm text-zinc-600 dark:text-zinc-400">
            <UIcon
              name="lucide:arrow-right"
              class="w-4 h-4 mr-1 group-hover:translate-x-1 transition-transform"
            />
            Flash firmware
          </div>
        </UCard>
      </RouterLink>
    </div>

    <UCard v-else class="text-center py-12">
      <UIcon
        name="lucide:package-x"
        class="w-12 h-12 mx-auto text-zinc-400 dark:text-zinc-600 mb-4"
      />
      <h3 class="font-medium text-lg mb-2">No devices available</h3>
      <p class="text-zinc-600 dark:text-zinc-400">Check back later for available firmware.</p>
    </UCard>
  </UContainer>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useHead } from '@unhead/vue'

import { useFirmwareApi } from '@/lib/api/firmware'
import type { components } from '@/types/firmware-api'

useHead({ title: 'Devices' })

type Project = components['schemas']['Project']

const firmware = useFirmwareApi()

const projects = ref<Project[]>([])
const loading = ref(false)
const errorMessage = ref('')

const fetchProjects = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const { data, error } = await firmware.GET('/projects')
    if (error) throw error
    projects.value = data ?? []
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unknown error'
  } finally {
    loading.value = false
  }
}

onMounted(fetchProjects)
</script>

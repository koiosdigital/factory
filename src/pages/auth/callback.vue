<template>
  <UContainer class="py-16">
    <UPageCard variant="subtle" class="max-w-xl mx-auto text-center">
      <template #header>
        <UPageHeader title="Signing you in" description="Completing secure authentication." />
      </template>

      <div class="space-y-4">
        <USkeleton v-if="status === 'processing'" class="h-6" repeat="3" />
        <div v-else-if="status === 'error'" class="space-y-2">
          <UAlert color="error" title="Authentication failed" :description="errorMessage" />
          <UButton color="primary" @click="retry">Try again</UButton>
        </div>
        <div v-else class="space-y-2">
          <UAlert color="success" title="Signed in" description="Redirecting to your workspace." />
        </div>
      </div>
    </UPageCard>
  </UContainer>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const status = ref<'processing' | 'error' | 'success'>('processing')
const errorMessage = ref('')

const complete = async () => {
  try {
    const nextPath = await auth.finishLogin(route.fullPath)
    status.value = 'success'
    await router.replace(nextPath || '/')
  } catch (error) {
    status.value = 'error'
    errorMessage.value = error instanceof Error ? error.message : 'Unknown error'
  }
}

const retry = () => {
  auth.login()
}

onMounted(() => {
  complete()
})
</script>

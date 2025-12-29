<template>
  <UCard :ui="{ base: 'h-full', body: 'p-4' }">
    <div class="flex items-start gap-3">
      <UBadge :color="color" variant="soft" class="rounded-full p-2">
        <Icon :name="icon" class="h-4 w-4" />
      </UBadge>
      <div class="space-y-1">
        <p class="text-xs uppercase tracking-wide text-white/60">{{ label }}</p>
        <p class="text-lg font-semibold text-white">{{ value }}</p>
        <p v-if="description" class="text-sm text-white/60">
          {{ description }}
        </p>
      </div>
    </div>
  </UCard>
</template>

<script setup lang="ts">
import { toRefs } from 'vue'

const props = withDefaults(
  defineProps<{
    label: string
    value: string
    description?: string
    color?: 'primary' | 'success' | 'warning' | 'error' | 'neutral' | 'info'
    icon?: string
  }>(),
  {
    color: 'neutral',
    icon: 'lucide:info',
  }
)

const { label, value, description, color, icon } = toRefs(props)
</script>

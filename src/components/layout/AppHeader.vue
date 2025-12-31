<template>
  <UHeader
    class="sticky top-0 z-40 border-b border-zinc-200 dark:border-zinc-800 backdrop-blur-lg bg-white/80 dark:bg-zinc-950/80"
    :ui="{ wrapper: 'max-w-6xl mx-auto px-4 py-3' }"
  >
    <template #title>
      <RouterLink to="/" class="flex items-center gap-3">
        <img src="@/assets/img/logo_light.png" alt="Koios" class="h-6 sm:h-7 dark:hidden" />
        <img src="@/assets/img/logo_dark.png" alt="Koios" class="h-6 sm:h-7 hidden dark:block" />
      </RouterLink>
    </template>

    <!-- Desktop nav -->
    <UNavigationMenu :items="navigationItems" class="hidden md:flex" />

    <template #right>
      <div v-if="loading" class="hidden sm:flex items-center gap-2">
        <USkeleton class="h-6 w-24" />
      </div>
      <div v-else-if="isAuthenticated" class="flex items-center gap-2">
        <UBadge color="primary" variant="subtle" class="hidden sm:inline-flex">
          {{ userName ?? 'Signed in' }}
        </UBadge>
        <UTooltip text="Sign out">
          <UButton
            icon="lucide:log-out"
            variant="ghost"
            color="neutral"
            size="sm"
            @click="$emit('logout')"
          />
        </UTooltip>
      </div>
      <div v-else>
        <UButton
          color="primary"
          variant="soft"
          icon="lucide:log-in"
          size="sm"
          @click="$emit('login')"
        >
          Factory Login
        </UButton>
      </div>
    </template>

    <!-- Mobile nav (in body slot with vertical orientation) -->
    <template #body>
      <UNavigationMenu orientation="vertical" :items="navigationItems" />
    </template>
  </UHeader>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface NavItem {
  label: string
  to: string
  active?: boolean
}

const props = defineProps<{
  navItems: NavItem[]
  isAuthenticated: boolean
  loading?: boolean
  userName?: string | null
}>()

defineEmits<{ (e: 'login'): void; (e: 'logout'): void }>()

// Convert navItems to UNavigationMenu format
const navigationItems = computed(() =>
  props.navItems.map((item) => ({
    label: item.label,
    to: item.to,
    active: item.active,
  }))
)
</script>

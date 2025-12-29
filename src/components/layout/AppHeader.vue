<template>
  <UHeader
    class="sticky top-0 z-40 border-b border-zinc-800 backdrop-blur-lg bg-zinc-950/80"
    :ui="{ wrapper: 'max-w-6xl mx-auto px-4 py-3' }"
  >
    <template #title>
      <RouterLink to="/" class="flex items-center gap-3">
        <img src="@/assets/img/type_dark.png" alt="Koios" class="h-6 sm:h-7" />
      </RouterLink>
    </template>

    <template #default>
      <div class="flex items-center gap-4 w-full">
        <nav class="hidden md:flex flex-1 gap-1">
          <RouterLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            :class="
              item.active
                ? 'bg-pink-500/10 text-pink-400'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
            "
          >
            {{ item.label }}
          </RouterLink>
        </nav>
        <div class="ms-auto flex items-center gap-3">
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
        </div>
      </div>
    </template>
  </UHeader>
</template>

<script setup lang="ts">
interface NavItem {
  label: string
  to: string
  active?: boolean
}

defineProps<{
  navItems: NavItem[]
  isAuthenticated: boolean
  loading?: boolean
  userName?: string | null
}>()

defineEmits<{ (e: 'login'): void; (e: 'logout'): void }>()
</script>

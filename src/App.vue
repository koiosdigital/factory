<template>
  <UApp>
    <AppHeader
      :nav-items="navItems"
      :is-authenticated="auth.isAuthenticated"
      :loading="auth.initializing"
      :user-name="userDisplayName"
      @login="handleLogin"
      @logout="handleLogout"
    />

    <UMain class="bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 min-h-screen">
      <RouterView />
    </UMain>

    <UFooter class="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
      <div class="max-w-6xl mx-auto px-4 py-6 text-sm text-zinc-500">
        Koios Digital · {{ new Date().getFullYear() }}
      </div>
    </UFooter>
  </UApp>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { useHead } from '@unhead/vue'

import AppHeader from '@/components/layout/AppHeader.vue'
import { useAuthStore } from '@/stores/auth'

useHead({
  titleTemplate: (title?: string) =>
    title ? `${title} | Koios Digital Firmware` : 'Koios Digital Firmware',
})

const route = useRoute()
const auth = useAuthStore()

const navItems = computed(() => [
  {
    label: 'Devices',
    to: '/',
    active: route.path === '/',
  },
  {
    label: 'Console',
    to: '/console',
    active: route.path === '/console',
  },
])

const userDisplayName = computed(() => auth.user?.preferred_username ?? auth.user?.name ?? null)

const handleLogin = () => auth.login()
const handleLogout = () => auth.logout()
</script>

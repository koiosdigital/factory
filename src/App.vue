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

    <UMain class="bg-slate-950 text-white min-h-screen">
      <RouterView />
    </UMain>

    <UFooter class="border-t border-white/10 bg-slate-950 text-white/60">
      <div class="max-w-6xl mx-auto px-4 py-6 text-sm">
        Built for the Koios factory floor · {{ new Date().getFullYear() }}
      </div>
    </UFooter>
  </UApp>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { RouterView, useRoute } from "vue-router";

import AppHeader from "@/components/layout/AppHeader.vue";
import { useAuthStore } from "@/stores/auth";

const route = useRoute();
const auth = useAuthStore();

const navItems = computed(() => [
  {
    label: "Home",
    to: "/",
    active: route.path === "/",
  },
  {
    label: "Crypto",
    to: "/crypto",
    active: route.path.startsWith("/crypto"),
  },
]);

const userDisplayName = computed(
  () => auth.user?.preferred_username ?? auth.user?.name ?? null
);

const handleLogin = () => auth.login();
const handleLogout = () => auth.logout();
</script>

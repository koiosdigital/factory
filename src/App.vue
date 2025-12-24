<template>
  <UApp>
    <UHeader title="Koios Factory">
      <div class="flex items-center gap-4 w-full">
        <UNavigationMenu :items="navItems" class="flex-1" />
        <UButton
          v-if="auth.isAuthenticated"
          color="neutral"
          variant="outline"
          @click="auth.logout"
        >
          Logout
        </UButton>
        <UButton v-else color="primary" @click="auth.login"> Login </UButton>
      </div>
    </UHeader>

    <UMain>
      <RouterView />
    </UMain>

    <UFooter />
  </UApp>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { RouterView, useRoute } from "vue-router";

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
</script>

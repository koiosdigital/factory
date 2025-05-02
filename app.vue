<template>
  <UApp>
    <UHeader title="Koios Factory">
      <UNavigationMenu :items="items" />
    </UHeader>

    <UMain>
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </UMain>

    <UFooter />
  </UApp>
</template>

<script setup lang="ts">
const route = useRoute();

const items = computed(() => [
  {
    label: "Home",
    to: "/",
    active: route.path === "/",
  },
  {
    label: "Crypto",
    to: "/crypto",
    active: route.path === "/crypto",
  },
  {
    label: "Logout",
    to: "/auth/keycloak/logout",
  },
]);
</script>

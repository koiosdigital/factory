<template>
  <div class="hidden" aria-hidden="true">
    Completing silent authentication...
  </div>
</template>

<script setup lang="ts">
import { onMounted } from "vue";

import { getOidcUserManager } from "@/lib/auth/oidcClient";

onMounted(async () => {
  const manager = getOidcUserManager();
  if (!manager) return;

  try {
    await manager.signinSilentCallback(window.location.href);
  } catch (error) {
    console.error("Silent renew failed", error);
  }
});
</script>

<template>
  <UContainer class="py-16">
    <UPageCard variant="subtle" class="max-w-xl mx-auto text-center">
      <template #header>
        <UPageHeader
          title="Signing out"
          description="Ending your secure session."
        />
      </template>

      <div class="space-y-4">
        <UAlert
          color="info"
          title="Redirecting"
          description="You will be redirected to the identity provider to finish logging out."
        />
      </div>
    </UPageCard>
  </UContainer>
</template>

<script setup lang="ts">
import { onMounted } from "vue";

import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();

onMounted(() => {
  void auth.logout();
});
</script>

<template>
  <UContainer>
    <UPageHeader title="Select a device to program" />
    <div class="mb-5" />
    <UPageGrid v-if="projects" :cols="3">
      <UPageCard
        v-for="project in projects"
        :key="project.slug"
        :title="project.name"
        :to="`/program/${project.slug}`"
      />
    </UPageGrid>
    <UProgress v-else />
  </UContainer>
  <UButton @click="copyAccessToken" class="mt-5"> Copy Access Token </UButton>
</template>

<script setup lang="ts">
import type { Project } from "~/types/koios_apis";

const { data: projects } = useFetch<Project[]>(
  "https://firmware.api.koiosdigital.net/projects"
);

const { user } = useOidcAuth();

const copyAccessToken = async () => {
  const accessToken = user.value?.accessToken;
  if (accessToken) {
    await navigator.clipboard.writeText(accessToken);
  } else {
    alert("No access token available");
  }
};
</script>

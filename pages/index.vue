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
</template>

<script setup lang="ts">
import type { Project } from "~/types/koios_apis";

const { data: projects } = useFetch<Project[]>(
  "https://firmware.api.koiosdigital.net/projects"
);
</script>

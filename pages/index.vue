<template>
  <UContainer>
    <UPageHeader title="Select a device to program" />
    <div class="mb-5" />
    <UPageGrid v-if="projects">
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
import type { components } from "~/types/firmware-api";
import { useFirmwareApi } from "~/lib/api/firmware";

type Project = components["schemas"]["Project"];

const firmware = useFirmwareApi();

const { data: projects } = useAsyncData<Project[]>("projects", async () => {
  const { data, error } = await firmware.GET("/projects");
  if (error) throw error;
  return data;
});
</script>

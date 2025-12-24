<template>
  <UContainer>
    <UPageHeader title="Select a device to program" />
    <div class="mb-5" />
    <div v-if="errorMessage" class="mb-5">
      <UAlert
        color="error"
        title="Unable to load projects"
        :description="errorMessage"
      />
    </div>
    <UPageGrid v-if="projects.length">
      <UPageCard
        v-for="project in projects"
        :key="project.slug"
        :title="project.name"
        :to="`/program/${project.slug}`"
      />
    </UPageGrid>
    <div v-else-if="loading">
      <UProgress />
    </div>
    <UAlert v-else color="warning" title="No projects found" />
  </UContainer>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";

import { useFirmwareApi } from "@/lib/api/firmware";
import type { components } from "@/types/firmware-api";

type Project = components["schemas"]["Project"];

const firmware = useFirmwareApi();

const projects = ref<Project[]>([]);
const loading = ref(false);
const errorMessage = ref("");

const fetchProjects = async () => {
  loading.value = true;
  errorMessage.value = "";

  try {
    const { data, error } = await firmware.GET("/projects");
    if (error) throw error;
    projects.value = data ?? [];
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Unknown error";
  } finally {
    loading.value = false;
  }
};

onMounted(fetchProjects);
</script>

<template>
  <UHeader
    class="sticky top-0 z-40 border-b border-white/10 backdrop-blur"
    :ui="{ wrapper: 'max-w-6xl mx-auto px-4 py-3' }"
  >
    <template #title>
      <RouterLink
        to="/"
        class="flex items-center gap-3 text-base sm:text-xl font-semibold tracking-tight"
      >
        <Icon name="ph:factory" class="text-primary-400 text-2xl sm:text-3xl" />
        <span class="text-lg sm:text-2xl">Koios Factory</span>
      </RouterLink>
    </template>

    <template #default>
      <div class="flex items-center gap-4 w-full">
        <UNavigationMenu :items="navItems" class="hidden md:flex flex-1" />
        <div class="ms-auto flex items-center gap-3">
          <div v-if="loading" class="hidden sm:flex items-center gap-2">
            <USkeleton class="h-6 w-24" />
            <USkeleton class="h-6 w-6 rounded-full" />
          </div>
          <div v-else-if="isAuthenticated" class="flex items-center gap-2">
            <UBadge
              color="primary"
              variant="subtle"
              class="hidden sm:inline-flex"
            >
              {{ userName ?? "Signed in" }}
            </UBadge>
            <UTooltip text="Sign out">
              <UButton
                icon="lucide:log-out"
                variant="ghost"
                color="neutral"
                @click="$emit('logout')"
              />
            </UTooltip>
          </div>
          <div v-else>
            <UButton
              color="primary"
              icon="lucide:log-in"
              @click="$emit('login')"
            >
              Sign in
            </UButton>
          </div>
        </div>
      </div>
    </template>
  </UHeader>
</template>

<script setup lang="ts">
interface NavItem {
  label: string;
  to: string;
  active?: boolean;
  icon?: string;
}

defineProps<{
  navItems: NavItem[];
  isAuthenticated: boolean;
  loading?: boolean;
  userName?: string | null;
}>();

defineEmits<{ (e: "login"): void; (e: "logout"): void }>();
</script>

<template>{{ user }}</template>

<script setup lang="ts">
const { loggedIn, user, login, logout } = useOidcAuth();
</script>

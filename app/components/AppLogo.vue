<script setup lang="ts">
const colorMode = useColorMode()

const isDark = computed(() =>  colorMode.value === 'dark')
</script>

<template>
  <UIcon :name="isDark ? 'i-nimiq:logos-nimiq-white-horizontal' : 'i-nimiq:logos-nimiq-horizontal'" class="h-4 !w-[100px]" />
</template>

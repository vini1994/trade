<template>
  <div class="loading-spinner" v-if="loading">
    <div class="spinner-border text-primary" role="status">
      <span class="visually-hidden">Carregando...</span>
    </div>
    <p class="mt-2 text-muted">{{ message }}</p>
  </div>
</template>

<script setup lang="ts">
interface Props {
  loading: boolean
  message?: string
}

withDefaults(defineProps<Props>(), {
  message: 'Carregando dados...'
})
</script>

<style scoped>
.loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}
</style> 
<template>
  <div class="card" :class="cardClass">
    <div class="card-body">
      <div class="d-flex justify-content-between">
        <div>
          <h6 class="card-title">{{ title }}</h6>
          <h3 class="mb-0">{{ value }}</h3>
        </div>
        <div class="align-self-center">
          <i :class="iconClass" class="fs-1"></i>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  title: string
  value: string | number
  variant?: 'primary' | 'success' | 'danger' | 'warning' | 'info'
  icon?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  icon: 'bi bi-graph-up'
})

const cardClass = computed(() => {
  const baseClass = 'text-white'
  const variantClass = `bg-${props.variant}`
  return [baseClass, variantClass]
})

const iconClass = computed(() => props.icon)
</script>

<style scoped>
.card {
  transition: transform 0.2s ease-in-out;
}

.card:hover {
  transform: translateY(-2px);
}
</style> 
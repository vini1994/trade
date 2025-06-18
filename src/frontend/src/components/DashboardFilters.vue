<template>
  <div class="card">
    <div class="card-body">
      <div class="row">
        <div class="col-md-3">
          <label for="symbolFilter" class="form-label">Símbolo</label>
          <select v-model="filters.symbol" @change="emitFilters" class="form-select" id="symbolFilter">
            <option value="ALL">Todos os Símbolos</option>
            <option v-for="symbol in availableSymbols" :key="symbol" :value="symbol">
              {{ symbol }}
            </option>
          </select>
        </div>
        <div class="col-md-3">
          <label for="startDate" class="form-label">Data Início</label>
          <input 
            type="date" 
            v-model="filters.startDate" 
            @change="emitFilters" 
            class="form-control" 
            id="startDate"
          >
        </div>
        <div class="col-md-3">
          <label for="endDate" class="form-label">Data Fim</label>
          <input 
            type="date" 
            v-model="filters.endDate" 
            @change="emitFilters" 
            class="form-control" 
            id="endDate"
          >
        </div>
        <div class="col-md-3">
          <label class="form-label">&nbsp;</label>
          <div>
            <button @click="emitFilters" class="btn btn-primary me-2">
              <i class="bi bi-arrow-clockwise"></i> Atualizar
            </button>
            <button @click="resetFilters" class="btn btn-outline-secondary">
              Limpar Filtros
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

interface Filters {
  symbol: string
  startDate: string
  endDate: string
}

interface Props {
  availableSymbols: string[]
  initialFilters?: Partial<Filters>
}

const props = withDefaults(defineProps<Props>(), {
  initialFilters: () => ({
    symbol: 'ALL',
    startDate: '',
    endDate: ''
  })
})

const emit = defineEmits<{
  filtersChanged: [filters: Filters]
}>()

const filters = ref<Filters>({
  symbol: props.initialFilters.symbol || 'ALL',
  startDate: props.initialFilters.startDate || '',
  endDate: props.initialFilters.endDate || ''
})

const emitFilters = () => {
  emit('filtersChanged', { ...filters.value })
}

const resetFilters = () => {
  filters.value = {
    symbol: 'ALL',
    startDate: '',
    endDate: ''
  }
  emitFilters()
}

// Emit initial filters
watch(() => props.initialFilters, (newFilters) => {
  if (newFilters) {
    filters.value = {
      symbol: newFilters.symbol || 'ALL',
      startDate: newFilters.startDate || '',
      endDate: newFilters.endDate || ''
    }
  }
}, { immediate: true })
</script>

<style scoped>
.card {
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
  border: 1px solid rgba(0, 0, 0, 0.125);
}
</style> 
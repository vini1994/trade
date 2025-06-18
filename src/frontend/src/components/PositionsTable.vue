<template>
  <div class="card">
    <div class="card-header d-flex justify-content-between align-items-center">
      <h5 class="card-title mb-0">Histórico de Posições</h5>
      <div class="d-flex gap-2">
        <select v-model="pageSize" @change="emitPagination" class="form-select form-select-sm" style="width: auto;">
          <option value="10">10</option>
          <option value="25">25</option>
          <option value="50">50</option>
          <option value="100">100</option>
        </select>
      </div>
    </div>
    <div class="card-body">
      <div class="table-responsive">
        <table class="table table-striped table-hover">
          <thead>
            <tr>
              <th>Símbolo</th>
              <th>Tipo</th>
              <th>Quantidade</th>
              <th>Preço Médio</th>
              <th>Preço Fechamento</th>
              <th>Alavancagem</th>
              <th>Resultado</th>
              <th>Data Abertura</th>
              <th>Data Fechamento</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="position in positions" :key="position.positionId">
              <td>
                <span class="badge bg-primary">{{ position.symbol }}</span>
              </td>
              <td>
                <span 
                  class="badge" 
                  :class="position.positionSide === 'LONG' ? 'bg-success' : 'bg-danger'"
                >
                  {{ position.positionSide }}
                </span>
              </td>
              <td>{{ position.closePositionAmt }}</td>
              <td>${{ formatNumber(parseFloat(position.avgPrice)) }}</td>
              <td>${{ formatNumber(position.avgClosePrice) }}</td>
              <td>{{ position.leverage }}x</td>
              <td>
                <span 
                  class="fw-bold" 
                  :class="parseFloat(position.netProfit) >= 0 ? 'text-success' : 'text-danger'"
                >
                  ${{ formatNumber(parseFloat(position.netProfit)) }}
                </span>
              </td>
              <td>{{ formatDate(position.openTime) }}</td>
              <td>{{ formatDate(getEffectiveCloseTime(position)) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <!-- Paginação -->
      <nav v-if="pagination.total > 0">
        <ul class="pagination justify-content-center">
          <li class="page-item" :class="{ disabled: pagination.pageIndex <= 1 }">
            <a class="page-link" href="#" @click.prevent="changePage(pagination.pageIndex - 1)">
              Anterior
            </a>
          </li>
          <li class="page-item">
            <span class="page-link">
              Página {{ pagination.pageIndex }} de {{ Math.ceil(pagination.total / pagination.pageSize) }}
            </span>
          </li>
          <li class="page-item" :class="{ disabled: pagination.pageIndex >= Math.ceil(pagination.total / pagination.pageSize) }">
            <a class="page-link" href="#" @click.prevent="changePage(pagination.pageIndex + 1)">
              Próxima
            </a>
          </li>
        </ul>
      </nav>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { PositionHistory } from '../types/positionHistory'

interface Pagination {
  pageIndex: number
  pageSize: number
  total: number
}

interface Props {
  positions: PositionHistory[]
  pagination: Pagination
}

const props = defineProps<Props>()

const emit = defineEmits<{
  paginationChanged: [pagination: Pagination]
}>()

const pageSize = ref(props.pagination.pageSize)

const emitPagination = () => {
  emit('paginationChanged', {
    pageIndex: 1,
    pageSize: pageSize.value,
    total: props.pagination.total
  })
}

const changePage = (page: number) => {
  if (page >= 1 && page <= Math.ceil(props.pagination.total / props.pagination.pageSize)) {
    emit('paginationChanged', {
      pageIndex: page,
      pageSize: props.pagination.pageSize,
      total: props.pagination.total
    })
  }
}

const formatNumber = (value: number): string => {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

const formatDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString('pt-BR')
}

/**
 * Helper function to get the effective close time, using updateTime as fallback
 */
const getEffectiveCloseTime = (position: PositionHistory): number => {
  return position.closeTime || position.updateTime
}
</script>

<style scoped>
.card {
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
  border: 1px solid rgba(0, 0, 0, 0.125);
}

.table th {
  font-weight: 600;
  background-color: #f8f9fa;
}

.badge {
  font-size: 0.75em;
}

.pagination .page-link {
  color: #007bff;
}

.pagination .page-item.disabled .page-link {
  color: #6c757d;
}
</style> 
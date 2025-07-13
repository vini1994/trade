<template>
  <div class="card border-0 shadow h-100">
    <div class="card-header bg-info text-white">
      <h5 class="card-title mb-0 fw-semibold">
        <i class="bi bi-table me-2"></i>
        {{ title }}
      </h5>
    </div>
    <div class="card-body p-0">
      <div class="table-responsive">
        <table class="table table-hover mb-0">
          <thead class="table-dark">
            <tr>
              <th>{{ columnTitle }}</th>
              <th class="text-end">Trades</th>
              <th class="text-end">Profit</th>
              <th class="text-end">Loss</th>
              <th class="text-end">Avg Risk</th>
              <th class="text-end">Avg R:R</th>
              <th class="text-end">Avg Leverage</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(analysis, key) in data" :key="key">
              <td>
                <span class="badge bg-secondary">{{ key }}</span>
              </td>
              <td class="text-end">{{ analysis.totalTrades }}</td>
              <td class="text-end text-success">${{ formatNumber(analysis.totalProfit) }}</td>
              <td class="text-end text-danger">${{ formatNumber(analysis.totalLoss) }}</td>
              <td class="text-end text-warning">{{ formatNumber(analysis.avgRisk) }}</td>
              <td class="text-end text-info">{{ formatNumber(analysis.avgRR) }}</td>
              <td class="text-end text-primary">{{ formatNumber(analysis.avgLeverage) }}x</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface AnalysisData {
  totalTrades: number
  totalProfit: number
  totalLoss: number
  avgRisk: number
  avgRR: number
  avgLeverage: number
}

interface Props {
  title: string
  columnTitle: string
  data: { [key: string]: AnalysisData }
}

const props = defineProps<Props>()

const formatNumber = (value: number | undefined | null): string => {
  if (value === undefined || value === null || isNaN(value)) {
    return '0.00'
  }
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}
</script>

<style scoped>
.card {
  backdrop-filter: blur(10px);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
}

.card-header {
  backdrop-filter: blur(10px);
  background: linear-gradient(135deg, #0dcaf0 0%, #0aa2c0 100%) !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.table {
  color: inherit;
}

.table-dark {
  background: rgba(0, 0, 0, 0.3);
}

.table-hover tbody tr:hover {
  background: rgba(255, 255, 255, 0.05);
}

.badge {
  font-weight: 600;
  letter-spacing: 0.5px;
}
</style> 
<template>
  <div class="card border-0 shadow h-100">
    <div class="card-header bg-success text-white">
      <h5 class="card-title mb-0 fw-semibold">
        <i class="bi bi-graph-up-arrow me-2"></i>
        Performance Metrics
      </h5>
    </div>
    <div class="card-body">
      <div class="row g-3">
        <!-- Performance Ratios -->
        <div class="col-6">
          <div class="text-center">
            <div class="h4 text-success fw-bold">{{ formatNumber(stats.sharpeRatio) }}</div>
            <div class="text-muted small">Sharpe Ratio</div>
          </div>
        </div>
        <div class="col-6">
          <div class="text-center">
            <div class="h4 text-info fw-bold">{{ formatNumber(stats.sortinoRatio) }}</div>
            <div class="text-muted small">Sortino Ratio</div>
          </div>
        </div>
        <div class="col-6">
          <div class="text-center">
            <div class="h4 text-warning fw-bold">{{ formatNumber(stats.calmarRatio) }}</div>
            <div class="text-muted small">Calmar Ratio</div>
          </div>
        </div>
        <div class="col-6">
          <div class="text-center">
            <div class="h4 text-primary fw-bold">{{ formatNumber(stats.recoveryFactor) }}</div>
            <div class="text-muted small">Recovery Factor</div>
          </div>
        </div>
      </div>
      
      <!-- Drawdown Info -->
      <div class="row mt-3">
        <div class="col-12">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="text-muted small">Max Drawdown</span>
            <span class="badge bg-danger">${{ formatNumber(stats.maxDrawdown) }}</span>
          </div>
          <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="text-muted small">Avg Drawdown</span>
            <span class="badge bg-warning text-dark">${{ formatNumber(stats.avgDrawdown) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  stats: {
    sharpeRatio: number
    sortinoRatio: number
    calmarRatio: number
    recoveryFactor: number
    maxDrawdown: number
    avgDrawdown: number
  }
}

const props = defineProps<Props>()

const formatNumber = (value: number): string => {
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
  background: linear-gradient(135deg, #198754 0%, #146c43 100%) !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.badge {
  font-weight: 600;
  letter-spacing: 0.5px;
}
</style> 
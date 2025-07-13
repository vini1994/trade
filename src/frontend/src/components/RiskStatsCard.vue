<template>
  <div class="card border-0 shadow h-100">
    <div class="card-header bg-danger text-white">
      <h5 class="card-title mb-0 fw-semibold">
        <i class="bi bi-shield-exclamation me-2"></i>
        Risk-Reward Analysis
      </h5>
    </div>
    <div class="card-body">
      <div class="row g-3">
        <!-- Risk Metrics -->
        <div class="col-6">
          <div class="text-center">
            <div class="h4 text-warning fw-bold">{{ formatNumber(stats.avgRiskPerTrade) }}</div>
            <div class="text-muted small">Avg Risk/Trade</div>
          </div>
        </div>
        <div class="col-6">
          <div class="text-center">
            <div class="h4 text-info fw-bold">{{ formatNumber(stats.avgRiskRewardRatio) }}</div>
            <div class="text-muted small">Avg R:R Ratio</div>
          </div>
        </div>
        <div class="col-6">
          <div class="text-center">
            <div class="h4 text-success fw-bold">{{ formatNumber(stats.sharpeRatio) }}</div>
            <div class="text-muted small">Sharpe Ratio</div>
          </div>
        </div>
        <div class="col-6">
          <div class="text-center">
            <div class="h4 text-danger fw-bold">{{ formatNumber(stats.maxDrawdown) }}</div>
            <div class="text-muted small">Max Drawdown</div>
          </div>
        </div>
      </div>
      
      <!-- Additional Metrics -->
      <div class="row mt-3">
        <div class="col-12">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="text-muted small">Positive R:R Trades</span>
            <span class="badge bg-success">{{ stats.tradesWithPositiveRR }}</span>
          </div>
          <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="text-muted small">Avg R:R Positive Trades</span>
            <span class="badge bg-info">{{ formatNumber(stats.avgRiskReturnedPositive) }}</span>
          </div>
          <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="text-muted small">Negative R:R Trades</span>
            <span class="badge bg-danger">{{ stats.tradesWithNegativeRR }}</span>
          </div>
          <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="text-muted small">Best R:R Ratio</span>
            <span class="badge bg-primary">{{ formatNumber(stats.bestRiskRewardRatio) }}</span>
          </div>
          <div class="d-flex justify-content-between align-items-center">
            <span class="text-muted small">Worst R:R Ratio</span>
            <span class="badge bg-warning text-dark">{{ formatNumber(stats.worstRiskRewardRatio) }}</span>
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
    avgRiskPerTrade: number
    avgRiskRewardRatio: number
    sharpeRatio: number
    maxDrawdown: number
    tradesWithPositiveRR: number
    tradesWithNegativeRR: number
    bestRiskRewardRatio: number
    worstRiskRewardRatio: number
    avgRiskReturnedPositive: number
  }
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
  background: linear-gradient(135deg, #dc3545 0%, #c82333 100%) !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.badge {
  font-weight: 600;
  letter-spacing: 0.5px;
}
</style> 
<template>
  <div class="card border-0 shadow h-100">
    <div class="card-header bg-purple text-white">
      <h5 class="card-title mb-0 fw-semibold">
        <i class="bi bi-tags me-2"></i>
        Setup Analysis
      </h5>
    </div>
    <div class="card-body p-0">
      <div class="table-responsive">
        <table class="table table-hover mb-0">
          <thead class="table-dark">
            <tr>
              <th>Setup</th>
              <th class="text-end">Trades</th>
              <th class="text-end">Win Rate</th>
              <th class="text-end">Profit</th>
              <th class="text-end">Avg R:R</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(analysis, setup) in setupAnalysis" :key="setup">
              <td>
                <span class="badge bg-purple">{{ setup }}</span>
              </td>
              <td class="text-end">{{ analysis.totalTrades }}</td>
              <td class="text-end">
                <span :class="analysis.winRate >= 50 ? 'text-success' : 'text-danger'">
                  {{ analysis.winRate }}%
                </span>
              </td>
              <td class="text-end" :class="analysis.totalProfit >= 0 ? 'text-success' : 'text-danger'">
                ${{ formatNumber(analysis.totalProfit) }}
              </td>
              <td class="text-end text-info">{{ formatNumber(analysis.avgRR) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface SetupAnalysis {
  totalTrades: number
  winRate: number
  totalProfit: number
  avgRR: number
}

interface Props {
  positions: any[]
}

const props = defineProps<Props>()

const setupAnalysis = computed(() => {
  const analysis: { [key: string]: SetupAnalysis } = {}
  
  props.positions.forEach(position => {
    if (position.tradeInfo?.found && position.tradeInfo.trade?.setup_description) {
      const setup = position.tradeInfo.trade.setup_description
      const netProfit = parseFloat(position.netProfit)
      
      if (!analysis[setup]) {
        analysis[setup] = {
          totalTrades: 0,
          winRate: 0,
          totalProfit: 0,
          avgRR: 0
        }
      }
      
      analysis[setup].totalTrades++
      analysis[setup].totalProfit += netProfit
      
      // Calcular win rate
      const wins = props.positions.filter(p => 
        p.tradeInfo?.found && 
        p.tradeInfo.trade?.setup_description === setup && 
        parseFloat(p.netProfit) > 0
      ).length
      
      analysis[setup].winRate = (wins / analysis[setup].totalTrades) * 100
      
      // Calcular RR médio
      const tradesWithRR = props.positions.filter(p => 
        p.tradeInfo?.found && 
        p.tradeInfo.trade?.setup_description === setup
      )
      
      let totalRR = 0
      let rrCount = 0
      
      tradesWithRR.forEach(trade => {
        const tradeData = trade.tradeInfo.trade
        const risk = Math.abs(tradeData.entry - tradeData.stop)
        if (risk > 0) {
          totalRR += Math.abs(parseFloat(trade.netProfit)) / risk
          rrCount++
        }
      })
      
      analysis[setup].avgRR = rrCount > 0 ? totalRR / rrCount : 0
    }
  })
  
  return analysis
})

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
  background: linear-gradient(135deg, #6f42c1 0%, #5a32a3 100%) !important;
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

.bg-purple {
  background-color: #6f42c1 !important;
}
</style> 
<template>
  <main class="container py-4">
    <div class="mb-4">
      <router-link
        to="/trade/new"
        class="btn btn-primary"
      >
        Add New Trade
      </router-link>
    </div>

    <div class="card shadow-sm">
      <div class="table-responsive">
        <table class="table table-hover mb-0">
          <thead class="table-dark">
            <tr>
              <th class="px-3 py-2">Pair & Setup</th>
              <th class="px-3 py-2">Type</th>
              <th class="px-3 py-2">Entry</th>
              <th class="px-3 py-2">Stop</th>
              <th class="px-3 py-2">Take Profits</th>
              <th class="px-3 py-2">Volume Flags</th>
              <th class="px-3 py-2">Analysis</th>
              <th class="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(trade, index) in trades" :key="index">
              <td class="px-3 py-2">
                <div class="d-flex flex-column">
                  <strong>{{ trade.pair }}</strong>
                  <small v-if="trade.setup_description" class="text-muted" style="max-width: 200px; white-space: normal;">
                    {{ trade.setup_description }}
                  </small>
                </div>
              </td>
              <td class="px-3 py-2">
                <span
                  :class="{
                    'badge bg-success': trade.side === 'LONG',
                    'badge bg-danger': trade.side === 'SHORT'
                  }"
                >
                  {{ trade.side }}
                </span>
              </td>
              <td class="px-3 py-2">{{ trade.entry }}</td>
              <td class="px-3 py-2">{{ trade.stop }}</td>
              <td class="px-3 py-2">
                <div class="d-flex flex-wrap gap-1">
                  <template v-for="(tp, index) in getFormattedTPs(trade)" :key="index">
                    <span class="badge bg-info">
                      {{ tp.label }}: {{ tp.value }}
                    </span>
                  </template>
                  <span v-if="getFormattedTPs(trade).length === 0" class="text-muted">-</span>
                </div>
              </td>
              <td class="px-3 py-2">
                <div class="d-flex flex-column gap-1">
                  <span :class="trade.volume_required ? 'badge bg-success' : 'badge bg-secondary'">
                    {{ trade.volume_required ? 'Volume Required' : 'Volume Optional' }}
                  </span>
                  <span :class="trade.volume_adds_margin ? 'badge bg-success' : 'badge bg-secondary'">
                    {{ trade.volume_adds_margin ? 'Volume Adds Margin' : 'No Volume Margin' }}
                  </span>
                </div>
              </td>
              <td class="px-3 py-2">
                <a 
                  v-if="trade.url_analysis" 
                  :href="trade.url_analysis" 
                  target="_blank" 
                  class="btn btn-sm btn-outline-info"
                >
                  View
                </a>
                <span v-else>-</span>
              </td>
              <td class="px-3 py-2">
                <router-link
                  :to="`/trade/${index}/edit`"
                  class="btn btn-sm btn-outline-primary me-2"
                >
                  Edit
                </router-link>
                <button
                  @click="deleteTrade(index)"
                  class="btn btn-sm btn-outline-danger"
                >
                  Delete
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <TradeNotifications />    
  </main>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import TradeNotifications from '../components/TradeNotifications.vue'

interface Trade {
  entry: number
  stop: number
  side: 'LONG' | 'SHORT'
  tp1: number | null
  tp2: number | null
  tp3: number | null
  tp4: number | null
  tp5: number | null
  tp6: number | null
  pair: string
  volume_required: boolean
  volume_adds_margin: boolean
  setup_description: string | null
  url_analysis: string
}

const trades = ref<Trade[]>([])

// Helper function to get formatted TPs for a trade
const getFormattedTPs = (trade: Trade) => {
  const tps = []
  for (let i = 1; i <= 6; i++) {
    const tp = trade[`tp${i}` as keyof Trade] as number | null
    if (tp !== null && tp !== undefined) {
      tps.push({ label: `TP${i}`, value: tp })
    }
  }
  return tps
}

// Load trades from API
const loadTrades = async () => {
  try {
    const response = await fetch('/api/trades')
    trades.value = await response.json()
  } catch (error) {
    console.error('Failed to load trades:', error)
  }
}

// Delete trade
const deleteTrade = async (index: number) => {
  if (!confirm('Are you sure you want to delete this trade?')) return
  
  try {
    await fetch(`/api/trades/${index}`, { method: 'DELETE' })
    await loadTrades()
  } catch (error) {
    console.error('Failed to delete trade:', error)
  }
}

// Initialize
onMounted(() => {
  loadTrades()
})
</script> 
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
          <thead class="table-light">
            <tr>
              <th class="px-3 py-2">Pair</th>
              <th class="px-3 py-2">Type</th>
              <th class="px-3 py-2">Entry</th>
              <th class="px-3 py-2">Stop</th>
              <th class="px-3 py-2">TP1</th>
              <th class="px-3 py-2">TP2</th>
              <th class="px-3 py-2">TP3</th>
              <th class="px-3 py-2">Volume</th>
              <th class="px-3 py-2">Analysis</th>
              <th class="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(trade, index) in trades" :key="index">
              <td class="px-3 py-2">{{ trade.par }}</td>
              <td class="px-3 py-2">
                <span
                  :class="{
                    'badge bg-success': trade.ls === 'LONG',
                    'badge bg-danger': trade.ls === 'SHORT'
                  }"
                >
                  {{ trade.ls }}
                </span>
              </td>
              <td class="px-3 py-2">{{ trade.entry }}</td>
              <td class="px-3 py-2">{{ trade.stop }}</td>
              <td class="px-3 py-2">{{ trade.tp1 }}</td>
              <td class="px-3 py-2">{{ trade.tp2 || '-' }}</td>
              <td class="px-3 py-2">{{ trade.tp3 || '-' }}</td>
              <td class="px-3 py-2">
                <span :class="trade.volume ? 'badge bg-success' : 'badge bg-secondary'">
                  {{ trade.volume ? 'Yes' : 'No' }}
                </span>
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
  </main>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface Trade {
  entry: number
  stop: number
  ls: 'LONG' | 'SHORT'
  tp1: number
  tp2: number | null
  tp3: number | null
  par: string
  volume: boolean
  url_analysis: string
}

const trades = ref<Trade[]>([])

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
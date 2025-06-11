<template>
    <main class="container py-4">
      <div class="mb-4 d-flex justify-content-between align-items-center">
        <div class="d-flex gap-2">
          <router-link
            to="/trade/new"
            class="btn btn-primary"
          >
            Add New Trade
          </router-link>
          <button 
            @click="showStats = !showStats" 
            class="btn btn-outline-secondary"
            :title="showStats ? 'Hide Statistics' : 'Show Statistics'"
          >
            <i class="bi" :class="showStats ? 'bi-chevron-up' : 'bi-chevron-down'"></i>
            Statistics
          </button>
        </div>
        <div class="d-flex gap-2">
          <span class="badge bg-secondary">{{ trades.length }} {{ trades.length === 1 ? 'Trade' : 'Trades' }}</span>
          <span class="badge bg-info">{{ uniquePairs.length }} {{ uniquePairs.length === 1 ? 'Pair' : 'Pairs' }}</span>
          <span class="badge bg-success">{{ longCount }} LONG</span>
          <span class="badge bg-danger">{{ shortCount }} SHORT</span>
        </div>
      </div>
  
      <div v-if="showStats" class="card shadow-sm mb-4">
        <div class="card-body">
          <h6 class="card-title mb-3">Trade Statistics</h6>
          <div class="row g-3">
            <!-- Totals -->
            <div class="col-12">
              <div class="d-flex gap-2 align-items-center">
                <span class="text-muted">Total:</span>
                <span class="badge bg-secondary">{{ trades.length }} Trades</span>
                <span class="badge bg-info">{{ uniquePairs.length }} Pairs</span>
                <span class="badge bg-success">{{ longCount }} LONG</span>
                <span class="badge bg-danger">{{ shortCount }} SHORT</span>
              </div>
            </div>
            
            <!-- By Interval -->
            <div class="col-12">
              <div class="d-flex flex-column gap-2">
                <div v-for="interval in ['5m', '15m', '1h']" :key="interval" class="d-flex gap-2 align-items-center">
                  <span class="text-muted" style="min-width: 40px;">{{ interval }}:</span>
                  <span class="badge bg-secondary">{{ getIntervalStats(interval).total }} Trades</span>
                  <span class="badge bg-info">{{ getIntervalStats(interval).pairs }} Pairs</span>
                  <span class="badge bg-success">{{ getIntervalStats(interval).long }} LONG</span>
                  <span class="badge bg-danger">{{ getIntervalStats(interval).short }} SHORT</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
  
      <div class="card shadow-sm">
        <div class="table-responsive">
          <table class="table table-hover mb-0">
            <thead class="table-dark">
              <tr>
                <th class="px-3 py-2">Pair & Setup</th>
                <th class="px-3 py-2">Type & Interval</th>
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
                    <strong>{{ trade.symbol }}</strong>
                    <small v-if="trade.setup_description" class="text-muted" style="max-width: 200px; white-space: normal;">
                      {{ trade.setup_description }}
                    </small>
                  </div>
                </td>
                <td class="px-3 py-2">
                  <div class="d-flex flex-column gap-1">
                    <span
                      :class="{
                        'badge bg-success': trade.type === 'LONG',
                        'badge bg-danger': trade.type === 'SHORT'
                      }"
                    >
                      {{ trade.type }}
                    </span>
                    <span class="badge bg-secondary">
                      {{ trade.interval || '-' }}
                    </span>
                  </div>
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
  import { Trade } from '../../../utils/types';
  
  
  const trades = ref<Trade[]>([])
  
  const uniquePairs = computed(() => {
    const pairs = new Set(trades.value.map(trade => trade.symbol))
    return Array.from(pairs)
  })
  
  const longCount = computed(() => {
    return trades.value.filter(trade => trade.type === 'LONG').length
  })
  
  const shortCount = computed(() => {
    return trades.value.filter(trade => trade.type === 'SHORT').length
  })
  
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
  
  const getIntervalStats = (interval: string) => {
    const intervalTrades = trades.value.filter(trade => trade.interval === interval)
    const pairs = new Set(intervalTrades.map(trade => trade.symbol))
    
    return {
      total: intervalTrades.length,
      pairs: pairs.size,
      long: intervalTrades.filter(trade => trade.type === 'LONG').length,
      short: intervalTrades.filter(trade => trade.type === 'SHORT').length
    }
  }
  
  const showStats = ref(false)
  
  // Initialize
  onMounted(() => {
    loadTrades()
  })
  </script>
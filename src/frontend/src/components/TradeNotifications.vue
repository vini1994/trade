<template>
  <div class="container mt-4">
    <audio ref="alertSound" src="/api/alert" preload="auto"></audio>
    <div class="card">
      <div class="card-header d-flex justify-content-between align-items-center">
        <h5 class="mb-0">Trade Notifications</h5>
        <span class="badge" :class="connectionStatusClass">{{ connectionStatus }}</span>
      </div>
      <div class="card-body">
        <div v-if="trades.length === 0" class="text-center text-muted">
          No trade notifications received yet
        </div>
        <div v-else class="list-group">
          <div v-for="(trade, index) in trades" :key="index" class="list-group-item">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <div class="d-flex justify-content-between align-items-center mb-1">
                  <h6 class="mb-0">{{ trade.symbol }}</h6>
                  <small class="text-muted">{{ formatTimestamp(trade.timestamp) }}</small>
                </div>
                <div class="d-flex gap-3">
                  <span class="badge" :class="trade.type === 'LONG' ? 'bg-success' : 'bg-danger'">
                    {{ trade.type }}
                  </span>
                  <span>Entry: {{ trade.entry }}</span>
                  <span>Stop: {{ trade.stop }}</span>
                </div>
                <div class="mt-2">
                  <strong>Take Profits:</strong>
                  <div class="d-flex flex-wrap gap-3">
                    <span v-if="trade.takeProfits.tp1">TP1: {{ trade.takeProfits.tp1 }}</span>
                    <span v-if="trade.takeProfits.tp2">TP2: {{ trade.takeProfits.tp2 }}</span>
                    <span v-if="trade.takeProfits.tp3">TP3: {{ trade.takeProfits.tp3 }}</span>
                    <span v-if="trade.takeProfits.tp4">TP4: {{ trade.takeProfits.tp4 }}</span>
                    <span v-if="trade.takeProfits.tp5">TP5: {{ trade.takeProfits.tp5 }}</span>
                    <span v-if="trade.takeProfits.tp6">TP6: {{ trade.takeProfits.tp6 }}</span>
                  </div>
                </div>
                <div class="mt-2">
                  <div class="d-flex gap-2 align-items-center">
                    <span class="badge" :class="trade.validation.isValid ? 'bg-success' : 'bg-danger'">
                      {{ trade.validation.isValid ? 'Valid' : 'Invalid' }}
                    </span>
                    <span v-if="trade.isWarning" class="badge bg-warning text-dark">
                      ⚠️ Warning
                    </span>
                    <span class="badge" :class="trade.volume_required ? 'bg-danger' : 'bg-success'">
                      {{ trade.volume_required ? 'Volume Required' : 'Volume Optional' }}
                    </span>
                    <span class="badge" :class="trade.volume_adds_margin ? 'bg-success' : 'bg-secondary'">
                      {{ trade.volume_adds_margin ? 'Adds Margin' : 'No Extra Margin' }}
                    </span>
                    <small class="text-muted">{{ trade.validation.message }}</small>
                  </div>
                  <div class="mt-1">
                    <small class="text-muted">Entry Analysis: {{ trade.validation.entryAnalysis.message }}</small>
                  </div>
                  <div class="mt-1">
                    <small class="text-muted">
                      Volume: {{ trade.validation.volumeAnalysis.currentVolume.toFixed(2) }} 
                      (std: {{ trade.validation.volumeAnalysis.stdBar.toFixed(2) }})
                      <span class="ms-1" :class="{
                        'text-danger': trade.validation.volumeAnalysis.color === 'RED',
                        'text-warning': trade.validation.volumeAnalysis.color === 'ORANGE',
                        'text-info': trade.validation.volumeAnalysis.color === 'YELLOW',
                        'text-secondary': trade.validation.volumeAnalysis.color === 'WHITE',
                        'text-primary': trade.validation.volumeAnalysis.color === 'BLUE'
                      }">
                        [{{ trade.validation.volumeAnalysis.color }}]
                      </span>
                    </small>
                  </div>
                  <div v-if="trade.setup_description" class="mt-2">
                    <div class="card bg-light">
                      <div class="card-body p-2">
                        <h6 class="card-title mb-1">Setup Description</h6>
                        <small class="text-muted">{{ trade.setup_description }}</small>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Execution Results Section -->
                <div v-if="trade.executionResult" class="mt-2">
                  <div class="card bg-light">
                    <div class="card-body p-2">
                      <h6 class="card-title mb-2">Execution Results</h6>
                      <div class="d-flex flex-column gap-1">
                        <div class="d-flex justify-content-between">
                          <small>Leverage:</small>
                          <small class="fw-bold">{{ trade.executionResult.leverage }}x</small>
                        </div>
                        <div class="d-flex justify-content-between">
                          <small>Quantity:</small>
                          <small class="fw-bold">{{ trade.executionResult.quantity.toFixed(4) }}</small>
                        </div>
                        <div v-if="trade.volume_adds_margin && trade.executionResult.volumeMarginAdded" class="mt-2 pt-2 border-top">
                          <div class="d-flex justify-content-between">
                            <small>Volume Margin:</small>
                            <small class="fw-bold text-success">+{{ trade.executionResult.volumeMarginAdded.percentage }}%</small>
                          </div>
                          <div class="d-flex justify-content-between">
                            <small>Base Margin:</small>
                            <small class="fw-bold">{{ trade.executionResult.volumeMarginAdded.baseMargin.toFixed(2) }}</small>
                          </div>
                          <div class="d-flex justify-content-between">
                            <small>Total Margin:</small>
                            <small class="fw-bold">{{ trade.executionResult.volumeMarginAdded.totalMargin.toFixed(2) }}</small>
                          </div>
                        </div>
                        <div class="d-flex justify-content-between">
                          <small>Entry Order:</small>
                          <small class="text-truncate" style="max-width: 150px;">{{ trade.executionResult.entryOrderId }}</small>
                        </div>
                        <div class="d-flex justify-content-between">
                          <small>Stop Order:</small>
                          <small class="text-truncate" style="max-width: 150px;">{{ trade.executionResult.stopOrderId }}</small>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Execution Error Section -->
                <div v-if="trade.executionError" class="mt-2">
                  <div class="alert alert-danger p-2 mb-0">
                    <small class="d-flex align-items-center">
                      <i class="bi bi-exclamation-triangle-fill me-1"></i>
                      <span>Execution Error: {{ trade.executionError }}</span>
                    </small>
                  </div>
                </div>

                <div class="mt-2">
                  <a :href="trade.analysisUrl" target="_blank" class="btn btn-sm btn-outline-primary">
                    View Analysis
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

interface TakeProfits {
  tp1: number | null;
  tp2: number | null;
  tp3: number | null;
  tp4: number | null;
  tp5: number | null;
  tp6: number | null;
}

interface VolumeAnalysis {
  color: string
  stdBar: number
  mean: number
  std: number
  currentVolume: number
}

interface EntryAnalysis {
  canEnter: boolean
  currentClose: number
  hasClosePriceBeforeEntry: boolean
  message: string
}

interface Validation {
  isValid: boolean
  message: string
  volumeAnalysis: VolumeAnalysis
  entryAnalysis: EntryAnalysis
}

interface ExecutionResult {
  leverage: number;
  quantity: number;
  entryOrderId: string;
  stopOrderId: string;
  volumeMarginAdded?: {
    percentage: number;
    baseMargin: number;
    totalMargin: number;
  };
}

interface Trade {
  symbol: string
  type: 'LONG' | 'SHORT'
  entry: number
  stop: number
  takeProfits: TakeProfits
  validation: Validation
  analysisUrl: string
  executionResult?: ExecutionResult
  executionError?: string
  timestamp: string
  isWarning?: boolean
  volume_required: boolean
  volume_adds_margin: boolean
  setup_description: string | null
}

const trades = ref<Trade[]>([])
const connectionStatus = ref('Connecting...')
const connectionStatusClass = ref('bg-warning')
let ws: WebSocket | null = null

const alertSound = ref<HTMLAudioElement | null>(null)

const connectWebSocket = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const wsUrl = `${protocol}//localhost:3000`
  
  ws = new WebSocket(wsUrl)

  ws.onopen = () => {
    connectionStatus.value = 'Connected'
    connectionStatusClass.value = 'bg-success'
  }

  ws.onclose = () => {
    connectionStatus.value = 'Disconnected'
    connectionStatusClass.value = 'bg-danger'
    // Try to reconnect after 30 seconds
    setTimeout(connectWebSocket, 30000)
  }

  ws.onerror = (error) => {
    console.error('WebSocket error:', error)
    connectionStatus.value = 'Error'
    connectionStatusClass.value = 'bg-danger'
  }

  ws.onmessage = (event) => {
    try {
      console.log('Received trade notification:', event.data)
      const trade: Trade = JSON.parse(event.data)
      trades.value.unshift(trade) // Add new trade at the beginning
      playAlertSound() // Play alert sound when receiving a trade
      
      // Keep only the last 50 trades
      if (trades.value.length > 50) {
        trades.value = trades.value.slice(0, 50)
      }
    } catch (error) {
      console.error('Error parsing trade notification:', error)
    }
  }
}

const playAlertSound = () => {
  if (alertSound.value) {
    alertSound.value.currentTime = 0 // Reset the audio to start
    alertSound.value.play().catch(error => {
      console.error('Error playing alert sound:', error)
    })
  }
}

const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
};

onMounted(() => {
  connectWebSocket()
})

onUnmounted(() => {
  if (ws) {
    ws.close()
  }
})
</script>

<style scoped>
.list-group-item {
  background-color: var(--bs-body-bg);
  border-color: var(--bs-border-color);
}

[data-bs-theme="dark"] .list-group-item {
  background-color: #343a40;
  border-color: #495057;
}

/* Execution Results Styles */
.card.bg-light {
  background-color: rgba(var(--bs-light-rgb), 0.1) !important;
  border: 1px solid rgba(var(--bs-border-color-rgb), 0.2);
}

[data-bs-theme="dark"] .card.bg-light {
  background-color: rgba(255, 255, 255, 0.05) !important;
  border-color: rgba(255, 255, 255, 0.1);
}

.card-title {
  font-size: 0.9rem;
  color: var(--bs-secondary);
  margin-bottom: 0.5rem;
}

.text-truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.alert-danger {
  background-color: rgba(var(--bs-danger-rgb), 0.1);
  border-color: rgba(var(--bs-danger-rgb), 0.2);
}

[data-bs-theme="dark"] .alert-danger {
  background-color: rgba(220, 53, 69, 0.2);
  border-color: rgba(220, 53, 69, 0.3);
}

.bi-exclamation-triangle-fill {
  color: var(--bs-danger);
}

/* Volume color styles */
.text-danger {
  color: var(--bs-danger) !important;
}

.text-warning {
  color: var(--bs-warning) !important;
}

.text-info {
  color: var(--bs-info) !important;
}

.text-secondary {
  color: var(--bs-secondary) !important;
}

.text-primary {
  color: var(--bs-primary) !important;
}

/* Setup description card styles */
.card.bg-light .card-title {
  font-size: 0.9rem;
  color: var(--bs-secondary);
  margin-bottom: 0.5rem;
}

[data-bs-theme="dark"] .card.bg-light {
  background-color: rgba(255, 255, 255, 0.05) !important;
  border-color: rgba(255, 255, 255, 0.1);
}

[data-bs-theme="dark"] .card.bg-light .card-title {
  color: var(--bs-light);
}
</style> 
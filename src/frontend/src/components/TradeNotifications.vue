<template>
  <div class="container mt-4">
    <audio ref="alertSound" src="/api/alert" preload="auto"></audio>
    <div class="card">
      <div class="card-header d-flex justify-content-between align-items-center">
        <div class="d-flex align-items-center gap-2">
          <h5 class="mb-0">Trade Notifications</h5>
          <router-link to="/notifications" class="btn btn-sm btn-outline-primary">
            <i class="bi bi-clock-history"></i> History
          </router-link>
        </div>
        <span class="badge" :class="connectionStatusClass">{{ connectionStatus }}</span>
      </div>
      <div class="card-body">
        <TradeListNotifications :trades="trades" :key="trades.length" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import TradeListNotifications from './TradeListNotifications.vue'
import { TradeNotification } from '../../../utils/types'

const router = useRouter()
const trades = ref<TradeNotification[]>([])
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
      const trade: TradeNotification = JSON.parse(event.data)
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
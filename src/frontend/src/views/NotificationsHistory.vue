<template>
  <div class="notifications-history">
    <h1>Notifications History</h1>
    <TradeListNotifications 
      :notifications="notifications"
      :loading="loading"
      :error="error"
    />
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted } from 'vue'
import TradeListNotifications from '../components/TradeListNotifications.vue'
import axios from 'axios'
import { TradeNotification } from '../../utils/types'

export default defineComponent({
  name: 'NotificationsHistory',
  components: {
    TradeListNotifications
  },
  setup() {
    const notifications = ref<TradeNotification[]>([])
    const loading = ref(true)
    const error = ref<string | null>(null)

    const fetchNotifications = async () => {
      try {
        loading.value = true
        const response = await axios.get('/api/notifications')
        notifications.value = response.data
      } catch (err) {
        error.value = 'Erro ao carregar notificações'
        console.error('Error fetching notifications:', err)
      } finally {
        loading.value = false
      }
    }

    onMounted(() => {
      fetchNotifications()
    })

    return {
      notifications,
      loading,
      error
    }
  }
})
</script>

<style scoped>
.notifications-history {
  padding: 20px;
}

h1 {
  margin-bottom: 20px;
  color: #2c3e50;
}
</style> 
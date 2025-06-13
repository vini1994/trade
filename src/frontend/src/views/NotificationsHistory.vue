<template>
  <div class="notifications-history">
    <button class="back-button" @click="goBack">
      <span>← Back</span>
    </button>
    <h1>Notifications History</h1>
    <TradeListNotifications :trades="notifications" :key="notifications.length" />
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted } from 'vue'
import TradeListNotifications from '../components/TradeListNotifications.vue'
import axios from 'axios'
import { TradeNotification } from '../../../utils/types'
import { useRouter } from 'vue-router'

export default defineComponent({
  name: 'NotificationsHistory',
  components: {
    TradeListNotifications
  },
  setup() {
    const router = useRouter()
    const notifications = ref<TradeNotification[]>([])
    const loading = ref(true)
    const error = ref<string | null>(null)

    const fetchNotifications = async () => {
      try {
        loading.value = true
        const response = await axios.get('/api/notifications')
        notifications.value = response.data
        console.log(notifications.value)
        console.log(notifications)
        console.log(response.data)
      } catch (err) {
        error.value = 'Erro ao carregar notificações'
        console.error('Error fetching notifications:', err)
      } finally {
        loading.value = false
      }
    }

    const goBack = () => {
      router.back()
    }

    onMounted(() => {
      fetchNotifications()
    })

    return {
      notifications,
      loading,
      error,
      goBack
    }
  }
})
</script>

<style scoped>
.notifications-history {
  padding: 20px;
}

.back-button {
  background: none;
  border: none;
  color: #2c3e50;
  font-size: 16px;
  cursor: pointer;
  padding: 8px 0;
  margin-bottom: 16px;
  display: inline-flex;
  align-items: center;
  transition: color 0.2s;
}

.back-button:hover {
  color: #42b983;
}

h1 {
  margin-bottom: 20px;
  color: #2c3e50;
}
</style> 
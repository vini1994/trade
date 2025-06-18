import { createRouter, createWebHistory } from 'vue-router'
import TradeList from '../views/TradeList.vue'
import TradeForm from '../views/TradeForm.vue'
import NotificationsHistory from '../views/NotificationsHistory.vue'
import Dashboard from '../views/Dashboard.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: TradeList
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: Dashboard
    },
    {
      path: '/trade/new',
      name: 'new-trade',
      component: TradeForm
    },
    {
      path: '/trade/:id/edit',
      name: 'edit-trade',
      component: TradeForm
    },
    {
      path: '/notifications',
      name: 'notifications',
      component: NotificationsHistory
    }
  ]
})

export default router 
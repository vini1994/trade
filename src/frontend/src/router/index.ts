import { createRouter, createWebHistory } from 'vue-router'
import TradeList from '../views/TradeList.vue'
import TradeForm from '../views/TradeForm.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: TradeList
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
    }
  ]
})

export default router 
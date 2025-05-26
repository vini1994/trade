<template>
  <div class="container py-4">
    <div class="card shadow-sm">
      <div class="card-header">
        <h5 class="card-title mb-0">{{ isEditing ? 'Edit Trade' : 'Add New Trade' }}</h5>
      </div>
      <div class="card-body">
        <form @submit.prevent="saveTrade">
          <div class="mb-3">
            <label class="form-label">Pair</label>
            <input
              v-model="tradeData.pair"
              type="text"
              class="form-control"
              required
            />
          </div>
          <div class="mb-3">
            <label class="form-label">Type</label>
            <select
              v-model="tradeData.side"
              class="form-select"
              required
            >
              <option value="LONG">LONG</option>
              <option value="SHORT">SHORT</option>
            </select>
          </div>
          <div class="mb-3">
            <label class="form-label">Entry</label>
            <input
              v-model.number="tradeData.entry"
              type="number"
              step="any"
              class="form-control"
              required
            />
          </div>
          <div class="mb-3">
            <label class="form-label">Stop</label>
            <input
              v-model.number="tradeData.stop"
              type="number"
              step="any"
              class="form-control"
              required
            />
          </div>
          <div class="mb-3">
            <label class="form-label">TP1</label>
            <input
              v-model.number="tradeData.tp1"
              type="number"
              step="any"
              class="form-control"
            />
          </div>
          <div class="mb-3">
            <label class="form-label">TP2</label>
            <input
              v-model.number="tradeData.tp2"
              type="number"
              step="any"
              class="form-control"
            />
          </div>
          <div class="mb-3">
            <label class="form-label">TP3</label>
            <input
              v-model.number="tradeData.tp3"
              type="number"
              step="any"
              class="form-control"
            />
          </div>
          <div class="mb-3">
            <label class="form-label">TP4</label>
            <input
              v-model.number="tradeData.tp4"
              type="number"
              step="any"
              class="form-control"
            />
          </div>
          <div class="mb-3">
            <label class="form-label">TP5</label>
            <input
              v-model.number="tradeData.tp5"
              type="number"
              step="any"
              class="form-control"
            />
          </div>
          <div class="mb-3">
            <label class="form-label">TP6</label>
            <input
              v-model.number="tradeData.tp6"
              type="number"
              step="any"
              class="form-control"
            />
          </div>
          <div class="mb-3">
            <div class="form-check">
              <input
                v-model="tradeData.volume_required"
                type="checkbox"
                class="form-check-input"
                id="volumeRequiredCheck"
              />
              <label class="form-check-label" for="volumeRequiredCheck">
                Volume Required
              </label>
            </div>
          </div>
          <div class="mb-3">
            <div class="form-check">
              <input
                v-model="tradeData.volume_adds_margin"
                type="checkbox"
                class="form-check-input"
                id="volumeMarginCheck"
              />
              <label class="form-check-label" for="volumeMarginCheck">
                Volume Adds Margin
              </label>
            </div>
          </div>
          <div class="mb-3">
            <label class="form-label">Setup Description</label>
            <textarea
              v-model="tradeData.setup_description"
              class="form-control"
              rows="3"
              placeholder="Describe the trading setup..."
            ></textarea>
          </div>
          <div class="mb-3">
            <label class="form-label">Analysis URL</label>
            <input
              v-model="tradeData.url_analysis"
              type="url"
              class="form-control"
              placeholder="https://www.tradingview.com/symbols/..."
            />
          </div>
          <div class="text-end">
            <router-link
              to="/"
              class="btn btn-secondary me-2"
            >
              Cancel
            </router-link>
            <button
              type="submit"
              class="btn btn-primary"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

interface Trade {
  entry: number;
  stop: number;
  side: 'LONG' | 'SHORT';
  tp1: number | null;
  tp2: number | null;
  tp3: number | null;
  tp4: number | null;
  tp5: number | null;
  tp6: number | null;
  pair: string;
  volume_required: boolean;
  volume_adds_margin: boolean;
  setup_description: string | null;
  url_analysis: string;
}

const route = useRoute()
const router = useRouter()

const tradeData = ref<Trade>({
  entry: 0,
  stop: 0,
  side: 'LONG',
  tp1: null,
  tp2: null,
  tp3: null,
  tp4: null,
  tp5: null,
  tp6: null,
  pair: '',
  volume_required: false,
  volume_adds_margin: false,
  setup_description: null,
  url_analysis: ''
})

const isEditing = computed(() => route.params.id !== undefined)

// Load trade data if editing
onMounted(async () => {
  if (isEditing.value) {
    try {
      const response = await fetch(`/api/trades/${route.params.id}`)
      const trade = await response.json()
      tradeData.value = trade
    } catch (error) {
      console.error('Failed to load trade:', error)
      router.push('/')
    }
  }
})

const saveTrade = async () => {
  try {
    if (isEditing.value) {
      await fetch(`/api/trades/${route.params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tradeData.value)
      })
    } else {
      await fetch('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tradeData.value)
      })
    }
    router.push('/')
  } catch (error) {
    console.error('Failed to save trade:', error)
  }
}
</script> 
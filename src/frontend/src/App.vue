<template>
  <div class="min-vh-100">
    <nav class="navbar navbar-expand-lg bg-body-tertiary shadow-sm">
      <div class="container">
        <div class="d-flex justify-content-between w-100 align-items-center">
          <div>
            <h1 class="h4 mb-0">Trade Manager</h1>
          </div>
        </div>
      </div>
    </nav>


    <router-view v-slot="{ Component }">
      <component :is="Component" />
    </router-view>

    
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'


// Initialize dark mode
onMounted(() => {
  document.documentElement.setAttribute('data-bs-theme', 'dark')
})
</script>

<style>
/* Add any custom styles here */
[data-bs-theme="dark"] {
  --bs-body-bg: #212529;
  --bs-body-color: #f8f9fa;
}

[data-bs-theme="dark"] .navbar {
  background-color: #343a40 !important;
}

[data-bs-theme="dark"] .card {
  background-color: #343a40;
  border-color: #495057;
}

[data-bs-theme="dark"] .table {
  color: #f8f9fa;
}

[data-bs-theme="dark"] .table-light {
  background-color: #495057;
  color: #f8f9fa;
}

[data-bs-theme="dark"] .table-hover tbody tr:hover {
  background-color: #495057;
  color: #f8f9fa;
}
</style> 
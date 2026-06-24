<template>
  <button
    class="refresh-button h-full flex flex-row items-center gap-2"
    @click="triggerRefresh"
    title="Refresh data"
  >
  
  <span>Refresh</span>
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-arrow-repeat" viewBox="0 0 16 16">
        <path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41m-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9"/>
        <path fill-rule="evenodd" d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A6.002 6.002 0 0 1 13.917 7H12.9A5 5 0 0 0 8 3M3.1 9a5.002 5.002 0 0 0 8.757 2.182.5.5 0 1 1 .771.636A6.002 6.002 0 0 1 2.083 9z"/>
    </svg>
  </button>
</template>

<script setup>
/**
 * @component RefreshButton
 * @description UI Component for RefreshButton.
 *
 */

import { inject } from 'vue';

const refreshContext = inject('refresh');

const triggerRefresh = () => {
  if (refreshContext && refreshContext.triggerRefresh) {
    refreshContext.triggerRefresh();
  }
};
</script>

<style scoped>
.refresh-button {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 6px;
  color: #94a3b8;
  padding: 0 12px;
  height: 38px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: 'Inter', sans-serif;
  font-size: 0.85rem;
}

.refresh-button:hover {
  border-color: #0ea5e9;
  background: #1e293b;
  color: #e2e8f0;
}

</style>

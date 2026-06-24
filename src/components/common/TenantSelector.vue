<template>
  <div class="tenant-selector-container">
    <div class="display-box" @click="op.toggle($event)">
      <i class="pi pi-building mr-2 text-amber-400"></i>
      <span class="display-text">
        Tenant: <b class="text-white">{{ tenantStore.selectedTenant?.label || 'Select' }}</b>
      </span>
      <i class="pi pi-chevron-down ml-3 text-xs opacity-50"></i>
    </div>

    <OverlayPanel ref="op" class="tenant-panel">
      <div class="p-3 flex flex-col gap-2 w-[220px]">
        <label class="block text-xs font-semibold text-gray-400 uppercase mb-1 tracking-wider">Select Tenant</label>
        <div 
          v-for="tenant in tenantStore.tenants" 
          :key="tenant.id"
          @click="selectTenant(tenant.id)"
          class="tenant-item"
          :class="{ 'active': tenantStore.selectedTenantId === tenant.id }"
        >
          <div class="flex flex-col">
            <span class="text-sm font-medium">{{ tenant.label }}</span>
            <span class="text-[10px] text-gray-500">{{ tenant.description }}</span>
          </div>
          <i v-if="tenantStore.selectedTenantId === tenant.id" class="pi pi-check text-xs text-amber-400"></i>
        </div>
      </div>
    </OverlayPanel>
  </div>
</template>

<script setup>
/**
 * @component TenantSelector
 * @description UI Component for TenantSelector.
 *
 */

import { ref } from 'vue'
import OverlayPanel from 'primevue/overlaypanel'
import { useTenantStore } from '@/store/tenant'

const op = ref(null)
const tenantStore = useTenantStore()

function selectTenant(id) {
  tenantStore.setTenant(id)
  op.value.hide()
}
</script>

<style scoped>
.display-box {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 0 12px;
  height: 38px;
  min-width: 0;
  max-width: 100%;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.display-box:hover {
  border-color: #f59e0b; /* amber-500 */
  background: #1e293b;
}

.display-text {
  flex: 1 1 auto;
  min-width: 0;
  color: #94a3b8;
  font-family: 'Inter', sans-serif;
  font-size: 0.85rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tenant-selector-container {
  width: 100%;
  max-width: 220px;
}

.tenant-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  border: 1px solid transparent;
}

.tenant-item:hover {
  background: #1e293b;
  border-color: #334155;
}

.tenant-item.active {
  background: rgba(245, 158, 11, 0.1);
  border-color: rgba(245, 158, 11, 0.3);
}

.tenant-item.active font-medium {
  color: #f59e0b;
}

:deep(.tenant-panel) {
  background: #111827 !important;
  border: 1px solid #334155 !important;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4) !important;
}
</style>

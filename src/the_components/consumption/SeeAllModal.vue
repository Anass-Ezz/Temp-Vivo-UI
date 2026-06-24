<!-- MeasurementsModal.vue -->
<template>
    <Dialog
      :visible="visible"
      @update:visible="(value) => emit('update:visible', value)"
      modal
      :header="title"
      :style="{ width: '50rem' }"
      :breakpoints="{ '1199px': '75vw', '575px': '90vw' }"
    >
      <DataTable :value="data" stripedRows tableStyle="min-width: 10rem" size="small">
        <Column field="parameter" header="Parameter"></Column>
        <Column field="value" header="Value"></Column>
      </DataTable>
    </Dialog>
  </template>
  
  <script setup>
/**
 * @component SeeAllModal
 * @description UI Component for SeeAllModal.
 *
 * @prop {any} visible - Component property
 * @prop {any} type - Component property
 * @prop {any} required - Component property
 * @prop {any} title - Component property
 * @prop {any} type - Component property
 * @prop {any} default - Component property
 * @prop {any} data - Component property
 * @prop {any} type - Component property
 * @prop {any} required - Component property
 * @emits {string} update:visible - Emitted event
 */

  import Dialog from 'primevue/dialog'
  import DataTable from 'primevue/datatable'
  import Column from 'primevue/column'
  
  // Define props to receive data and visibility from the parent
  defineProps({
    visible: {
      type: Boolean,
      required: true
    },
    title: {
      type: String,
      default: 'Details'
    },
    data: {
      type: Array,
      required: true
    }
  })
  
  // Define the event to notify the parent when the dialog should be closed
  const emit = defineEmits(['update:visible'])
  </script>
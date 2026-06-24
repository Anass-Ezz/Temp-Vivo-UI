# EMS Main Frontend

Vue 3 operator dashboard for the EMS (Energy Management System) platform.

Built with Vue 3, PrimeVue 4, Pinia, and Vite. Connects to OpenEMS Backend via WebSocket JSON-RPC.

## Key modules

| Path | Purpose |
|---|---|
| `src/store/` | Pinia stores — tenant, alerts, dashboard, data |
| `src/composables/` | Reusable logic — PDF export, meter selection, channel status |
| `src/utils/` | WebSocket RPC, formatting, alert catalog, aggregation |
| `src/components/` | Charts, meters, power-flow Sankey, reports |
| `src/views/` | Route-level pages |
| `src/router/` | Vue Router 4 with auth guard |

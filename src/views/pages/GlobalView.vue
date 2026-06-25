<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

const router = useRouter();

const stations = [
  { id: 'S1', name: 'Usine VIVO', lat: 33.7796849, lng: -7.2327647, state: 'healthy', type: 'fuel', ev: true, kwh: 0, flow: 0, kwhTrend: 0, evUtil: 0 }
];

const alerts = [];
const incidents = [];

const mapElement = ref(null);
let map = null;
const markers = {};

const counts = ref({ healthy: 1, degraded: 0, critical: 0, offline: 0 });
const incCounts = ref({ safety: 0, security: 0, energy: 0 });

onMounted(() => {
  initMap();
});

function initMap() {
  if (!mapElement.value) return;
  map = L.map(mapElement.value, { zoomControl: true, attributionControl: true }).setView([33.7796849, -7.2327647], 15);
  
  L.tileLayer('https://mt1.google.com/vt/lyrs=m&hl=fr&gl=MA&x={x}&y={y}&z={z}', {
    attribution: '© Google Maps',
    maxZoom: 20
  }).addTo(map);

  stations.forEach(s => {
    const icon = L.divIcon({
      className: '',
      html: `<div class="vivo-pin ${s.state}"><div class="vivo-pin-dot ${s.state}"></div></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });
    
    const m = L.marker([s.lat, s.lng], { icon }).addTo(map);
    
    const popupHTML = `
      <div class="pp">
        <div class="pp-h">
          <strong>${s.name}</strong>
          <span class="pill ${s.state}">Operational</span>
        </div>
        <div class="pp-meta">${s.id} · Fuel Station${s.ev ? ' · EV' : ''}</div>
        <div class="pp-kpi">
          <div class="pp-kpi-c"><div class="k">Daily Energy</div><div class="v g">0 kWh</div></div>
          <div class="pp-kpi-c"><div class="k">Daily Flow</div><div class="v">0</div></div>
          <div class="pp-kpi-c"><div class="k">EV Station</div><div class="v g">0%</div></div>
          <div class="pp-kpi-c"><div class="k">Alerts</div><div class="v g">0</div></div>
        </div>
        <button class="pp-go" onclick="window.dispatchEvent(new CustomEvent('open-station', {detail: '${s.id}'}))">Open station →</button>
      </div>`;
      
    m.bindPopup(popupHTML, { closeButton: true, offset: [0, -2] });
    markers[s.id] = { marker: m, station: s };
  });

  window.addEventListener('open-station', handleOpenStation);
}

function handleOpenStation(e) {
  router.push(`/hub-station/${e.detail}`);
}

function filterByState(state) {
  Object.values(markers).forEach(({ marker, station }) => {
    if (state === 'all' || station.state === state) {
      if (!map.hasLayer(marker)) marker.addTo(map);
    } else {
      if (map.hasLayer(marker)) map.removeLayer(marker);
    }
  });
}
</script>

<template>
  <div class="shell">
    <aside class="sb">
      <div class="sb-brand">
        <div class="sb-logo">V</div>
        <div><strong>Vivo OIP</strong><small>Morocco</small></div>
      </div>
      <nav class="sb-nav">
        <div class="sb-lbl">Network</div>
        <div class="sb-item active"><div class="sb-ico"><i class="pi pi-globe"></i></div><span>Network View</span></div>
        <div class="sb-item"><div class="sb-ico"><i class="pi pi-map-marker"></i></div><span>Stations</span><span class="sb-bdg b">1</span></div>

        <div class="sb-lbl">Suites — Network</div>
        <div class="sb-item"><div class="sb-ico"><i class="pi pi-bolt"></i></div><span>Energy & EV</span></div>

        <div class="sb-lbl">Operations</div>
        <div class="sb-item"><div class="sb-ico"><i class="pi pi-bell"></i></div><span>Alerts</span><span class="sb-bdg">0</span></div>
        <div class="sb-item"><div class="sb-ico"><i class="pi pi-check-square"></i></div><span>Tasks</span><span class="sb-bdg b">0</span></div>
        <div class="sb-item"><div class="sb-ico"><i class="pi pi-file"></i></div><span>Reports</span></div>

        <div class="sb-lbl">System</div>
        <div class="sb-item"><div class="sb-ico"><i class="pi pi-cog"></i></div><span>Administration</span></div>
        <div class="sb-item"><div class="sb-ico"><i class="pi pi-user"></i></div><span>My profile</span></div>
      </nav>
      <div class="sb-foot">
        <span class="sb-dot"></span>
        <span>1 station · 1 online</span>
      </div>
    </aside>

    <div class="ct">
      <div class="topbar">
        <div class="tb-l">
          <div>
            <div class="tb-title">Network View · Morocco</div>
            <div class="tb-sub">L1 · Network · 1 station</div>
          </div>
          <span class="scope-chip">🇲🇦 National</span>
        </div>
        <div class="tb-search">
          <span class="tb-search-ico"><i class="pi pi-search"></i></span>
          <input id="globalSearch" placeholder="Search station, alert, city…" />
        </div>
        <div class="tb-r">
          <button class="tb-btn active">Today</button>
          <button class="tb-btn">7d</button>
          <button class="tb-btn">30d</button>
          <div class="tb-live">LIVE</div>
          <div class="tb-ico-btn" title="Notifications"><i class="pi pi-bell"></i></div>
          <div class="tb-ico-btn" title="Settings"><i class="pi pi-cog"></i></div>
        </div>
      </div>

      <div class="main">
        <div class="map-card">
          <div class="map-head">
            <div class="map-head-l">
              <h3>Network Map</h3>
              <p>· Click on a station to open</p>
            </div>
            <div class="map-controls">
              <button class="map-ctrl active" @click="filterByState('all')">All</button>
              <button class="map-ctrl" @click="filterByState('critical')">Critical</button>
              <button class="map-ctrl" @click="filterByState('degraded')">Degraded</button>
              <button class="map-ctrl" @click="filterByState('ev')">With EV</button>
            </div>
          </div>
          <div class="map-wrap">
            <div id="map" ref="mapElement"></div>
            <div class="map-legend">
              <div class="map-legend-t">Network Status</div>
              <div class="lg-row"><div class="lg-dot healthy"></div><span>Operational</span><span class="lg-count">{{ counts.healthy }}</span></div>
              <div class="lg-row"><div class="lg-dot degraded"></div><span>Degraded</span><span class="lg-count">{{ counts.degraded }}</span></div>
              <div class="lg-row"><div class="lg-dot critical"></div><span>Critical</span><span class="lg-count">{{ counts.critical }}</span></div>
              <div class="lg-row"><div class="lg-dot offline"></div><span>Offline</span><span class="lg-count">{{ counts.offline }}</span></div>
            </div>
          </div>
        </div>

        <div class="ip">
          <div class="ip-card">
            <div class="ip-h"><div class="ip-h-l"><div class="ip-h-ico n"><i class="pi pi-globe"></i></div><strong>Network Status</strong></div><span class="ip-h-r">real-time</span></div>
            <div class="ip-body">
              <div class="ss-grid">
                <div class="ss-c h" @click="filterByState('healthy')"><div class="ssl">Operational</div><div class="ssv">1</div><div class="ssp">100%</div></div>
                <div class="ss-c d" @click="filterByState('degraded')"><div class="ssl">Degraded</div><div class="ssv">0</div><div class="ssp">0%</div></div>
                <div class="ss-c c" @click="filterByState('critical')"><div class="ssl">Critical</div><div class="ssv">0</div><div class="ssp">0%</div></div>
                <div class="ss-c o" @click="filterByState('offline')"><div class="ssl">Offline</div><div class="ssv">0</div><div class="ssp">0%</div></div>
              </div>
            </div>
          </div>

          <div class="ip-card">
            <div class="ip-h"><div class="ip-h-l"><div class="ip-h-ico e"><i class="pi pi-bolt"></i></div><strong>Energy — Top 5 Consumers</strong></div><span class="ip-h-r">today</span></div>
            <div class="ip-body">
              <div class="top-list">
                <div class="text-sm text-gray-400 p-2 text-center" style="font-size: 13px;">No data yet</div>
              </div>
            </div>
          </div>

          <div class="ip-card">
            <div class="ip-h"><div class="ip-h-l"><div class="ip-h-ico s"><i class="pi pi-exclamation-triangle"></i></div><strong>Critical Alerts</strong></div><span class="ip-h-r">0 actives</span></div>
            <div class="ip-body">
              <div class="al-list">
                <div class="text-sm text-gray-400 p-2 text-center" style="font-size: 13px;">No active alerts</div>
              </div>
            </div>
          </div>

          <div class="ip-card">
            <div class="ip-h"><div class="ip-h-l"><div class="ip-h-ico i"><i class="pi pi-list"></i></div><strong>Incidents — 24h</strong></div><span class="ip-h-r">0 total</span></div>
            <div class="ip-body">
              <div class="inc-grid">
                <div class="inc-c"><div class="ic-ic"><i class="pi pi-shield"></i></div><div class="ic-v">0</div><div class="ic-l">Safety</div></div>
                <div class="inc-c"><div class="ic-ic"><i class="pi pi-video"></i></div><div class="ic-v">0</div><div class="ic-l">Security</div></div>
                <div class="inc-c"><div class="ic-ic"><i class="pi pi-bolt"></i></div><div class="ic-v">0</div><div class="ic-l">Energy</div></div>
              </div>
            </div>
          </div>

          <div class="ip-card">
            <div class="ip-h"><div class="ip-h-l"><div class="ip-h-ico v"><i class="pi pi-car"></i></div><strong>EV Chargers — Top 5 Usage</strong></div><span class="ip-h-r">7d</span></div>
            <div class="ip-body">
              <div class="top-list">
                <div class="text-sm text-gray-400 p-2 text-center" style="font-size: 13px;">No data yet</div>
              </div>
            </div>
          </div>

          <div class="ip-foot">
            <span>Last updated · <span>just now</span></span>
            <span class="lk">See all KPIs →</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.shell {
  --ipw: 380px;
  --b2: #1e293b;
  --b3: #0f172a;
  --b4: #334155;
  --br1: #334155;
  --br2: #475569;
  --rl: 12px;
  --sh: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  --t0: #ffffff;
  --t1: #f1f5f9;
  --t2: #cbd5e1;
  --t3: #94a3b8;
  --t4: #64748b;
  --mo: 'IBM Plex Mono', monospace;
  --fn: 'Outfit', sans-serif;
  --tr: all 0.2s ease;
  --acs: rgba(0, 221, 181, 0.1);
  --ac: #00ddb5;
  --acb: rgba(0, 221, 181, 0.3);
  --am: #ffbe5c;
  --rd: #ff6e7f;
  --bl: #5e9dff;
  --pu: #b898f8;
  
  font-family: var(--fn);
  background: #070a10;
  color: var(--t1);
  height: 100vh;
  width: 100vw;
  display: flex;
  overflow: hidden;
}

/* Base Layout */
.sb { width: 240px; background: var(--b2); border-right: 1px solid var(--br1); display: flex; flex-direction: column; }
.ct { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.topbar { height: 60px; border-bottom: 1px solid var(--br1); display: flex; align-items: center; justify-content: space-between; padding: 0 16px; background: rgba(7,10,16,.5); }

/* Sidebar */
.sb-brand { padding: 20px 16px; display: flex; align-items: center; gap: 10px; cursor: pointer; }
.sb-logo { width: 32px; height: 32px; background: var(--rd); color: white; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 16px; }
.sb-brand strong { display: block; font-size: 14px; color: var(--t0); line-height: 1.2; }
.sb-brand small { font-size: 11px; color: var(--t3); text-transform: uppercase; letter-spacing: 0.05em; }
.sb-nav { flex: 1; padding: 0 10px; overflow-y: auto; }
.sb-lbl { font-size: 10px; color: var(--t4); text-transform: uppercase; letter-spacing: 0.08em; margin: 20px 0 8px 10px; font-weight: 600; }
.sb-item { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px; cursor: pointer; color: var(--t2); font-size: 13px; font-weight: 500; transition: var(--tr); margin-bottom: 2px; }
.sb-item:hover { background: var(--b4); color: var(--t0); }
.sb-item.active { background: var(--acs); color: var(--ac); }
.sb-ico { width: 20px; text-align: center; font-size: 14px; }
.sb-bdg { margin-left: auto; background: var(--b4); padding: 2px 6px; border-radius: 12px; font-size: 10px; color: var(--t1); }
.sb-bdg.a { background: var(--am); color: #000; }
.sb-bdg.b { background: var(--ac); color: #000; }
.sb-foot { padding: 16px; border-top: 1px solid var(--br1); font-size: 11px; color: var(--t3); display: flex; align-items: center; gap: 8px; }
.sb-dot { width: 6px; height: 6px; background: var(--ac); border-radius: 50%; }

/* Topbar */
.tb-l { display: flex; align-items: center; gap: 16px; }
.tb-title { font-size: 14px; font-weight: 600; color: var(--t0); line-height: 1.2; }
.tb-sub { font-size: 11px; color: var(--t3); }
.scope-chip { background: var(--b3); border: 1px solid var(--acb); color: var(--ac); padding: 4px 10px; border-radius: 16px; font-size: 11px; font-weight: 600; }
.tb-search { display: flex; align-items: center; background: var(--b3); border: 1px solid var(--br1); padding: 6px 12px; border-radius: 20px; width: 300px; }
.tb-search input { background: transparent; border: none; color: var(--t1); font-size: 12px; outline: none; width: 100%; margin-left: 8px; }
.tb-r { display: flex; align-items: center; gap: 10px; }
.tb-btn { background: var(--b3); border: 1px solid var(--br1); color: var(--t2); padding: 6px 12px; border-radius: 6px; font-size: 12px; cursor: pointer; }
.tb-btn.active { background: var(--b4); color: var(--t0); }
.tb-live { color: var(--ac); font-size: 11px; font-weight: bold; display: flex; align-items: center; gap: 6px; margin: 0 10px; }
.tb-live::before { content: ''; width: 6px; height: 6px; background: var(--ac); border-radius: 50%; box-shadow: 0 0 8px var(--ac); }
.tb-ico-btn { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: var(--b3); border-radius: 8px; cursor: pointer; border: 1px solid var(--br1); position: relative; }

/* Main Map Layout */
.main{flex:1;display:grid;grid-template-columns:1fr var(--ipw);gap:16px;padding:16px;overflow:hidden;min-height:0}
.map-card{background:var(--b2);border:1px solid var(--br1);border-radius:var(--rl);overflow:hidden;display:flex;flex-direction:column;box-shadow:var(--sh);min-height:0}
.map-head{padding:12px 16px;border-bottom:1px solid var(--br1);display:flex;align-items:center;justify-content:space-between;gap:10px;background:rgba(7,10,16,.5)}
.map-head-l{display:flex;align-items:center;gap:10px;min-width:0}
.map-head-l h3{font-size:13px;font-weight:600;letter-spacing:-.01em; color: var(--t0)}
.map-head-l p{font-size:11px;color:var(--t3);font-family:var(--mo)}
.map-controls{display:flex;align-items:center;gap:5px}
.map-ctrl{height:28px;padding:0 12px;border-radius:6px;background:var(--b3);border:1px solid var(--br1);color:var(--t2);cursor:pointer;font-size:11px;display:flex;align-items:center;gap:4px;transition:var(--tr)}
.map-ctrl:hover{background:var(--b4);color:var(--t0)}
.map-ctrl.active{background:var(--acs);color:var(--ac);border-color:var(--acb)}
.map-wrap{flex:1;position:relative;min-height:0}
#map{width:100%;height:100%;background:#0d111b; z-index: 1;}

:deep(.leaflet-container){background:#0d111b !important;font-family:var(--fn) !important}
:deep(.leaflet-tile){filter:invert(.92) hue-rotate(180deg) brightness(.9) contrast(.85) saturate(.7)}
:deep(.leaflet-control-zoom){border:1px solid var(--br1) !important;background:var(--b2) !important; display: flex; flex-direction: column; }
:deep(.leaflet-control-zoom a){background:var(--b2) !important;color:var(--t1) !important;border-bottom:1px solid var(--br1) !important;font-family:var(--fn) !important;width:26px !important;height:26px !important;line-height:26px !important;font-size:14px !important}
:deep(.leaflet-control-zoom a:hover){background:var(--b4) !important;color:var(--t0) !important; text-decoration: none;}
:deep(.leaflet-control-attribution){background:rgba(11,15,24,.7) !important;color:var(--t3) !important;font-size:8.5px !important;font-family:var(--mo) !important}
:deep(.leaflet-control-attribution a){color:var(--t2) !important}

.map-legend{position:absolute;bottom:16px;left:16px;background:rgba(11,15,24,.92);backdrop-filter:blur(8px);border:1px solid var(--br1);border-radius:8px;padding:12px;z-index:500;display:flex;flex-direction:column;gap:8px;box-shadow:var(--sh)}
.map-legend-t{font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.08em;font-weight:600;margin-bottom:4px}
.lg-row{display:flex;align-items:center;gap:8px;font-size:11px;color:var(--t1)}
.lg-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.lg-dot.healthy{background:var(--ac);box-shadow:0 0 6px var(--ac)}
.lg-dot.degraded{background:var(--am);box-shadow:0 0 6px var(--am)}
.lg-dot.critical{background:var(--rd);box-shadow:0 0 6px var(--rd)}
.lg-dot.offline{background:var(--t4)}
.lg-count{margin-left:auto;font-family:var(--mo);color:var(--t2);font-size:11px}

:deep(.vivo-pin){display:grid;place-items:center;position:relative}
:deep(.vivo-pin-dot){width:14px;height:14px;border-radius:50%;border:2px solid rgba(11,15,24,.9);position:relative;z-index:2;transition:transform .15s ease}
:deep(.vivo-pin-dot.healthy){background:var(--ac);box-shadow:0 0 0 2px rgba(0,221,181,.25),0 0 12px rgba(0,221,181,.6)}
:deep(.vivo-pin-dot.degraded){background:var(--am);box-shadow:0 0 0 2px rgba(255,190,92,.25),0 0 12px rgba(255,190,92,.6)}
:deep(.vivo-pin-dot.critical){background:var(--rd);box-shadow:0 0 0 2px rgba(255,110,127,.3),0 0 14px rgba(255,110,127,.8);animation:pin-pulse 2s infinite}
:deep(.vivo-pin-dot.offline){background:var(--t4);box-shadow:0 0 0 2px rgba(62,69,87,.4)}
:deep(.vivo-pin:hover .vivo-pin-dot){transform:scale(1.3)}
@keyframes pin-pulse{0%,100%{box-shadow:0 0 0 2px rgba(255,110,127,.3),0 0 14px rgba(255,110,127,.8)}50%{box-shadow:0 0 0 6px rgba(255,110,127,.15),0 0 20px rgba(255,110,127,.5)}}

:deep(.leaflet-popup-content-wrapper){background:var(--b2) !important;border:1px solid var(--br2) !important;border-radius:8px !important;color:var(--t0) !important;box-shadow:0 8px 24px rgba(0,0,0,.5) !important;padding:0 !important}
:deep(.leaflet-popup-content){margin:0 !important;font-family:var(--fn) !important;font-size:12px !important;width:240px !important}
:deep(.leaflet-popup-tip){background:var(--b2) !important;border:1px solid var(--br2) !important}
:deep(.leaflet-popup-close-button){color:var(--t3) !important;font-size:18px !important;padding:6px 8px 0 0 !important}
:deep(.leaflet-popup-close-button:hover){color:var(--t0) !important}
:deep(.pp){padding:12px}
:deep(.pp-h){display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}
:deep(.pp-h strong){font-size:13px;font-weight:600;color:var(--t0)}
:deep(.pill){background:var(--acs);color:var(--ac);padding:2px 6px;border-radius:12px;font-size:10px;font-weight:600}
:deep(.pp-meta){font-size:11px;color:var(--t3);font-family:var(--mo);margin-bottom:10px}
:deep(.pp-kpi){display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px}
:deep(.pp-kpi-c){background:var(--b3);border:1px solid var(--br1);border-radius:6px;padding:6px 8px}
:deep(.pp-kpi-c .k){font-size:9px;color:var(--t3);text-transform:uppercase;letter-spacing:.05em;font-weight:600}
:deep(.pp-kpi-c .v){font-size:12px;color:var(--t0);font-weight:600;margin-top:2px;font-family:var(--mo)}
:deep(.pp-kpi-c .v.r){color:var(--rd)} :deep(.pp-kpi-c .v.a){color:var(--am)} :deep(.pp-kpi-c .v.g){color:var(--ac)}
:deep(.pp-go){width:100%;height:32px;background:linear-gradient(180deg,rgba(0,221,181,.18),rgba(0,221,181,.08));border:1px solid var(--acb);color:var(--ac);font-size:12px;font-weight:600;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px;transition:var(--tr)}
:deep(.pp-go:hover){background:linear-gradient(180deg,rgba(0,221,181,.26),rgba(0,221,181,.14));transform:translateY(-1px)}

/* Info Panels */
.ip{display:flex;flex-direction:column;gap:12px;overflow-y:auto;padding-right:4px;min-height:0}
.ip::-webkit-scrollbar { width: 6px; }
.ip::-webkit-scrollbar-track { background: transparent; }
.ip::-webkit-scrollbar-thumb { background: var(--b4); border-radius: 4px; }
.ip-card{background:var(--b2);border:1px solid var(--br1);border-radius:var(--rl);overflow:hidden;box-shadow:var(--sh)}
.ip-h{padding:10px 14px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--br1);background:rgba(7,10,16,.4)}
.ip-h-l{display:flex;align-items:center;gap:8px;min-width:0}
.ip-h-ico{width:24px;height:24px;border-radius:6px;display:grid;place-items:center;font-size:12px;flex-shrink:0}
.ip-h-ico.e{background:rgba(94,157,255,.12);color:var(--bl)}
.ip-h-ico.s{background:rgba(255,110,127,.12);color:var(--rd)}
.ip-h-ico.i{background:rgba(255,190,92,.12);color:var(--am)}
.ip-h-ico.f{background:rgba(184,152,248,.12);color:var(--pu)}
.ip-h-ico.v{background:rgba(0,221,181,.12);color:var(--ac)}
.ip-h-ico.n{background:rgba(255,255,255,.05);color:var(--t1)}
.ip-h strong{font-size:12px;font-weight:600;letter-spacing:-.01em; color: var(--t0)}
.ip-h-r{font-size:10px;color:var(--t3);font-family:var(--mo);text-transform:uppercase;letter-spacing:.05em}
.ip-body{padding:12px 14px}

.ss-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.ss-c{padding:10px 12px;background:var(--b3);border:1px solid var(--br1);border-radius:8px;cursor:pointer;transition:var(--tr);position:relative;overflow:hidden}
.ss-c:hover{background:var(--b4);transform:translateY(-1px)}
.ss-c::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px}
.ss-c.h::before{background:var(--ac)} .ss-c.d::before{background:var(--am)} .ss-c.c::before{background:var(--rd)} .ss-c.o::before{background:var(--t4)}
.ss-c .ssl{font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;font-weight:600;margin-bottom:4px}
.ss-c .ssv{font-size:20px;color:var(--t0);font-weight:700;font-family:var(--mo);line-height:1;letter-spacing:-.03em}
.ss-c .ssp{font-size:10px;color:var(--t3);margin-top:4px;font-family:var(--mo)}

.inc-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.inc-c{padding:10px;background:var(--b3);border:1px solid var(--br1);border-radius:8px;text-align:center}
.inc-c .ic-ic{font-size:14px;margin-bottom:4px}
.inc-c .ic-v{font-size:16px;color:var(--t0);font-weight:700;font-family:var(--mo);line-height:1}
.inc-c .ic-l{font-size:9.5px;color:var(--t3);text-transform:uppercase;letter-spacing:.05em;margin-top:4px;font-weight:600}

.ip-foot{padding:10px 14px;border-top:1px solid var(--br1);display:flex;align-items:center;justify-content:space-between;background:rgba(7,10,16,.4);font-size:11px;color:var(--t3);font-family:var(--mo)}
.ip-foot .lk{color:var(--ac);cursor:pointer}
.ip-foot .lk:hover{text-decoration:underline}
</style>

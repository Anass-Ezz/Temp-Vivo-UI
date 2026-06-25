<script setup>
import { ref, computed, inject, onMounted, onUnmounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useDashboardStore } from '@/store/dashboard';
import { useTenantStore } from '@/store/tenant';
import { config } from '@/config/config';
import { formatValue } from '@/utils/formatting';
import { getAddressesForNode } from '@/utils/configHelper';

const router = useRouter();
const route = useRoute();
const stationId = route.params.id || 'S1';

// Mocks
const currentStation = ref({
  id: stationId,
  name: stationId === 'S1' ? 'Usine VIVO' : 'Station ' + stationId,
  city: 'Casablanca',
  manager: 'Ahmed Alaoui',
  phone: '+212 600 00 00 00',
  hours: '24/7',
  openedYear: 2018,
  connectivity: 'online',
  dispensers: 4,
  evChargers: 2,
  cameras: 8,
  hasStore: true,
  hasRestaurant: true,
  hasCarWash: true,
  ev: true,
  pvKwc: 150,
  certif: 'ISO 14001',
  state: 'healthy',
  kwh: '--',
  kwhTrend: '--',
  kwhUnit: 'kWh',
  evUtil: 65,
  flow: 1250,
  flowTrend: 5,
  type: 'fuel'
});

const dashboardStore = useDashboardStore();
const tenantStore = useTenantStore();
const { range, hierarchyLevel } = storeToRefs(dashboardStore);

const aggregationManager = inject('aggregationManager');
const subscriberId = `hub-station-${Math.random().toString(36).substring(7)}`;

function fetchLiveData() {
  if (!aggregationManager) return;
  const backendPeriod = range?.value || 'TODAY';

  const currentHierarchy = tenantStore.selectedHierarchy;
  if (!currentHierarchy) return;
  
  const virtualLevel = currentHierarchy.find(h => h.level === -1);
  const globalNode = virtualLevel?.nodes?.[0]
    ?? currentHierarchy.flatMap(h => h.nodes).find(n => n.isGlobal)
    ?? null;

  const targetNodes = globalNode ? [globalNode] : [];
  if (targetNodes.length === 0) return;

  const energyChannels = [];
  targetNodes.forEach(node => {
    energyChannels.push(...getAddressesForNode(node, config.meterChannels.activeEnergyChannel.name));
  });

  const energyAgg = {
    key: "hubGlobalElectricityEnergy",
    channels: energyChannels,
    channelType: "energy",
    channelsAggregationType: "sum",
    periodAggregation: {
      period: backendPeriod
    }
  };

  aggregationManager.register(
    subscriberId,
    [energyAgg],
    (dataMap) => {
      if (dataMap["hubGlobalElectricityEnergy"] !== undefined) {
        const energyData = dataMap["hubGlobalElectricityEnergy"];
        let totalEnergyWh = energyData?.value || 0;
        const scaled = formatValue(totalEnergyWh, config.meterChannels.activeEnergyChannel.unit);
        currentStation.value.kwh = scaled.value;
        currentStation.value.kwhTrend = energyData?.movementPercentage || 0;
        currentStation.value.kwhUnit = scaled.unit;
      }
    }
  );
}

onMounted(() => {
  fetchLiveData();
});

onUnmounted(() => {
  aggregationManager?.unregister(subscriberId);
});

watch([range, hierarchyLevel, () => tenantStore.selectedTenantId], () => {
  aggregationManager?.unregister(subscriberId);
  fetchLiveData();
});

const SUITES = [
  {id:'energy', name:'Énergie & EV', short:'Énergie', icon:'pi pi-bolt', color:'ac', federated:true, ds:'Gestion de puissance et bornes', useCases:3},
  {id:'safety', name:'Sécurité HSE', short:'HSE', icon:'pi pi-shield', color:'am', federated:false, ds:'Incendie & protection', useCases:2},
  {id:'security', name:'Surveillance', short:'Sûreté', icon:'pi pi-video', color:'rd', federated:false, ds:'CCTV & Intrusions', useCases:4},
  {id:'flow', name:'Flow & Clients', short:'Clients', icon:'pi pi-users', color:'bl', federated:true, ds:'Trafic & conversions', useCases:3},
  {id:'exec', name:'Executive', short:'Exec', icon:'pi pi-chart-line', color:'pu', federated:true, ds:'Performance globale', useCases:1}
];

const ALERTS = ref([]);
const INCIDENTS_24H = ref([]);

const ctxCollapsed = ref(false);

const goBack = () => router.push('/');
const openSuite = (suiteId) => router.push('/dashboard');
const showAlerts = () => alert("Alerts logic (Not implemented in demo)");
const toast = (title, msg) => alert(title + "\n" + msg);

function suiteState(suiteId) {
  return { state: 'healthy', alerts: 0, crit: 0, warn: 0 };
}

function getSuiteKPIs(suiteId){
  const s = currentStation.value;
  if(suiteId==='energy'){
    const trendText = s.kwhTrend === '--' ? '--' : (s.kwhTrend > 0 ? '+' : '') + s.kwhTrend + '% vs hier';
    const trendColor = s.kwhTrend === '--' ? 'g' : (s.kwhTrend > 10 ? 'r' : (s.kwhTrend > 0 ? 'a' : 'g'));
    return [
      {l:'Conso j.', v: s.kwh + ' ' + (s.kwhUnit || 'kWh'), t: trendColor, s: trendText},
      {l:'EV util.', v: '--', t: 'g', s: '--'}
    ];
  }
  if(suiteId==='safety'){
    return [
      {l:'Alertes', v:'--', t: 'g', s: '--'},
      {l:'Incidents 24h', v:'--', t:'g', s: '--'}
    ];
  }
  if(suiteId==='security'){
    return [
      {l:'Caméras', v:'--', t:'g', s:'--'},
      {l:'Incidents 24h', v:'--', t:'g', s: '--'}
    ];
  }
  if(suiteId==='flow'){
    return [
      {l:'Visiteurs j.', v:'--', t:'g', s:'--'},
      {l:'Conv. shop', v: '--', t:'g', s: '--'}
    ];
  }
  if(suiteId==='exec'){
    return [
      {l:'Score station', v:'--', t:'g', s: '--'},
      {l:'Classement', v:'--', t:'g', s:'--'}
    ];
  }
  return [];
}
</script>

<template>
<div class="shell">
  <aside class="sb">
    <div class="sb-brand" @click="goBack">
      <div class="sb-logo">V</div>
      <div><strong>Vivo OIP</strong><small>Maroc</small></div>
    </div>

    <div class="sb-station">
      <div class="sb-station-t">Station active</div>
      <div class="sb-station-n">{{ currentStation.name }}</div>
      <div class="sb-station-id">{{ currentStation.id }} · {{ currentStation.city }}</div>
      <div class="sb-station-sw" @click="goBack"><i class="pi pi-arrow-right-arrow-left"></i> Changer de station</div>
    </div>

    <nav class="sb-nav">
      <div class="sb-lbl">Cette Station</div>
      <div class="sb-item active"><div class="sb-ico"><i class="pi pi-home"></i></div><span>Hub Station</span></div>
      <div class="sb-item" @click="openSuite('energy')"><div class="sb-ico"><i class="pi pi-bolt"></i></div><span>Énergie & EV</span></div>

      <div class="sb-lbl">Réseau</div>
      <div class="sb-item" @click="goBack"><div class="sb-ico"><i class="pi pi-globe"></i></div><span>Vue Réseau</span></div>
      <div class="sb-item" @click="goBack"><div class="sb-ico"><i class="pi pi-map-marker"></i></div><span>Changer de station</span></div>

      <div class="sb-lbl">Opérations</div>
      <div class="sb-item" @click="showAlerts"><div class="sb-ico"><i class="pi pi-bell"></i></div><span>Alertes</span><span class="sb-bdg">0</span></div>
      <div class="sb-item" @click="toast('Tâches', 'À développer')"><div class="sb-ico"><i class="pi pi-check-square"></i></div><span>Tâches</span></div>

      <div class="sb-lbl">Système</div>
      <div class="sb-item" @click="toast('Administration', 'À développer')"><div class="sb-ico"><i class="pi pi-cog"></i></div><span>Administration</span></div>
      <div class="sb-item" @click="toast('Profil', 'À développer')"><div class="sb-ico"><i class="pi pi-user"></i></div><span>Mon profil</span></div>
    </nav>
    <div class="sb-foot">
      <span class="sb-dot"></span>
      <span>Connectivité OK</span>
    </div>
  </aside>

  <div class="ct">
    <div class="topbar">
      <div class="tb-l">
        <div class="tb-back" @click="goBack" title="Retour au réseau"><i class="pi pi-arrow-left"></i></div>
        <div class="tb-bc">
          <span class="tb-bc-seg" @click="goBack">🇲🇦 Maroc</span>
          <span class="tb-bc-sep"><i class="pi pi-angle-right"></i></span>
          <span class="tb-bc-seg cur">Station</span>
        </div>
      </div>
      <div class="tb-search">
        <span class="tb-search-ico"><i class="pi pi-search"></i></span>
        <input placeholder="Rechercher dans cette station…" />
      </div>
      <div class="tb-r">
        <button class="tb-btn" @click="goBack"><i class="pi pi-map-marker"></i> Voir sur carte</button>
        <button class="tb-btn" @click="toast('Appel', currentStation.manager + ' · ' + currentStation.phone)"><i class="pi pi-phone"></i> Manager</button>
        <div class="tb-live">EN DIRECT</div>
        <div class="tb-ico-btn" @click="showAlerts" title="Alertes station"><i class="pi pi-bell"></i></div>
        <div class="tb-ico-btn" @click="toast('Paramètres', 'À développer')"><i class="pi pi-cog"></i></div>
      </div>
    </div>

    <div class="main">
      <div class="col-left">

        <div class="id-card" :class="currentStation.state">
          <div class="id-grid">
            <div class="id-l">
              <div class="id-icon"><i class="pi pi-box"></i></div>
              <div class="id-meta">
                <div class="id-name">{{ currentStation.name }}</div>
                <div class="id-sub">{{ currentStation.id }} · {{ currentStation.city }} · Hub Fuel</div>
                <div class="id-tags">
                  <span v-if="currentStation.ev" class="id-tag hl"><i class="pi pi-bolt" style="font-size:10px;margin-right:4px"></i>Bornes EV</span>
                  <span v-if="currentStation.pvKwc" class="id-tag hl"><i class="pi pi-sun" style="font-size:10px;margin-right:4px"></i>PV {{ currentStation.pvKwc }} kWc</span>
                  <span v-if="currentStation.certif" class="id-tag hl"><i class="pi pi-check-circle" style="font-size:10px;margin-right:4px"></i>{{ currentStation.certif }}</span>
                  <span v-if="currentStation.hasStore" class="id-tag"><i class="pi pi-shopping-cart" style="font-size:10px;margin-right:4px"></i>Shop</span>
                  <span class="id-tag"><i class="pi pi-clock" style="font-size:10px;margin-right:4px"></i>{{ currentStation.hours }}</span>
                </div>
              </div>
            </div>
            <div class="id-r">
              <div class="id-state-l">État global</div>
              <span class="pill" :class="currentStation.state">Opérationnel</span>
              <div class="id-state-time">Mis à jour à l'instant</div>
              <div class="id-actions">
                <button class="btn btn-s" @click="toast('Historique', 'À développer')"><i class="pi pi-chart-bar" style="margin-right:4px"></i>Historique</button>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div class="sec-title">
            <span>État des suites</span>
            <span class="sec-r">{{ SUITES.length }} suites · cliquer pour drill</span>
          </div>
          <div class="health-strip">
            <div v-for="s in SUITES" :key="s.id" class="hs-chip" :class="s.id === 'energy' ? 'h' : 'disabled-item'" @click="s.id === 'energy' && openSuite(s.id)">
              <div class="hs-chip-top"><span class="hs-chip-ico"><i :class="s.icon"></i></span><span class="hs-chip-name">{{ s.short }}</span></div>
              <div class="hs-chip-metric">
                <template v-if="s.id === 'energy'">{{ currentStation.kwh }} {{ currentStation.kwhUnit || 'kWh' }} <span class="pill-mini h">{{ currentStation.kwhTrend === '--' ? '--' : currentStation.kwhTrend + '%' }}</span></template>
                <template v-else>-- <span class="pill-mini h">--</span></template>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div class="sec-title">
            <span>Suites opérationnelles</span>
            <span class="sec-r">Hub → Suite (L3)</span>
          </div>
          <div class="tiles-grid">
            <div v-for="s in SUITES.filter(s => s.id === 'energy')" :key="s.id" class="tile" :class="s.id === 'energy' ? '' : 'disabled-item'" @click="s.id === 'energy' && openSuite(s.id)">
              <div class="tile-h">
                <div class="tile-h-l">
                  <div class="tile-ico" :class="s.color"><i :class="s.icon"></i></div>
                  <div class="tile-titles">
                    <div class="tile-name">{{ s.name }}</div>
                    <div class="tile-ds">{{ s.ds }}</div>
                  </div>
                </div>
                <span v-if="s.federated" class="tile-fed">EMS</span>
              </div>
              <div class="tile-body">
                <div class="tile-kpi-grid">
                  <div v-for="(k, i) in getSuiteKPIs(s.id)" :key="i" class="tile-kpi">
                    <div class="tile-kpi-l">{{ k.l }}</div>
                    <div class="tile-kpi-v" :class="k.t">{{ k.v }}</div>
                    <div v-if="k.s" class="tile-kpi-s">{{ k.s }}</div>
                  </div>
                </div>
              </div>
              <div class="tile-foot">
                <div class="tile-foot-l">{{ s.useCases }} cas d'usage</div>
                <div class="tile-foot-r">Ouvrir la suite <i class="pi pi-arrow-right" style="margin-left: 4px; font-size: 10px;"></i></div>
              </div>
            </div>
          </div>
        </div>

      </div>

      <div class="col-right">

        <div class="card">
          <div class="card-h" style="padding: 10px 12px; border-bottom: 1px solid var(--br1); display: flex; justify-content: space-between; align-items: center; background: rgba(7,10,16,.4);">
            <div><h3 style="font-size: 12px; font-weight: 600;">Activité récente</h3><p style="font-size: 10px; color: var(--t3);">0 événements · dernières 24h</p></div>
            <button class="btn btn-s"><i class="pi pi-cog"></i></button>
          </div>
          <div class="card-body" style="padding: 12px; background: var(--b2); border-radius: 0 0 12px 12px;">
            <div class="feed">
              <div class="feed-empty">✓ Aucune activité dans les dernières 24h</div>
            </div>
          </div>
        </div>

        <div class="ctx" :class="{ 'collapsed': ctxCollapsed }" style="margin-top: 12px;">
          <div class="ctx-h" @click="ctxCollapsed = !ctxCollapsed">
            <strong>Contexte station</strong>
            <span class="ctx-h-x"><i class="pi pi-chevron-down"></i></span>
          </div>
          <div class="ctx-body">
            <div class="ctx-row"><span class="l">Manager</span><span class="v">{{ currentStation.manager }}</span></div>
            <div class="ctx-row"><span class="l">Téléphone</span><span class="v">{{ currentStation.phone }}</span></div>
            <div class="ctx-row"><span class="l">Horaires</span><span class="v">{{ currentStation.hours }}</span></div>
            <div class="ctx-row"><span class="l">Ouverte depuis</span><span class="v">{{ currentStation.openedYear }}</span></div>
            <div class="ctx-row"><span class="l">Connectivité</span><span class="connectivity-pill online">En Ligne</span></div>

            <div style="font-size:8.5px;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;font-weight:600;margin-top:4px">Équipement</div>
            <div class="ctx-eq">
              <div class="ctx-eq-c"><div class="ctx-eq-l">Pistolets</div><div class="ctx-eq-v">{{ currentStation.dispensers }}</div></div>
              <div class="ctx-eq-c"><div class="ctx-eq-l">Bornes EV</div><div class="ctx-eq-v">{{ currentStation.evChargers }}</div></div>
              <div class="ctx-eq-c"><div class="ctx-eq-l">Caméras</div><div class="ctx-eq-v">{{ currentStation.cameras }}</div></div>
            </div>

            <div style="font-size:8.5px;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;font-weight:600;margin-top:6px">Services</div>
            <div class="id-tags">
              <span class="id-tag">🛒 Boutique</span>
              <span class="id-tag">🍽 Restaurant</span>
              <span class="id-tag">🚿 Lavage auto</span>
              <span class="id-tag hl">⚡ EV Charging</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</div>
</template>

<style scoped>
.shell {
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
  --ams: rgba(255, 190, 92, 0.1);
  --am: #ffbe5c;
  --amb: rgba(255, 190, 92, 0.3);
  --rds: rgba(255, 110, 127, 0.1);
  --rd: #ff6e7f;
  --rdb: rgba(255, 110, 127, 0.3);
  --bl: #5e9dff;
  --bls: rgba(94, 157, 255, 0.1);
  --blb: rgba(94, 157, 255, 0.3);
  --pu: #b898f8;
  --pus: rgba(184, 152, 248, 0.1);
  --pub: rgba(184, 152, 248, 0.3);
  
  font-family: var(--fn);
  background: #070a10;
  color: var(--t1);
  height: 100vh;
  width: 100vw;
  display: flex;
  overflow: hidden;
}

/* Sidebar & Topbar (Same as GlobalView) */
.sb { width: 240px; background: var(--b2); border-right: 1px solid var(--br1); display: flex; flex-direction: column; }
.ct { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.topbar { height: 60px; border-bottom: 1px solid var(--br1); display: flex; align-items: center; justify-content: space-between; padding: 0 16px; background: rgba(7,10,16,.5); }

.sb-brand { padding: 20px 16px; display: flex; align-items: center; gap: 10px; cursor: pointer; }
.sb-logo { width: 32px; height: 32px; background: var(--rd); color: white; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 16px; }
.sb-brand strong { display: block; font-size: 14px; color: var(--t0); line-height: 1.2; }
.sb-brand small { font-size: 11px; color: var(--t3); text-transform: uppercase; letter-spacing: 0.05em; }

.sb-station { padding: 12px 16px; border-bottom: 1px solid var(--br1); background: rgba(0,0,0,0.1); }
.sb-station-t { font-size: 9px; color: var(--t3); text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; margin-bottom: 4px; }
.sb-station-n { font-size: 14px; color: var(--t0); font-weight: 600; line-height: 1.2; }
.sb-station-id { font-size: 10px; color: var(--t2); font-family: var(--mo); margin: 4px 0 8px 0; }
.sb-station-sw { font-size: 11px; color: var(--ac); cursor: pointer; font-weight: 500; display: flex; align-items: center; gap: 6px; }

.sb-nav { flex: 1; padding: 0 10px; overflow-y: auto; }
.sb-lbl { font-size: 10px; color: var(--t4); text-transform: uppercase; letter-spacing: 0.08em; margin: 16px 0 6px 10px; font-weight: 600; }
.sb-item { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px; cursor: pointer; color: var(--t2); font-size: 13px; font-weight: 500; transition: var(--tr); margin-bottom: 2px; }
.sb-item:hover { background: var(--b4); color: var(--t0); }
.sb-item.active { background: var(--acs); color: var(--ac); }
.sb-ico { width: 20px; text-align: center; font-size: 14px; }
.sb-bdg { margin-left: auto; background: var(--b4); padding: 2px 6px; border-radius: 12px; font-size: 10px; color: var(--t1); }
.sb-foot { padding: 16px; border-top: 1px solid var(--br1); font-size: 11px; color: var(--t3); display: flex; align-items: center; gap: 8px; }
.sb-dot { width: 6px; height: 6px; background: var(--ac); border-radius: 50%; box-shadow: 0 0 6px var(--ac); }

.tb-l { display: flex; align-items: center; gap: 12px; }
.tb-back { width: 32px; height: 32px; background: var(--b3); border: 1px solid var(--br1); border-radius: 8px; display: grid; place-items: center; cursor: pointer; color: var(--t2); transition: var(--tr); }
.tb-back:hover { background: var(--b4); color: var(--t0); }
.tb-bc { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.tb-bc-seg { color: var(--t2); cursor: pointer; font-weight: 500; }
.tb-bc-seg:hover { color: var(--t0); }
.tb-bc-sep { color: var(--t4); font-size: 10px; }
.tb-bc-seg.cur { color: var(--t0); font-weight: 600; cursor: default; }

.tb-search { display: flex; align-items: center; background: var(--b3); border: 1px solid var(--br1); padding: 6px 12px; border-radius: 20px; width: 300px; }
.tb-search input { background: transparent; border: none; color: var(--t1); font-size: 12px; outline: none; width: 100%; margin-left: 8px; }
.tb-r { display: flex; align-items: center; gap: 10px; }
.tb-btn { background: var(--b3); border: 1px solid var(--br1); color: var(--t2); padding: 6px 12px; border-radius: 6px; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: var(--tr); }
.tb-btn:hover { background: var(--b4); color: var(--t0); }
.tb-live { color: var(--ac); font-size: 11px; font-weight: bold; display: flex; align-items: center; gap: 6px; margin: 0 10px; }
.tb-live::before { content: ''; width: 6px; height: 6px; background: var(--ac); border-radius: 50%; box-shadow: 0 0 8px var(--ac); }
.tb-ico-btn { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: var(--b3); border-radius: 8px; cursor: pointer; border: 1px solid var(--br1); color: var(--t2); transition: var(--tr); }
.tb-ico-btn:hover { background: var(--b4); color: var(--t0); }

/* Main Hub Layout */
.main{flex:1;display:grid;grid-template-columns:1fr 340px;gap:16px;padding:16px;overflow:hidden;min-height:0}
.col-left{display:flex;flex-direction:column;gap:16px;overflow-y:auto;min-height:0;padding-right:4px}
.col-right{display:flex;flex-direction:column;gap:16px;overflow-y:auto;min-height:0;padding-right:4px}

.col-left::-webkit-scrollbar, .col-right::-webkit-scrollbar { width: 6px; }
.col-left::-webkit-scrollbar-track, .col-right::-webkit-scrollbar-track { background: transparent; }
.col-left::-webkit-scrollbar-thumb, .col-right::-webkit-scrollbar-thumb { background: var(--b4); border-radius: 4px; }

/* Identity Card */
.id-card{background:linear-gradient(135deg,var(--b2) 0%,var(--b3) 100%);border:1px solid var(--br2);border-radius:var(--rl);padding:20px 24px;box-shadow:var(--sh);position:relative;overflow:hidden}
.id-card::before{content:'';position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,var(--ac),var(--bl))}
.id-card.critical::before{background:linear-gradient(90deg,var(--rd),var(--am))}
.id-card.degraded::before{background:linear-gradient(90deg,var(--am),var(--bl))}
.id-grid{display:grid;grid-template-columns:1fr auto;gap:16px;align-items:flex-start}
.id-l{display:flex;align-items:flex-start;gap:16px;min-width:0}
.id-icon{width:64px;height:64px;border-radius:12px;background:linear-gradient(135deg,#e30613,#a00410);display:grid;place-items:center;font-size:32px;color: white; flex-shrink:0;box-shadow:0 4px 12px rgba(227,6,19,.3)}
.id-meta{min-width:0;flex:1}
.id-name{font-size:24px;font-weight:700;letter-spacing:-.02em;color:var(--t0);line-height:1.2;margin-bottom:6px}
.id-sub{font-size:12px;color:var(--t2);font-family:var(--mo);margin-bottom:12px}
.id-tags{display:flex;flex-wrap:wrap;gap:6px}
.id-tag{display:inline-flex;align-items:center;font-size:10px;padding:4px 10px;background:var(--b4);border:1px solid var(--br1);color:var(--t2);border-radius:99px;font-weight:500;letter-spacing:.02em}
.id-tag.hl{background:var(--bls);border-color:var(--blb);color:var(--bl)}
.id-r{display:flex;flex-direction:column;align-items:flex-end;gap:8px}
.id-state-l{font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;font-weight:600}
.pill { padding: 4px 12px; border-radius: 99px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
.pill.healthy { background: var(--acs); color: var(--ac); border: 1px solid var(--acb); }
.id-state-time{font-size:10px;color:var(--t3);font-family:var(--mo)}
.id-actions{display:flex;gap:8px;margin-top:10px}
.btn { background: var(--b3); border: 1px solid var(--br1); color: var(--t1); border-radius: 6px; cursor: pointer; transition: var(--tr); }
.btn-s { padding: 6px 12px; font-size: 11px; font-weight: 600; }
.btn:hover { background: var(--b4); }

/* Health Strip */
.sec-title{font-size:11px;color:var(--t3);text-transform:uppercase;letter-spacing:.08em;font-weight:600;padding:0 4px 4px;display:flex;align-items:center;justify-content:space-between}
.sec-title .sec-r{font-family:var(--mo);font-size:10px;color:var(--t4)}
.health-strip{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}
.hs-chip{background:var(--b2);border:1px solid var(--br1);border-radius:10px;padding:12px 14px;cursor:pointer;transition:var(--tr);position:relative;overflow:hidden; box-shadow: var(--sh);}
.hs-chip:hover{background:var(--b3);border-color:var(--br2);transform:translateY(-2px)}
.hs-chip::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px}
.hs-chip.h::before{background:var(--ac)}
.hs-chip.d::before{background:var(--am)}
.hs-chip.c::before{background:var(--rd)}
.hs-chip-top{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.hs-chip-ico{font-size:14px; color: var(--t2)}
.hs-chip-name{font-size:11px;color:var(--t3);text-transform:uppercase;letter-spacing:.05em;font-weight:600}
.hs-chip-metric{font-size:14px;color:var(--t0);font-weight:600;line-height:1.2; display: flex; align-items: center; justify-content: space-between;}
.pill-mini{display:inline-block;font-size:9px;padding:2px 8px;border-radius:99px;font-weight:600; margin-left: auto;}
.pill-mini.h{background:var(--acs);color:#72f5d4}
.pill-mini.d{background:var(--ams);color:#ffd699}
.pill-mini.c{background:var(--rds);color:#ffb3bb}

/* Tiles Grid */
.tiles-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
.tile{background:var(--b2);border:1px solid var(--br1);border-radius:var(--rl);overflow:hidden;cursor:pointer;transition:var(--tr);box-shadow:var(--sh);display:flex;flex-direction:column;position:relative}
.tile:hover{border-color:var(--br3);transform:translateY(-2px);box-shadow:0 8px 20px rgba(0,0,0,.3)}
.tile::after{content:'';position:absolute;top:0;right:0;width:80px;height:80px;background:radial-gradient(circle at top right,rgba(255,255,255,.04),transparent 70%);pointer-events:none}
.tile-h{padding:14px 16px;border-bottom:1px solid var(--br1);display:flex;align-items:flex-start;justify-content:space-between;gap:12px;background:rgba(7,10,16,.4)}
.tile-h-l{display:flex;align-items:center;gap:12px;min-width:0;flex:1}
.tile-ico{width:36px;height:36px;border-radius:8px;display:grid;place-items:center;font-size:16px;flex-shrink:0}
.tile-ico.bl{background:var(--bls);color:var(--bl);border:1px solid var(--blb)}
.tile-ico.rd{background:var(--rds);color:var(--rd);border:1px solid var(--rdb)}
.tile-ico.pu{background:var(--pus);color:var(--pu);border:1px solid var(--pub)}
.tile-ico.am{background:var(--ams);color:var(--am);border:1px solid var(--amb)}
.tile-ico.ac{background:var(--acs);color:var(--ac);border:1px solid var(--acb)}
.tile-titles{min-width:0;flex:1}
.tile-name{font-size:15px;font-weight:600;letter-spacing:-.01em;line-height:1.2;color:var(--t0)}
.tile-ds{font-size:11px;color:var(--t3);margin-top:2px;line-height:1.3}
.tile-fed{font-size:9px;padding:3px 8px;border-radius:99px;background:var(--pus);color:var(--pu);border:1px solid var(--pub);font-weight:600;text-transform:uppercase;letter-spacing:.04em;font-family:var(--mo)}
.tile-body{padding:14px 16px;flex:1}
.tile-kpi-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.tile-kpi{background:var(--b3);border:1px solid var(--br1);border-radius:8px;padding:10px 12px}
.tile-kpi-l{font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.05em;font-weight:600;margin-bottom:4px}
.tile-kpi-v{font-size:18px;color:var(--t0);font-weight:700;font-family:var(--mo);line-height:1;letter-spacing:-.02em}
.tile-kpi-v.r{color:var(--rd)} .tile-kpi-v.a{color:var(--am)} .tile-kpi-v.g{color:var(--ac)}
.tile-kpi-s{font-size:10px;color:var(--t3);margin-top:6px;font-family:var(--mo)}
.tile-foot{padding:12px 16px;border-top:1px solid var(--br1);display:flex;align-items:center;justify-content:space-between;background:rgba(7,10,16,.3)}
.tile-foot-l{font-size:11px;color:var(--t3);font-family:var(--mo)}
.tile-foot-r{color:var(--ac);font-size:12px;font-weight:600;display:flex;align-items:center;transition:var(--tr)}
.tile:hover .tile-foot-r{transform:translateX(3px)}

/* Right Column */
.feed-empty{padding:40px 0;text-align:center;color:var(--t3);font-size:12px}
.ctx{background:var(--b2);border:1px solid var(--br1);border-radius:var(--rl);overflow:hidden;box-shadow:var(--sh); transition: var(--tr);}
.ctx-h{padding:12px 16px;border-bottom:1px solid var(--br1);display:flex;align-items:center;justify-content:space-between;background:rgba(7,10,16,.4);cursor:pointer;user-select:none}
.ctx-h strong{font-size:13px;font-weight:600}
.ctx-h-x{color:var(--t3);font-size:12px;transition:var(--tr)}
.ctx.collapsed .ctx-h-x{transform:rotate(-90deg)}
.ctx-body{padding:16px;display:flex;flex-direction:column;gap:12px; transition: var(--tr);}
.ctx.collapsed .ctx-body{display:none}
.ctx-row{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px}
.ctx-row .l{color:var(--t3);font-weight:500}
.ctx-row .v{color:var(--t1);font-weight:500;font-family:var(--mo);text-align:right}
.ctx-eq{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:4px}
.ctx-eq-c{background:var(--b3);border:1px solid var(--br1);border-radius:8px;padding:8px 10px;text-align:center}
.ctx-eq-l{font-size:9px;color:var(--t3);text-transform:uppercase;letter-spacing:.04em;font-weight:600}
.ctx-eq-v{font-size:18px;color:var(--t0);font-weight:700;font-family:var(--mo);line-height:1;margin-top:4px}

.connectivity-pill{display:inline-flex;align-items:center;gap:6px;font-size:10px;padding:4px 10px;border-radius:99px;font-weight:600;text-transform:uppercase;letter-spacing:.05em}
.connectivity-pill.online{background:var(--acs);color:#72f5d4;border:1px solid var(--acb)}
.connectivity-pill::before{content:'';width:6px;height:6px;border-radius:50%; background:var(--ac);box-shadow:0 0 6px var(--ac)}

.disabled-item {
  opacity: 0.3;
  filter: grayscale(100%);
  cursor: not-allowed !important;
  pointer-events: none;
}
</style>

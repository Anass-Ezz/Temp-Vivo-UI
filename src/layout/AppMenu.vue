<script setup>
/**
 * @component AppMenu
 * @description UI Component for AppMenu.
 *
 */

import { ref, inject, computed } from 'vue';
import AppMenuItem from './AppMenuItem.vue';
import { config } from '@/config/config.js';
import { useRouter } from 'vue-router';
import { clearToken } from '@/utils/auth';
import { flush, track } from '@/services/activityLog';

const auth = inject('auth');
const router = useRouter();

const displayName = computed(() => {
    const user = auth?.user;
    if (!user) return 'User';
    return user.name || user.id || 'User';
});

const displayRole = computed(() => {
    return auth?.user?.globalRole || 'user';
});

const avatarLetter = computed(() => {
    return displayName.value.charAt(0).toUpperCase();
});

function goToAccount() {
    router.push('/account');
}

async function logout() {
    track('auth.logout', {
        category: 'audit',
        service: 'auth',
        result: 'success'
    });
    await flush();
    clearToken();
    if (auth) {
        auth.token = null;
        auth.user = null;
        auth.ready = true;
    }
    router.push('/auth/login');
}

var icons = {
    sun: 'M8 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6m0 1a4 4 0 1 0 0-8 4 4 0 0 0 0 8M8 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 0m0 13a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 13m8-5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5M3 8a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2A.5.5 0 0 1 3 8m10.657-5.657a.5.5 0 0 1 0 .707l-1.414 1.415a.5.5 0 1 1-.707-.708l1.414-1.414a.5.5 0 0 1 .707 0m-9.193 9.193a.5.5 0 0 1 0 .707L3.05 13.657a.5.5 0 0 1-.707-.707l1.414-1.414a.5.5 0 0 1 .707 0m9.193 2.121a.5.5 0 0 1-.707 0l-1.414-1.414a.5.5 0 0 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .707M4.464 4.465a.5.5 0 0 1-.707 0L2.343 3.05a.5.5 0 1 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .708',
    wind: 'M12.5 2A2.5 2.5 0 0 0 10 4.5a.5.5 0 0 1-1 0A3.5 3.5 0 1 1 12.5 8H.5a.5.5 0 0 1 0-1h12a2.5 2.5 0 0 0 0-5m-7 1a1 1 0 0 0-1 1 .5.5 0 0 1-1 0 2 2 0 1 1 2 2h-5a.5.5 0 0 1 0-1h5a1 1 0 0 0 0-2M0 9.5A.5.5 0 0 1 .5 9h10.042a3 3 0 1 1-3 3 .5.5 0 0 1 1 0 2 2 0 1 0 2-2H.5a.5.5 0 0 1-.5-.5',
    home: 'M8.354 1.146a.5.5 0 0 0-.708 0l-6 6A.5.5 0 0 0 1.5 7.5v7a.5.5 0 0 0 .5.5h4.5a.5.5 0 0 0 .5-.5v-4h2v4a.5.5 0 0 0 .5.5H14a.5.5 0 0 0 .5-.5v-7a.5.5 0 0 0-.146-.354L13 5.793V2.5a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v1.293zM2.5 14V7.707l5.5-5.5 5.5 5.5V14H10v-4a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5v4z',
    battery: 'M2 4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm10 1a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm4 3a1.5 1.5 0 0 1-1.5 1.5v-3A1.5 1.5 0 0 1 16 8',
    electricity: 'M11.251.068a.5.5 0 0 1 .227.58L9.677 6.5H13a.5.5 0 0 1 .364.843l-8 8.5a.5.5 0 0 1-.842-.49L6.323 9.5H3a.5.5 0 0 1-.364-.843l8-8.5a.5.5 0 0 1 .615-.09zM4.157 8.5H7a.5.5 0 0 1 .478.647L6.11 13.59l5.732-6.09H9a.5.5 0 0 1-.478-.647L9.89 2.41z',
    history: 'M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71z',
    plug: 'M6 0a.5.5 0 0 1 .5.5V3h3V.5a.5.5 0 0 1 1 0V3h1a.5.5 0 0 1 .5.5v3A3.5 3.5 0 0 1 8.5 10c-.002.434-.01.845-.04 1.22-.041.514-.126 1.003-.317 1.424a2.08 2.08 0 0 1-.97 1.028C6.725 13.9 6.169 14 5.5 14c-.998 0-1.61.33-1.974.718A1.92 1.92 0 0 0 3 16H2c0-.616.232-1.367.797-1.968C3.374 13.42 4.261 13 5.5 13c.581 0 .962-.088 1.218-.219.241-.123.4-.3.514-.55.121-.266.193-.621.23-1.09.027-.34.035-.718.037-1.141A3.5 3.5 0 0 1 4 6.5v-3a.5.5 0 0 1 .5-.5h1V.5A.5.5 0 0 1 6 0M5 4v2.5A2.5 2.5 0 0 0 7.5 9h1A2.5 2.5 0 0 0 11 6.5V4z',
    dolar: 'M4 10.781c.148 1.667 1.513 2.85 3.591 3.003V15h1.043v-1.216c2.27-.179 3.678-1.438 3.678-3.3 0-1.59-.947-2.51-2.956-3.028l-.722-.187V3.467c1.122.11 1.879.714 2.07 1.616h1.47c-.166-1.6-1.54-2.748-3.54-2.875V1H7.591v1.233c-1.939.23-3.27 1.472-3.27 3.156 0 1.454.966 2.483 2.661 2.917l.61.162v4.031c-1.149-.17-1.94-.8-2.131-1.718zm3.391-3.836c-1.043-.263-1.6-.825-1.6-1.616 0-.944.704-1.641 1.8-1.828v3.495l-.2-.05zm1.591 1.872c1.287.323 1.852.859 1.852 1.769 0 1.097-.826 1.828-2.2 1.939V8.73z',
    file: 'M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5zm-3 0A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5z',
    meter: 'M8 2.5A5.5 5.5 0 1 0 13.5 8a.5.5 0 0 1 1 0 6.5 6.5 0 1 1-6.5-6.5.5.5 0 0 1 0 1M7.5 3a.5.5 0 0 1 .5-.5A5.5 5.5 0 0 1 13.5 8a.5.5 0 0 1-1 0A4.5 4.5 0 0 0 8 3.5a.5.5 0 0 1-.5-.5M10 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0',
    settings: 'M9.405 1.05c-.413-1.4-2.397-1.4-2.81 0l-.1.34a1.464 1.464 0 0 1-2.105.872l-.31-.17c-1.283-.698-2.686.705-1.987 1.987l.169.311c.446.82.023 1.841-.872 2.105l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 0 1 .872 2.105l-.17.31c-.698 1.283.705 2.686 1.987 1.987l.311-.169a1.464 1.464 0 0 1 2.105.872l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 0 1 2.105-.872l.31.17c1.283.698 2.686-.705 1.987-1.987l-.169-.311a1.464 1.464 0 0 1 .872-2.105l.34-.1c1.4-.413 1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 0 1-.872-2.105l.17-.31c.698-1.283-.705-2.686-1.987-1.987l-.311.169a1.464 1.464 0 0 1-2.105-.872zM8 10.93a2.929 2.929 0 1 1 0-5.86 2.929 2.929 0 0 1 0 5.858z',
    support: 'M5.933.87a2.89 2.89 0 0 1 4.134 0l.622.638.89-.011a2.89 2.89 0 0 1 2.924 2.924l-.01.89.636.622a2.89 2.89 0 0 1 0 4.134l-.637.622.011.89a2.89 2.89 0 0 1-2.924 2.924l-.89-.01-.622.636a2.89 2.89 0 0 1-4.134 0l-.622-.637-.89.011a2.89 2.89 0 0 1-2.924-2.924l.01-.89-.636-.622a2.89 2.89 0 0 1 0-4.134l.637-.622-.011-.89a2.89 2.89 0 0 1 2.924-2.924l.89.01zM7.002 11a1 1 0 1 0 2 0 1 1 0 0 0-2 0m1.602-2.027c.04-.534.198-.815.846-1.26.674-.475 1.05-1.09 1.05-1.986 0-1.325-.92-2.227-2.262-2.227-1.02 0-1.792.492-2.1 1.29A1.7 1.7 0 0 0 6 5.48c0 .393.203.64.545.64.272 0 .455-.147.564-.51.158-.592.525-.915 1.074-.915.61 0 1.03.446 1.03 1.084 0 .563-.208.885-.822 1.325-.619.433-.926.914-.926 1.64v.111c0 .428.208.745.585.745.336 0 .504-.24.554-.627',
    flame: 'M8 16c3.314 0 6-2 6-5.5 0-1.5-.5-4-2.5-6 .25 1.5-1.25 2-1.25 2C11 4 9 .5 6 0c.357 2 .5 4-2 6-1.25 1-2 2.729-2 4.5C2 14 4.686 16 8 16m0-1c-1.657 0-3-1-3-2.75 0-.75.25-2 1.25-3C6.125 10 7 10.5 7 10.5c-.375-1.25.5-3.25 2-3.5-.179 1-.25 2 1 3 .625.5 1 1.364 1 2.25C11 14 9.657 15 8 15',
    drop: 'M8 16a6 6 0 0 0 6-6c0-1.655-1.122-2.904-2.432-4.362C10.254 4.176 8.75 2.503 8 0c0 0-6 5.686-6 10a6 6 0 0 0 6 6M6.646 4.646l.708.708c-.29.29-1.128 1.311-1.907 2.87l-.894-.448c.82-1.641 1.717-2.753 2.093-3.13',
    chat: 'M2.678 11.894a1 1 0 0 1 .287.801 11 11 0 0 1-.398 2c1.395-.323 2.247-.697 2.634-.893a1 1 0 0 1 .71-.074A8 8 0 0 0 8 14c3.996 0 7-2.807 7-6s-3.004-6-7-6-7 2.808-7 6c0 1.468.617 2.83 1.678 3.894m-.493 3.905a22 22 0 0 1-.713.129c-.2.032-.352-.176-.273-.362a10 10 0 0 0 .244-.637l.003-.01c.248-.72.45-1.548.524-2.319C.743 11.37 0 9.76 0 8c0-3.866 3.582-7 8-7s8 3.134 8 7-3.582 7-8 7a9 9 0 0 1-2.347-.306c-.52.263-1.639.742-3.468 1.105'
};

const model = computed(() => {
    const meterItems = config.meters.map((meter) => ({
        label: meter.fullReference,
        icon: icons['meter'],
        to: `/meters/${encodeURIComponent(meter.reference)}`
    }));

    return [
        {
            label: 'Monitoring',
            items: [
                { label: 'Overview', icon: icons['home'], to: '/dashboard' },
                { label: 'Unifilaire', icon: icons['plug'], to: '/unifilaire' }
            ]
        },
        {
            label: 'Devices',
            items: [
                {
                    label: 'Electricity Meters',
                    icon: icons['electricity'],
                    to: config.meters.length > 0 ? `/meters/${encodeURIComponent(config.meters[0].reference)}` : '/meters',
                    items: meterItems
                }
            ]
        },
        {
            label: 'Analysis',
            items: [
                { label: 'Alert History', icon: icons['history'], to: '/alert-history' }
            ]
        },
        {
            label: 'AI Assistant',
            items: [
                { label: 'Chat with your Building', icon: icons['chat'], to: '/ai-assistant' }
            ]
        },
        {
            label: 'Resources',
            items: [
                { label: 'Support', icon: icons['support'], to: '/support' }
            ]
        }
    ];
});

</script>

<template>
    <div class="layout-menu-container">
        <ul class="layout-menu">
            <template v-for="(item, i) in model" :key="item">
                <app-menu-item v-if="!item.separator" :item="item" :index="i"></app-menu-item>
                <li v-if="item.separator" class="menu-separator"></li>
            </template>
        </ul>

        <!-- Account section at bottom -->
        <div class="menu-account-section">
            <div class="menu-account-divider"></div>
            <div class="menu-account-card" @click="goToAccount" role="button" tabindex="0" id="menu-account-profile">
                <div class="menu-account-avatar">{{ avatarLetter }}</div>
                <div class="menu-account-info">
                    <span class="menu-account-name">{{ displayName }}</span>
                    <span class="menu-account-role">{{ displayRole.charAt(0).toUpperCase() + displayRole.slice(1) }}</span>
                </div>
                <button class="menu-logout-btn" @click.stop="logout" title="Log Out" id="menu-logout">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5-5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
                    </svg>
                </button>
            </div>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.layout-menu-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
}

.layout-menu {
    flex: 1;
    overflow-y: auto;
}

/* ── Account section ── */
.menu-account-section {
    flex-shrink: 0;
    padding: 0 0.5rem 0.75rem;
}

.menu-account-divider {
    height: 1px;
    background: rgba(255,255,255,0.06);
    margin-bottom: 0.75rem;
}

.menu-account-card {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    padding: 0.6rem 0.75rem;
    border-radius: 12px;
    background: rgba(99,102,241,0.07);
    border: 1px solid rgba(99,102,241,0.15);
    cursor: pointer;
    transition: all 0.2s;
    user-select: none;
}

.menu-account-card:hover {
    background: rgba(99,102,241,0.14);
    border-color: rgba(99,102,241,0.35);
}

.menu-account-avatar {
    width: 34px;
    height: 34px;
    border-radius: 10px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9rem;
    font-weight: 800;
    color: #fff;
    flex-shrink: 0;
}

.menu-account-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    gap: 1px;
}

.menu-account-name {
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--text-color, #f1f5f9);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.menu-account-role {
    font-size: 0.68rem;
    color: #a5b4fc;
    font-weight: 600;
}

.menu-logout-btn {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: rgba(239,68,68,0.1);
    border: 1px solid rgba(239,68,68,0.2);
    color: #fca5a5;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.2s;
    padding: 0;
}

.menu-logout-btn:hover {
    background: rgba(239,68,68,0.2);
    border-color: rgba(239,68,68,0.4);
    color: #ef4444;
}

.menu-logout-btn svg {
    width: 15px;
    height: 15px;
}
</style>

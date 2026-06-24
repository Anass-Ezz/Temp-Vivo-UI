<script setup>
/**
 * @component AccountPage
 * @description UI Component for AccountPage.
 *
 */

import { ref, inject, computed } from 'vue';
import ChangePasswordModal from './ChangePasswordModal.vue';

const auth = inject('auth');

const showChangePassword = ref(false);

const displayName = computed(() => auth.user?.name || 'User');
const displayEmail = computed(() => auth.user?.id || '—');
const displayRole  = computed(() => auth.user?.globalRole || '—');
const avatarLetter = computed(() => displayName.value.charAt(0).toUpperCase());
</script>

<template>
    <div class="account-page">
        <div class="acc-header">
            <h1>My Account</h1>
            <p>Profile and security</p>
        </div>

        <div class="acc-grid">
            <!-- Profile card -->
            <div class="acc-card">
                <div class="acc-avatar">{{ avatarLetter }}</div>
                <div class="acc-name">{{ displayName }}</div>
                <div class="acc-email">{{ displayEmail }}</div>

                <span class="acc-role-badge">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>
                    {{ displayRole.charAt(0).toUpperCase() + displayRole.slice(1) }}
                </span>
            </div>

            <!-- Info & Security -->
            <div class="acc-right">
                <div class="acc-section">
                    <h2>Account Details</h2>
                    <div class="acc-rows">
                        <div class="acc-row">
                            <span class="acc-row-label">Name</span>
                            <span class="acc-row-value">{{ displayName }}</span>
                        </div>
                        <div class="acc-row">
                            <span class="acc-row-label">Email</span>
                            <span class="acc-row-value">{{ displayEmail }}</span>
                        </div>
                        <div class="acc-row">
                            <span class="acc-row-label">Role</span>
                            <span class="acc-row-value">{{ displayRole.charAt(0).toUpperCase() + displayRole.slice(1) }}</span>
                        </div>
                    </div>
                </div>

                <div class="acc-section">
                    <h2>Security</h2>
                    <div class="acc-security-row">
                        <div>
                            <div class="acc-security-title">Password</div>
                            <div class="acc-security-sub">Change your login password</div>
                        </div>
                        <button class="acc-change-btn" @click="showChangePassword = true" id="open-change-password">
                            Change Password
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <ChangePasswordModal v-if="showChangePassword" @close="showChangePassword = false" />
    </div>
</template>

<style scoped>
.account-page {
    padding: 1.5rem 2rem;
    color: var(--text-color);
}

/* Header */
.acc-header { margin-bottom: 1.5rem; }
.acc-header h1 {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-color);
    margin: 0 0 2px;
}
.acc-header p {
    font-size: 0.82rem;
    color: var(--text-color-secondary);
    margin: 0;
}

/* Grid */
.acc-grid {
    display: grid;
    grid-template-columns: 240px 1fr;
    gap: 1.25rem;
    align-items: start;
}
@media (max-width: 860px) {
    .acc-grid { grid-template-columns: 1fr; }
}

/* Shared card */
.acc-card, .acc-section {
    background: var(--surface-card);
    border: 1px solid var(--surface-border);
    border-radius: 12px;
    padding: 1.5rem;
}

/* Profile card */
.acc-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.6rem;
    text-align: center;
}

.acc-avatar {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.75rem;
    font-weight: 800;
    color: #fff;
    margin-bottom: 0.25rem;
}

.acc-name {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-color);
}
.acc-email {
    font-size: 0.78rem;
    color: var(--text-color-secondary);
}

.acc-role-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.3rem 0.75rem;
    border-radius: 999px;
    background: rgba(99,102,241,0.12);
    border: 1px solid rgba(99,102,241,0.3);
    color: #a5b4fc;
    font-size: 0.73rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}
.acc-role-badge svg { width: 12px; height: 12px; }

/* Right column */
.acc-right {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
}

.acc-section h2 {
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--text-color-secondary);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin: 0 0 1rem;
}

/* Detail rows */
.acc-rows { display: flex; flex-direction: column; }

.acc-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.65rem 0;
    border-bottom: 1px solid var(--surface-border);
}
.acc-row:last-child { border-bottom: none; }

.acc-row-label {
    font-size: 0.82rem;
    color: var(--text-color-secondary);
}
.acc-row-value {
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--text-color);
}

/* Skeleton */
.acc-skeleton {
    height: 38px;
    border-radius: 8px;
    margin-bottom: 4px;
    background: linear-gradient(90deg, var(--surface-border) 25%, var(--surface-hover) 50%, var(--surface-border) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
}
@keyframes shimmer { to { background-position: -200% 0; } }

/* Security row */
.acc-security-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
}
.acc-security-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-color);
    margin-bottom: 2px;
}
.acc-security-sub {
    font-size: 0.78rem;
    color: var(--text-color-secondary);
}

.acc-change-btn {
    padding: 0.5rem 1rem;
    border: 1px solid rgba(99,102,241,0.4);
    border-radius: 8px;
    background: rgba(99,102,241,0.1);
    color: #a5b4fc;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
    transition: all 0.2s;
}
.acc-change-btn:hover {
    background: rgba(99,102,241,0.2);
    border-color: rgba(99,102,241,0.6);
    color: #c7d2fe;
}

/* Loading / Error */
.acc-loading {
    display: flex;
    justify-content: center;
    padding: 2rem 0;
}
.acc-spinner {
    width: 32px; height: 32px;
    border: 3px solid rgba(99,102,241,0.2);
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.acc-error {
    font-size: 0.78rem;
    color: #fca5a5;
    background: rgba(239,68,68,0.1);
    border: 1px solid rgba(239,68,68,0.2);
    border-radius: 8px;
    padding: 0.5rem 0.75rem;
    width: 100%;
}
</style>

<script setup>
/**
 * @component ChangePasswordModal
 * @description UI Component for ChangePasswordModal.
 *
 * @emits {string} close - Emitted event
 */

import { ref, computed, inject } from 'vue';
import { useRouter } from 'vue-router';
import { sendWsRpc } from '@/utils/wsRpc';
import { clearToken } from '@/utils/auth';

const emit = defineEmits(['close']);
const ws = inject('ws');
const auth = inject('auth');
const router = useRouter();

// Form state
const oldPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const showOld = ref(false);
const showNew = ref(false);
const showConfirm = ref(false);

// UI state
const loading = ref(false);
const errorMsg = ref('');
const step = ref('form'); // 'form' | 'success'
const countdown = ref(5);

// Validation
const passwordStrength = computed(() => {
    const p = newPassword.value;
    if (!p) return 0;
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    return score;
});

const strengthLabel = computed(() => {
    const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
    return labels[passwordStrength.value] || '';
});

const strengthColor = computed(() => {
    const colors = ['', '#ef4444', '#f59e0b', '#3b82f6', '#22c55e'];
    return colors[passwordStrength.value] || '#e5e7eb';
});

const passwordsMatch = computed(() =>
    confirmPassword.value === '' || newPassword.value === confirmPassword.value
);

const canSubmit = computed(() =>
    oldPassword.value.length >= 1 &&
    newPassword.value.length >= 8 &&
    passwordsMatch.value &&
    confirmPassword.value.length > 0 &&
    passwordStrength.value >= 2
);

async function submit() {
    if (!canSubmit.value) return;
    loading.value = true;
    errorMsg.value = '';

    try {
        await sendWsRpc(ws, 'changeUserPassword', {
            oldPassword: oldPassword.value,
            newPassword: newPassword.value
        });

        // Success flow
        step.value = 'success';
        startCountdown();
    } catch (err) {
        errorMsg.value = err.message || 'Failed to change password. Please try again.';
    } finally {
        loading.value = false;
    }
}

function startCountdown() {
    countdown.value = 5;
    const interval = setInterval(() => {
        countdown.value--;
        if (countdown.value <= 0) {
            clearInterval(interval);
            doLogout();
        }
    }, 1000);
}

function doLogout() {
    clearToken();
    auth.token = null;
    auth.user = null;
    auth.ready = true;
    router.push('/auth/login');
}
</script>

<template>
    <Teleport to="body">
        <div class="cp-backdrop" @click.self="emit('close')">
            <div class="cp-modal">
                <!-- ─── Header ─── -->
                <div class="cp-header">
                    <div class="cp-header-icon">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
                        </svg>
                    </div>
                    <div>
                        <h2>Change Password</h2>
                        <p>Update your account security credentials</p>
                    </div>
                    <button class="cp-close" @click="emit('close')" aria-label="Close">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                    </button>
                </div>

                <!-- ─── Form ─── -->
                <transition name="fade-slide" mode="out-in">
                    <div v-if="step === 'form'" key="form" class="cp-body">
                        <div class="cp-field">
                            <label>Current Password</label>
                            <div class="cp-input-wrap">
                                <svg class="cp-input-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
                                <input
                                    id="old-password"
                                    v-model="oldPassword"
                                    :type="showOld ? 'text' : 'password'"
                                    placeholder="Enter current password"
                                    autocomplete="current-password"
                                />
                                <button class="cp-toggle" type="button" @click="showOld = !showOld" :aria-label="showOld ? 'Hide' : 'Show'">
                                    <svg v-if="!showOld" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                                    <svg v-else viewBox="0 0 24 24" fill="currentColor"><path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/></svg>
                                </button>
                            </div>
                        </div>

                        <div class="cp-field">
                            <label>New Password</label>
                            <div class="cp-input-wrap">
                                <svg class="cp-input-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg>
                                <input
                                    id="new-password"
                                    v-model="newPassword"
                                    :type="showNew ? 'text' : 'password'"
                                    placeholder="At least 8 characters"
                                    autocomplete="new-password"
                                />
                                <button class="cp-toggle" type="button" @click="showNew = !showNew">
                                    <svg v-if="!showNew" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                                    <svg v-else viewBox="0 0 24 24" fill="currentColor"><path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/></svg>
                                </button>
                            </div>
                            <!-- Strength meter -->
                            <div class="cp-strength" v-if="newPassword">
                                <div class="cp-strength-bars">
                                    <span v-for="i in 4" :key="i" class="cp-strength-bar"
                                        :style="{ background: i <= passwordStrength ? strengthColor : '#2a2a3e' }"></span>
                                </div>
                                <span class="cp-strength-label" :style="{ color: strengthColor }">{{ strengthLabel }}</span>
                            </div>
                        </div>

                        <div class="cp-field">
                            <label>Confirm New Password</label>
                            <div class="cp-input-wrap" :class="{ 'cp-input-error': confirmPassword && !passwordsMatch }">
                                <svg class="cp-input-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
                                <input
                                    id="confirm-password"
                                    v-model="confirmPassword"
                                    :type="showConfirm ? 'text' : 'password'"
                                    placeholder="Repeat new password"
                                    autocomplete="new-password"
                                />
                                <button class="cp-toggle" type="button" @click="showConfirm = !showConfirm">
                                    <svg v-if="!showConfirm" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                                    <svg v-else viewBox="0 0 24 24" fill="currentColor"><path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/></svg>
                                </button>
                            </div>
                            <span v-if="confirmPassword && !passwordsMatch" class="cp-validation-msg">Passwords do not match</span>
                        </div>

                        <div v-if="errorMsg" class="cp-error-banner">
                            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                            {{ errorMsg }}
                        </div>

                        <div class="cp-footer">
                            <button class="cp-btn-secondary" @click="emit('close')" :disabled="loading">Cancel</button>
                            <button class="cp-btn-primary" @click="submit" :disabled="!canSubmit || loading" id="change-password-submit">
                                <svg v-if="loading" class="cp-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                                    <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
                                    <path d="M12 2a10 10 0 0 1 10 10" class="cp-spin-arc"/>
                                </svg>
                                <span>{{ loading ? 'Changing…' : 'Change Password' }}</span>
                            </button>
                        </div>
                    </div>

                    <!-- ─── Success ─── -->
                    <div v-else key="success" class="cp-success">
                        <div class="cp-success-icon">
                            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                        </div>
                        <h3>Password Changed!</h3>
                        <p>Your password has been updated successfully.</p>
                        <p class="cp-countdown">You will be logged out in <strong>{{ countdown }}</strong> second{{ countdown !== 1 ? 's' : '' }}…</p>
                        <button class="cp-btn-primary" @click="doLogout" id="change-password-logout-now">Log Out Now</button>
                    </div>
                </transition>
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
/* ── Backdrop ── */
.cp-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.65);
    backdrop-filter: blur(6px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 1rem;
}

/* ── Modal ── */
.cp-modal {
    background: #12121f;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 20px;
    width: 100%;
    max-width: 480px;
    box-shadow: 0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.15);
    overflow: hidden;
    animation: cp-slide-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes cp-slide-in {
    from { opacity: 0; transform: translate(-50%, -50%) scale(0.88); }
}

/* ── Header ── */
.cp-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.5rem;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    border-bottom: 1px solid rgba(255,255,255,0.06);
}

.cp-header-icon {
    width: 42px;
    height: 42px;
    border-radius: 12px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.cp-header-icon svg { width: 20px; height: 20px; color: #fff; }

.cp-header h2 {
    font-size: 1.1rem;
    font-weight: 700;
    color: #f1f5f9;
    margin: 0 0 2px;
}

.cp-header p {
    font-size: 0.78rem;
    color: #64748b;
    margin: 0;
}

.cp-close {
    margin-left: auto;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: #94a3b8;
    transition: all 0.2s;
    flex-shrink: 0;
}
.cp-close:hover { background: rgba(239,68,68,0.15); color: #ef4444; border-color: rgba(239,68,68,0.3); }
.cp-close svg { width: 16px; height: 16px; }

/* ── Body ── */
.cp-body { padding: 1.5rem; display: flex; flex-direction: column; gap: 1.25rem; }

/* ── Field ── */
.cp-field { display: flex; flex-direction: column; gap: 0.4rem; }

.cp-field label {
    font-size: 0.8rem;
    font-weight: 600;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.cp-input-wrap {
    position: relative;
    display: flex;
    align-items: center;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 10px;
    transition: border-color 0.2s, box-shadow 0.2s;
}
.cp-input-wrap:focus-within {
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99,102,241,0.15);
}
.cp-input-wrap.cp-input-error {
    border-color: #ef4444;
    box-shadow: 0 0 0 3px rgba(239,68,68,0.15);
}

.cp-input-icon {
    width: 16px;
    height: 16px;
    color: #475569;
    flex-shrink: 0;
    margin-left: 0.875rem;
}

.cp-input-wrap input {
    flex: 1;
    background: none;
    border: none;
    outline: none;
    padding: 0.75rem 0.5rem;
    color: #f1f5f9;
    font-size: 0.9rem;
    font-family: inherit;
}
.cp-input-wrap input::placeholder { color: #334155; }

.cp-toggle {
    background: none;
    border: none;
    cursor: pointer;
    color: #475569;
    padding: 0.5rem 0.875rem;
    display: flex;
    align-items: center;
    transition: color 0.2s;
    flex-shrink: 0;
}
.cp-toggle:hover { color: #94a3b8; }
.cp-toggle svg { width: 18px; height: 18px; }

.cp-validation-msg { font-size: 0.75rem; color: #ef4444; }

/* ── Strength ── */
.cp-strength { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.25rem; }

.cp-strength-bars { display: flex; gap: 4px; flex: 1; }

.cp-strength-bar {
    height: 3px;
    border-radius: 2px;
    flex: 1;
    transition: background 0.3s;
}

.cp-strength-label { font-size: 0.73rem; font-weight: 600; min-width: 40px; text-align: right; }

/* ── Error banner ── */
.cp-error-banner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: rgba(239,68,68,0.12);
    border: 1px solid rgba(239,68,68,0.25);
    border-radius: 10px;
    color: #fca5a5;
    font-size: 0.85rem;
}
.cp-error-banner svg { width: 18px; height: 18px; flex-shrink: 0; }

/* ── Footer ── */
.cp-footer {
    display: flex;
    gap: 0.75rem;
    padding-top: 0.5rem;
}

.cp-btn-secondary {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 10px;
    background: rgba(255,255,255,0.04);
    color: #94a3b8;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    font-family: inherit;
}
.cp-btn-secondary:hover:not(:disabled) { background: rgba(255,255,255,0.08); color: #f1f5f9; }

.cp-btn-primary {
    flex: 1;
    padding: 0.75rem;
    border: none;
    border-radius: 10px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: #fff;
    font-size: 0.9rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    font-family: inherit;
}
.cp-btn-primary:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(99,102,241,0.35); }
.cp-btn-primary:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }

/* Spinner */
.cp-spinner { width: 16px; height: 16px; animation: cp-rotate 1s linear infinite; }
.cp-spin-arc { stroke: #fff; stroke-dasharray: 40; stroke-dashoffset: 10; }
@keyframes cp-rotate { to { transform: rotate(360deg); } }

/* ── Success ── */
.cp-success {
    padding: 2.5rem 1.5rem;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
}

.cp-success-icon {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: linear-gradient(135deg, #22c55e, #16a34a);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 0.5rem;
    animation: cp-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.cp-success-icon svg { width: 38px; height: 38px; color: #fff; }

@keyframes cp-pop {
    from { transform: scale(0); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
}

.cp-success h3 { font-size: 1.4rem; font-weight: 700; color: #f1f5f9; margin: 0; }
.cp-success p { color: #64748b; font-size: 0.9rem; margin: 0; }
.cp-countdown { color: #94a3b8 !important; font-size: 0.85rem !important; }
.cp-countdown strong { color: #6366f1; }

/* ── Transitions ── */
.fade-slide-enter-active, .fade-slide-leave-active { transition: all 0.22s ease; }
.fade-slide-enter-from { opacity: 0; transform: translateX(20px); }
.fade-slide-leave-to { opacity: 0; transform: translateX(-20px); }
</style>

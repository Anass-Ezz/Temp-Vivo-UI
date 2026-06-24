import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { config } from '@/config/config.js';
import { useInfrastructureConfigStore } from '@/store/infrastructureConfig';

/**
 * @typedef {Object} TenantStoreInterface
 * @property {Ref<Array>} tenants - Reactive list of available tenant configurations.
 * @property {Ref<string|null>} selectedTenantId - Active tenant identifier reference.
 * @property {ComputedRef<Object|null>} selectedTenant - Resolved tenant summary payload.
 * @property {ComputedRef<Array<string>>} tenantEdges - All Edge IDs belonging to the active tenant.
 * @property {ComputedRef<Array>} selectedHierarchy - Electrical node hierarchy for the tenant.
 * @property {Function} setTenant - Action to update the active session tenant context.
 */

/**
 * Manages the multi-tenant context for the UI.
 *
 * @returns {TenantStoreInterface} Structured store object containing the active tenant variables.
 */
export const useTenantStore = defineStore('tenant', () => {
    const infraConfig = useInfrastructureConfigStore();

    // State — initialised from whatever is in config right now
    // (static defaults on first load, then updated when the remote config arrives)
    const tenants         = ref(config.tenants || []);
    const selectedTenantId = ref(tenants.value.length > 0 ? tenants.value[0].id : null);

    // Whenever the remote config becomes ready, refresh the tenant list so that
    // components which already have a store reference get the live data.
    watch(
        () => infraConfig.ready,
        (isReady) => {
            if (!isReady) return;
            tenants.value = config.tenants || [];
            // Keep the previous selection if it still exists, otherwise pick the first
            const stillValid = tenants.value.some(t => t.id === selectedTenantId.value);
            if (!stillValid) {
                selectedTenantId.value = tenants.value.length > 0 ? tenants.value[0].id : null;
            }
        }
    );

    // Getters
    const selectedTenant = computed(() => {
        return tenants.value.find(t => t.id === selectedTenantId.value) || null;
    });

    const tenantEdges = computed(() => {
        return selectedTenant.value ? selectedTenant.value.edges : [];
    });

    const selectedHierarchy = computed(() => {
        return selectedTenant.value ? selectedTenant.value.hierarchy || [] : [];
    });

    // Actions
    function setTenant(id) {
        selectedTenantId.value = id;
    }

    return {
        tenants,
        selectedTenantId,
        selectedTenant,
        tenantEdges,
        selectedHierarchy,
        setTenant
    };
});

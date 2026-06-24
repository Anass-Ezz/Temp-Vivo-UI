import { reactive } from 'vue';

/**
 * Infrastructure Configuration (EMS Hierarchy, Meters, Tenants, etc.)
 *
 * This object is strictly populated from the OpenEMS backend at application startup.
 * No local fallback is provided. If the backend fails to provide this configuration,
 * the application will remain on the loading/error screen.
 */
export const config = reactive({
    edges: [],
    tenants: [],
    meters: [],
    meterClusters: [],
    
    // System-wide metadata (Can also be overridden by backend if provided)
    meterChannels: {
        activeEnergyChannel: { name: 'ActiveConsumptionEnergy', unit: 'Wh' },
        activeEnergyCostChannel: { name: 'ActiveConsumptionEnergyCost', unit: 'MAD' },
        activeEnergyEmissionsChannel: { name: 'ActiveConsumptionEnergyEmissions', unit: 'kg' },
        activePowerChannel: { name: 'ActivePower', unit: 'W' },
        reactivePowerChannel: { name: 'ReactivePower', unit: 'VAR' },
        apparentPowerChannel: { name: 'ApparentPower', unit: 'VAR' },
        powerFactorChannel:             { name: 'PowerFactor',                       unit: 'PF'   },
        frequencyChannel: { name: 'Frequency', unit: 'mHz' },
        voltageChannel: { name: 'Voltage', unit: 'mV' },
        voltageL1Channel: { name: 'VoltageL1', unit: 'mV' },
        voltageL2Channel: { name: 'VoltageL2', unit: 'mV' },
        voltageL3Channel: { name: 'VoltageL3', unit: 'mV' },
        currentChannel: { name: 'Current', unit: 'mA' },
        currentL1Channel: { name: 'CurrentL1', unit: 'mA' },
        currentL2Channel: { name: 'CurrentL2', unit: 'mA' },
        currentL3Channel: { name: 'CurrentL3', unit: 'mA' },
    },
    factories:{
        electricityMeter : ["Meter.Socomec.Digiware.Iac", "Meter.Cluster"],
    },
});
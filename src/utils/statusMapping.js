/**
 * Mapping between Alarm channels (StateChannels) and the Value channels they affect.
 * 
 * If an alarm in the 'alarms' list is active, the corresponding 'affectedValues' 
 * will be visually flagged (e.g., turned Red).
 */
export const statusMapping = {
    // Meter-specific threshold mappings
    meter: {
        'HighPower': {
            affectedChannels: ['ActivePower'],
            severity: 'WARNING'
        },
        'OverDailyEnergyLimit': {
            affectedChannels: ['ActiveConsumptionEnergy', 'ActiveConsumptionEnergyCost'],
            severity: 'WARNING'
        },
        'ModbusCommunicationFailure': {
            affectedChannels: ['*'], // '*' means all channels for this component turn red/fault
            severity: 'FAULT'
        }
    },
    
    // Global or generic component mappings
    generic: {
        'State': {
            affectedChannels: ['*'],
            severity: 'DEPENDENT' // Severity depends on the State value (1, 2, 3...)
        }
    }
};

/**
 * Returns a list of alarm channel IDs that could affect a specific value channel.
 * @param {string} componentType - e.g., 'meter'
 * @param {string} valueChannelName - e.g., 'ActivePower'
 */
export function getRelatedAlarms(componentType, valueChannelName) {
    const typeMapping = statusMapping[componentType] || {};
    const related = [];

    for (const [alarmId, config] of Object.entries(typeMapping)) {
        if (config.affectedChannels.includes('*') || config.affectedChannels.includes(valueChannelName)) {
            related.push(alarmId);
        }
    }

    return related;
}

// Constants for Discord Alerts
// This file is loaded before contentScript.js

const DISCORD_ALERT_CONFIG = {
    // Check Interval (in ms)
    // How often to scan for new messages
    CHECK_INTERVAL_MS: 5000,

    // Time restrictions (if enabled)
    ENABLE_TIME_RESTRICTIONS: false,

    // Debug logging
    DEBUG_PRINT: true,

    // Strings to skip when checking for queues
    SKIP_STRINGS: [
        'plush is up at target'
    ]
};

console.log('[Discord Alert] Constants loaded:', DISCORD_ALERT_CONFIG);

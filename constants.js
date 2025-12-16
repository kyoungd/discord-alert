// Constants for Discord Alerts
// This file is loaded before contentScript.js

const DISCORD_ALERT_CONFIG = {
    // Auto-open URLs when queue detected
    AUTO_OPEN_ENABLED: true,
    POKEMON_CENTER_URL: 'https://pokemoncenter.com',

    // Check Interval (in ms)
    // How often to scan for new messages
    CHECK_INTERVAL_MS: 5000,

    // Initial Grace Period (in ms)
    // Ignore all alerts during this period after startup (lets Discord fully load)
    INITIAL_GRACE_PERIOD_MS: 20000, // 20 seconds

    // Alert Debounce (in ms)
    // Minimum time between alerts to prevent spam
    ALERT_DEBOUNCE_MS: 30000, // 30 seconds

    // Verbose Logging Duration (in ms)
    // How long to show detailed scan logs after startup (then switches to quiet mode)
    VERBOSE_LOGGING_DURATION_MS: 60000, // 60 seconds = 1 minute

    // Pulse Interval (in ms)
    // How often to show a heartbeat icon in quiet mode
    PULSE_INTERVAL_MS: 300000, // 5 minutes

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

# Discord Alerts

Chrome extension that monitors Discord channels for Pokemon queue alerts and plays audio notifications.

## Features

- Monitors any `discord.com/channels/*` page for new messages
- Detects queue keywords: Pokemon Center, Costco, Target
- **Auto-opens product URLs** for Pokemon Center and Costco queues
- Plays audio alert when queue is detected
- Works on multiple Discord tabs simultaneously
- Toggle on/off via popup

## Installation

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select this folder
4. Open a Discord channel and enable audio alerts when prompted

## Configuration

Edit `constants.js` to customize:

| Setting | Default | Description |
|---------|---------|-------------|
| `AUTO_OPEN_ENABLED` | true | Auto-open URLs on queue detection |
| `POKEMON_CENTER_URL` | pokemoncenter.com | URL to open for Pokemon Center |
| `CHECK_INTERVAL_MS` | 5000 | Scan frequency (ms) |
| `INITIAL_GRACE_PERIOD_MS` | 20000 | Ignore alerts at startup (ms) |
| `ALERT_DEBOUNCE_MS` | 30000 | Min time between alerts (ms) |
| `SKIP_STRINGS` | [...] | Keywords to ignore |

## How It Works

1. Scans for new Discord messages every 5 seconds
2. Uses Snowflake ID threshold to ignore old messages
3. Checks embed content for queue keywords
4. **Pokemon Center/Costco**: Opens URL in new tab, then plays alarm
5. **Target/Others**: Plays alarm only

## Auto-Open Behavior

| Queue Type | Action |
|------------|--------|
| Pokemon Center | Opens `pokemoncenter.com` + alarm |
| Costco | Extracts product link (skips membership links) + alarm |
| Target | Alarm only |

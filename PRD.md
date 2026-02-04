# Product Requirements Document: Discord Alerts

## Overview

A Chrome extension that monitors Discord channels for Pokemon product queue and restock alerts, playing audio notifications and optionally auto-opening product URLs.

## Problem Statement

Pokemon product releases (cards, plush, etc.) sell out within seconds. Collectors rely on Discord alert channels to know when products become available. Missing an alert by even a few seconds means missing the product. Manual monitoring is impractical 24/7.

## Goals

1. **Never miss an alert** - Detect queue/restock messages instantly
2. **Immediate notification** - Play audio alert to grab attention
3. **Fast action** - Auto-open product URLs to save precious seconds
4. **Reliability** - Work in background tabs without throttling
5. **Low friction** - Minimal setup, works out of the box

## Target Users

- Pokemon card/product collectors
- Resellers monitoring restocks
- Anyone tracking limited product drops via Discord

## Features

### Core Features (Implemented)

| Feature | Description |
|---------|-------------|
| Message Monitoring | Scans Discord channels for new messages using Snowflake ID tracking |
| Queue Detection | Detects "queue" keywords for Pokemon Center, Costco, Target |
| Restock Detection | Detects "Item Restocked" / "New Item" from Pokemon Restocks and Alerts channel |
| Audio Alerts | Plays alert.mp3 when trigger detected |
| Multi-tab Support | Works on multiple Discord tabs simultaneously |
| Service Worker Driven | Bypasses browser throttling for background tabs |
| Grace Period | Ignores alerts during startup while Discord loads existing messages |
| Debouncing | Prevents alert spam with configurable cooldown |
| Skip Strings | Configurable keywords to ignore (false positives) |

### Retailer Support

| Retailer | Detection Method | Action |
|----------|------------------|--------|
| Pokemon Center | "pokemon center queue/security" or restock alert | Audio alert |
| Costco | "costco queue" or restock alert | Audio alert |
| Target | mavely.app.link, target.com/p, "up at target", or restock alert | Audio alert |
| Walmart | Restock alert with "walmart" | Audio alert |
| Best Buy | Restock alert with "best buy" | Audio alert |

### Configuration Options

| Setting | Default | Description |
|---------|---------|-------------|
| CHECK_INTERVAL_MS | 10000 | Scan frequency (ms) |
| INITIAL_GRACE_PERIOD_MS | 20000 | Ignore alerts at startup |
| ALERT_DEBOUNCE_MS | 30000 | Min time between alerts |
| VERBOSE_LOGGING_DURATION_MS | 60000 | Detailed logs before quiet mode |
| PULSE_INTERVAL_MS | 300000 | Heartbeat interval in quiet mode |
| SKIP_STRINGS | [...] | Keywords to ignore |

## Technical Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Discord Tab    │     │  Service Worker  │     │     Popup       │
│  (contentScript)│◄────│  (background.js) │◄────│   (popup.js)    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                        │
        ▼                        ▼
   DOM Scanning            Port Management
   Queue Detection         Scan Triggering
   Audio Playback          Status Tracking
```

### Key Design Decisions

1. **Service Worker Driven Scanning** - Content script setInterval gets throttled in background tabs. Service worker triggers scans via port messaging.

2. **Snowflake ID Tracking** - Discord message IDs are chronological. Track highest seen ID to only process new messages.

3. **Combined Text Checking** - Embed description, footer, and message content are combined before keyword matching to handle split content.

## Success Criteria

- [ ] Alert plays within 2 seconds of message appearing
- [ ] Zero false negatives for supported retailers
- [ ] Works reliably in background tabs
- [ ] No missed alerts due to browser throttling
- [ ] Audio permission persists across sessions

## Future Considerations

- Desktop notifications as fallback
- Custom alert sounds per retailer
- URL auto-open for all retailers
- Mobile companion app
- Alert history/logging

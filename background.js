// Service Worker for Discord Alerts Extension
console.log('[Discord Alert Background] Service worker starting...');

// Configuration flags
const DEBUG_PRINT = true;

// Track active tabs and their status
const tabStatus = new Map();

// Log all messages to console with timestamps
const logBackgroundMessage = (message, data = null) => {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] [Discord Alert Background] ${message}`, data || '');
};

// Handle installation
chrome.runtime.onInstalled.addListener((details) => {
  logBackgroundMessage('Extension installed/updated', { reason: details.reason });

  // Set default settings
  chrome.storage.sync.set({ isEnabled: true }, () => {
    logBackgroundMessage('Default settings initialized');
  });

  // Check if audio permission is needed
  checkAndRequestAudioPermission();
});

// Handle startup
chrome.runtime.onStartup.addListener(() => {
  logBackgroundMessage('Browser started, service worker active');

  // Check audio permission on startup too
  setTimeout(checkAndRequestAudioPermission, 2000);
});

// Check audio permission and auto-open popup if needed
const checkAndRequestAudioPermission = async () => {
  try {
    const { audioPermission } = await chrome.storage.sync.get({ audioPermission: false });

    if (!audioPermission) {
      logBackgroundMessage('🔊 No audio permission detected - checking for Discord tabs...');

      // Check if user has Discord tabs open
      chrome.tabs.query({}, (tabs) => {
        const discordTabs = tabs.filter(tab =>
          tab.url?.includes('discord.com/channels')
        );

        if (discordTabs.length > 0) {
          logBackgroundMessage(`📍 Found ${discordTabs.length} Discord tab(s) - opening popup for audio permission`);

          // Focus the first Discord tab and open popup
          chrome.tabs.update(discordTabs[0].id, { active: true }, () => {
            // Small delay to ensure tab is focused
            setTimeout(() => {
              chrome.action.openPopup().then(() => {
                logBackgroundMessage('✅ Popup opened automatically for audio permission');
              }).catch(e => {
                logBackgroundMessage('❌ Failed to auto-open popup (user interaction required):', e.message);
                // Set a badge to draw attention
                chrome.action.setBadgeText({ text: '!' });
                chrome.action.setBadgeBackgroundColor({ color: '#ff4444' });
                chrome.action.setTitle({ title: 'Click to enable Pokemon queue audio alerts' });
              });
            }, 500);
          });
        } else {
          logBackgroundMessage('⚪ No Discord tabs found - will check audio permission when user visits Discord');
        }
      });
    } else {
      logBackgroundMessage('✅ Audio permission already granted');
      // Clear any badge
      chrome.action.setBadgeText({ text: '' });
      chrome.action.setTitle({ title: 'Discord Alerts - Pokemon Queue Monitor' });
    }
  } catch (e) {
    logBackgroundMessage('Error checking audio permission:', e);
  }
};

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab?.id;
  const url = sender.tab?.url;

  if (DEBUG_PRINT) {
    logBackgroundMessage(`Message received from tab ${tabId}`, {
      type: message.type,
      url: url?.substring(0, 60) + '...',
      data: message.data
    });
  }

  switch (message.type) {
    case 'CONTENT_LOG':
      // Log messages from content script to service worker console
      const channel = message.data.channel || 'unknown';
      logBackgroundMessage(`[${channel}] ${message.data.message}`);
      break;

    case 'STATUS_UPDATE':
      tabStatus.set(tabId, {
        lastUpdate: Date.now(),
        status: message.data.status,
        url: url,
        details: message.data.details
      });

      if (DEBUG_PRINT) {
        logBackgroundMessage(`Tab ${tabId} status: ${message.data.status}`, message.data.details);
      }
      break;

    case 'AUDIO_PERMISSION_GRANTED_CLEAR_BADGE':
      logBackgroundMessage('🔊 Audio permission granted - clearing notification badge');
      chrome.action.setBadgeText({ text: '' });
      chrome.action.setTitle({ title: 'Discord Alerts - Pokemon Queue Monitor' });
      break;

    case 'SURVEILLANCE_ACTIVE':
      logBackgroundMessage(`👁️ SURVEILLANCE ACTIVE on tab ${tabId}`, {
        channel: message.data.channel,
        url: url
      });
      break;

    case 'SCAN_COMPLETE':
      // Update tab status tracking
      tabStatus.set(tabId, {
        lastUpdate: Date.now(),
        status: 'scanning',
        url: url,
        details: message.data
      });
      // Don't log every scan - content script already logs via CONTENT_LOG
      break;

    case 'POKEMON_QUEUE_DETECTED':
      logBackgroundMessage(`🚨 POKEMON CENTER QUEUE detected on tab ${tabId}!`, {
        url: url,
        timestamp: new Date().toISOString()
      });
      break;

    case 'COSTCO_QUEUE_DETECTED':
      logBackgroundMessage(`🚨 COSTCO QUEUE detected on tab ${tabId}!`, {
        url: url,
        timestamp: new Date().toISOString()
      });
      break;

    case 'TARGET_QUEUE_DETECTED':
      logBackgroundMessage(`🚨 TARGET QUEUE detected on tab ${tabId}!`, {
        url: url,
        timestamp: new Date().toISOString()
      });
      break;

    case 'ALERT_PLAYED':
      logBackgroundMessage(`🔊 Alert played on tab ${tabId}`, {
        success: message.data.success,
        error: message.data.error
      });
      break;

    case 'ALERT_QUEUED':
      logBackgroundMessage(`⏳ Alert queued on tab ${tabId} - ${message.data.reason}`, {
        reason: message.data.reason,
        instructions: message.data.instructions
      });
      break;

    case 'EXTENSION_ENABLED':
      logBackgroundMessage(`Extension enabled on tab ${tabId}`);
      break;

    case 'EXTENSION_DISABLED':
      logBackgroundMessage(`Extension disabled on tab ${tabId}`);
      break;

    default:
      logBackgroundMessage('Unknown message type', { type: message.type, data: message.data });
  }

  // Send acknowledgment
  sendResponse({ received: true, timestamp: Date.now() });
});

// Monitor tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    if (tab.url?.includes('discord.com/channels')) {
      logBackgroundMessage(`✅ FOUND Discord channel tab: ${tabId}`, { url: tab.url?.substring(0, 70) + '...' });
      logBackgroundMessage(`Extension will activate on this tab automatically`);

      // Check if we need audio permission for this new Discord tab
      checkAudioPermissionForNewTab(tabId);
    }
  }
});

// Check audio permission when user opens a new Discord tab
const checkAudioPermissionForNewTab = async (tabId) => {
  try {
    const { audioPermission } = await chrome.storage.sync.get({ audioPermission: false });

    if (!audioPermission) {
      logBackgroundMessage(`🔊 New Discord tab ${tabId} opened without audio permission - setting notification badge`);

      // Set attention-grabbing badge
      chrome.action.setBadgeText({ text: '🔊' });
      chrome.action.setBadgeBackgroundColor({ color: '#ff4444' });
      chrome.action.setTitle({ title: 'IMPORTANT: Click to enable Pokemon queue audio alerts!' });

      // Try to auto-open popup (may fail due to user interaction requirements)
      setTimeout(() => {
        chrome.action.openPopup().then(() => {
          logBackgroundMessage('✅ Popup auto-opened for new Discord tab');
        }).catch(e => {
          logBackgroundMessage('⚠️ Cannot auto-open popup - user must click extension icon for audio permission');
        });
      }, 1000);
    }
  } catch (e) {
    logBackgroundMessage('Error checking audio permission for new tab:', e);
  }
};

// Monitor tab removal
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabStatus.has(tabId)) {
    logBackgroundMessage(`Tab ${tabId} closed, removing from status tracking`);
    tabStatus.delete(tabId);
  }
});

// Log storage changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync') {
    logBackgroundMessage('Extension settings changed', changes);
  }
});

// Scan for Discord pages
const scanForDiscordPages = () => {
  chrome.tabs.query({}, (tabs) => {
    const discordTabs = tabs.filter(tab =>
      tab.url?.includes('discord.com/channels')
    );

    if (discordTabs.length > 0) {
      if (DEBUG_PRINT) {
        logBackgroundMessage(`📍 SCAN RESULT: Found ${discordTabs.length} Discord channel page(s):`);
        discordTabs.forEach(tab => {
          logBackgroundMessage(`  Tab ${tab.id}: ${tab.url?.substring(0, 70)}...`);
        });
      }
    } else {
      if (DEBUG_PRINT) {
        logBackgroundMessage(`❌ SCAN RESULT: No Discord channel pages found`);
        logBackgroundMessage(`💡 Open discord.com/channels/... to start monitoring`);
      }
    }
  });
};

// Keep service worker alive and log periodic status
setInterval(() => {
  const activeTabsCount = tabStatus.size;
  if (DEBUG_PRINT) {
    logBackgroundMessage(`Service worker heartbeat - tracking ${activeTabsCount} active tabs`);
  }

  // Scan for Discord pages every heartbeat
  scanForDiscordPages();

  // Clean up old tab status (older than 5 minutes)
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  for (const [tabId, status] of tabStatus.entries()) {
    if (status.lastUpdate < fiveMinutesAgo) {
      logBackgroundMessage(`Cleaning up stale tab status: ${tabId}`);
      tabStatus.delete(tabId);
    }
  }
}, 30000); // Every 30 seconds

logBackgroundMessage('Service worker initialized and ready');

// Perform initial scan for Discord pages
setTimeout(() => {
  logBackgroundMessage('🔍 Performing initial scan for Discord pages...');
  scanForDiscordPages();
}, 1000);

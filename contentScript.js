// Discord Alerts - Content Script
// Monitors Discord channels for Pokemon queue alerts

(() => {
  const channelUrl = window.location.href;
  const channelPath = window.location.pathname;

  // Send status messages to service worker (all logs go through here)
  const sendStatusMessage = (type, data = {}) => {
    chrome.runtime.sendMessage({
      type: type,
      data: data
    }).catch(e => {
      // Silent fail - service worker might be restarting
    });
  };

  // Log to background service worker console
  const logToBackground = (message) => {
    sendStatusMessage('CONTENT_LOG', { message: message, channel: channelPath });
  };

  // Startup banner
  logToBackground('═══════════════════════════════════════════════════════════════════════');
  logToBackground('🔍 SURVEILLANCE ACTIVE');
  logToBackground(`📍 Channel: ${channelUrl}`);
  logToBackground(`⏰ Checking every ${DISCORD_ALERT_CONFIG.CHECK_INTERVAL_MS / 1000} seconds for queue alerts`);
  logToBackground('═══════════════════════════════════════════════════════════════════════');

  // Send initial surveillance active status
  sendStatusMessage('SURVEILLANCE_ACTIVE', {
    channel: channelPath,
    url: channelUrl,
    timestamp: new Date().toISOString()
  });

  // Track the highest message ID we've seen (Discord Snowflake IDs always increase)
  // Only messages with IDs higher than this will trigger alerts
  let highestSeenMessageId = 0n; // BigInt for large Discord IDs

  // Track user interaction and audio context state
  let hasAudioPermission = false;
  let audioContext = null;
  let pendingAlert = false;
  let surveillanceInterval = null;
  let surveillanceStartTime = null;
  let lastAlertTime = 0; // For debouncing alerts
  let scanCount = 0; // For pulse timing
  let lastPulseTime = 0; // Track when we last sent a pulse

  // Get new Discord messages (only those with IDs higher than our threshold)
  const getNewDiscordMessages = () => {
    const containers = document.querySelectorAll('[id^="message-accessories-"]');
    const newMessages = [];

    for (const container of containers) {
      const messageIdStr = container.id.replace('message-accessories-', '');
      try {
        const messageId = BigInt(messageIdStr);
        
        // Only process messages with IDs higher than our threshold
        if (messageId > highestSeenMessageId) {
          newMessages.push({
            id: messageIdStr,
            numericId: messageId,
            element: container
          });
        }
      } catch (e) {
        // Skip invalid IDs
      }
    }

    // Update the threshold to the highest ID we found
    for (const msg of newMessages) {
      if (msg.numericId > highestSeenMessageId) {
        highestSeenMessageId = msg.numericId;
      }
    }

    return newMessages;
  };

  // Check a Discord embed element for queue keywords
  const checkDiscordEmbedForQueue = (element) => {
    // Look for embed descriptions - these contain the main text content
    const embedDescriptions = element.querySelectorAll('[class*="embedDescription"]');

    for (const embed of embedDescriptions) {
      const textContent = (embed.textContent || '').toLowerCase();

      // Skip if matches any skip strings
      if (DISCORD_ALERT_CONFIG.SKIP_STRINGS.some(skipStr => textContent.includes(skipStr.toLowerCase()))) {
        if (DISCORD_ALERT_CONFIG.DEBUG_PRINT) {
          logToBackground('Skipping message - matches skip string');
        }
        continue;
      }

      // Check for Pokemon Center queue
      if (/pok[eé]mon center\s*queue/i.test(textContent) || /queue.*pok[eé]mon center/i.test(textContent)) {
        return { found: true, type: 'POKEMON_CENTER', text: textContent.substring(0, 100) };
      }

      // Check for Costco queue
      if (/(queue\s*.*?\s*costco)|(costco\s*.*?\s*queue)/i.test(textContent)) {
        return { found: true, type: 'COSTCO', text: textContent.substring(0, 100) };
      }

      // Check for Target queue (mavely.app.link or target.com/p)
      if (textContent.includes('mavely.app.link') || textContent.includes('target.com/p')) {
        return { found: true, type: 'TARGET', text: textContent.substring(0, 100) };
      }
    }

    return { found: false };
  };

  // Play alert sound from file
  const playAlert = () => {
    logToBackground('🔊 Attempting to play alert...');

    try {
      const audio = new Audio(chrome.runtime.getURL('alert.mp3'));
      audio.volume = 0.7;

      const playPromise = audio.play();

      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            logToBackground('✅ Alert played successfully');
            hasAudioPermission = true;
            chrome.storage.sync.set({ audioPermission: true });
            sendStatusMessage('ALERT_PLAYED', { success: true });
          })
          .catch(e => {
            logToBackground('Alert audio failed, trying fallback: ' + e.message);

            if (!hasAudioPermission) {
              logToBackground('Queuing alert - no audio permission yet');
              pendingAlert = true;
              sendStatusMessage('ALERT_QUEUED', {
                reason: 'Browser audio policy blocking - waiting for user interaction',
                instructions: 'Audio will play automatically after any page interaction'
              });
            } else {
              playBeep();
              sendStatusMessage('ALERT_PLAYED', {
                success: false,
                error: e.message,
                fallback: 'beep'
              });
            }
          });
      }
    } catch (e) {
      logToBackground('Alert audio creation failed: ' + e.message);

      if (!hasAudioPermission) {
        pendingAlert = true;
        sendStatusMessage('ALERT_QUEUED', {
          reason: 'Audio context not ready',
          instructions: 'Audio will play automatically after any page interaction'
        });
      } else {
        playBeep();
        sendStatusMessage('ALERT_PLAYED', {
          success: false,
          error: e.message,
          fallback: 'beep'
        });
      }
    }
  };

  // Play beep sound using Web Audio API
  const playBeep = () => {
    logToBackground('🔊 Playing fallback beep');

    try {
      const context = audioContext || new (window.AudioContext || window.webkitAudioContext)();

      if (context.state === 'suspended') {
        context.resume().then(() => {
          createBeepSound(context);
        }).catch(e => logToBackground('Audio context resume failed: ' + e.message));
      } else {
        createBeepSound(context);
      }

      function createBeepSound(ctx) {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.frequency.setValueAtTime(800, ctx.currentTime);
        gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.2);
      }
    } catch (e) {
      logToBackground('Web Audio API beep failed: ' + e.message);
    }
  };

  // Audio permission is handled by the popup - content script just sets up interaction detection

  // Setup detection for any user interaction to unlock audio
  const setupUserInteractionDetection = () => {
    logToBackground('Setting up user interaction detection for audio unlock...');

    const unlockAudio = async (event) => {
      if (hasAudioPermission) return;

      logToBackground('User interaction detected: ' + event.type + ' - unlocking audio...');

      try {
        if (audioContext && audioContext.state === 'suspended') {
          await audioContext.resume();
          logToBackground('Audio context resumed to state: ' + audioContext.state);
        } else if (!audioContext) {
          audioContext = new (window.AudioContext || window.webkitAudioContext)();
          logToBackground('New audio context created, state: ' + audioContext.state);
        }

        // Test with low volume beep
        try {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
          gainNode.gain.setValueAtTime(0.01, audioContext.currentTime);
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.1);

          logToBackground('✅ Audio unlocked successfully!');
          hasAudioPermission = true;
          chrome.storage.sync.set({ audioPermission: true });

          sendStatusMessage('AUDIO_UNLOCKED', {
            method: 'Web Audio API',
            interactionType: event.type,
            success: true
          });

          // Remove event listeners
          ['click', 'keydown', 'touchstart', 'scroll', 'mousemove'].forEach(eventType => {
            document.removeEventListener(eventType, unlockAudio);
          });

          // Play any pending alert
          if (pendingAlert) {
            logToBackground('Playing pending alert...');
            pendingAlert = false;
            setTimeout(playAlert, 200);
          }

        } catch (webAudioError) {
          logToBackground('Web Audio test failed: ' + webAudioError.message);

          // Fallback: Test with HTML5 Audio
          const testAudio = new Audio(chrome.runtime.getURL('alert.mp3'));
          testAudio.volume = 0.1;
          await testAudio.play();

          logToBackground('✅ Audio unlocked with HTML5 Audio!');
          hasAudioPermission = true;
          chrome.storage.sync.set({ audioPermission: true });

          sendStatusMessage('AUDIO_UNLOCKED', {
            method: 'HTML5 Audio',
            interactionType: event.type,
            success: true
          });

          ['click', 'keydown', 'touchstart', 'scroll', 'mousemove'].forEach(eventType => {
            document.removeEventListener(eventType, unlockAudio);
          });

          if (pendingAlert) {
            pendingAlert = false;
            setTimeout(playAlert, 200);
          }
        }

      } catch (e) {
        logToBackground('Audio unlock failed: ' + e.message);
      }
    };

    ['click', 'keydown', 'touchstart', 'scroll', 'mousemove'].forEach(eventType => {
      document.addEventListener(eventType, unlockAudio, { once: true, passive: true });
    });
  };

  // Check stored audio permission on load
  const checkAudioPermission = async () => {
    try {
      const result = await chrome.storage.sync.get({ audioPermission: false });
      hasAudioPermission = result.audioPermission;
      logToBackground('Stored audio permission status: ' + hasAudioPermission);

      if (hasAudioPermission) {
        try {
          audioContext = new (window.AudioContext || window.webkitAudioContext)();
          logToBackground('Audio context created, initial state: ' + audioContext.state);

          if (audioContext.state === 'suspended') {
            logToBackground('❌ Audio context suspended - browser requires user interaction');
            hasAudioPermission = false;
            chrome.storage.sync.set({ audioPermission: false });
            setupUserInteractionDetection();
          } else {
            logToBackground('✅ Audio context ready');
          }
        } catch (e) {
          logToBackground('Audio context re-initialization failed: ' + e.message);
          hasAudioPermission = false;
          setupUserInteractionDetection();
        }
      } else {
        // Audio permission handled by popup - just set up interaction detection as fallback
        logToBackground('No audio permission - click extension icon to enable or interact with page');
        setupUserInteractionDetection();
      }
    } catch (e) {
      logToBackground('Failed to check audio permission: ' + e.message);
      setupUserInteractionDetection();
    }
  };

  // Listen for audio permission messages from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'AUDIO_PERMISSION_GRANTED') {
      logToBackground('Audio permission granted via popup');
      hasAudioPermission = true;

      try {
        if (!audioContext) {
          audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioContext.state === 'suspended') {
          audioContext.resume();
        }
      } catch (e) {
        logToBackground('Audio context creation failed: ' + e.message);
      }

      if (pendingAlert) {
        logToBackground('Playing pending alert now');
        pendingAlert = false;
        setTimeout(playAlert, 500);
      }

      sendResponse({ success: true });
    }
  });

  // Main surveillance function - runs every 5 seconds
  const performSurveillanceScan = () => {
    const now = Date.now();
    const timeSinceStart = now - surveillanceStartTime;
    const isGracePeriod = timeSinceStart < DISCORD_ALERT_CONFIG.INITIAL_GRACE_PERIOD_MS;
    const isVerboseMode = timeSinceStart < DISCORD_ALERT_CONFIG.VERBOSE_LOGGING_DURATION_MS;
    
    scanCount++;

    // In quiet mode, send pulse at the configured interval
    if (!isVerboseMode) {
      const timeSinceLastPulse = now - lastPulseTime;
      if (timeSinceLastPulse >= DISCORD_ALERT_CONFIG.PULSE_INTERVAL_MS) {
        logToBackground('💓');
        lastPulseTime = now;
      }
    }

    const newMessages = getNewDiscordMessages();

    if (newMessages.length > 0) {
      if (isGracePeriod) {
        // During grace period, acknowledge new messages but don't check for alerts
        logToBackground(`⏳ Grace period: ignoring ${newMessages.length} message(s)`);
      } else {
        logToBackground(`📨 Found ${newMessages.length} new message(s)`);

        for (const msg of newMessages) {
          const result = checkDiscordEmbedForQueue(msg.element);
          
          if (result.found) {
            // Check debounce - don't alert if we just alerted recently
            const timeSinceLastAlert = now - lastAlertTime;
            if (timeSinceLastAlert < DISCORD_ALERT_CONFIG.ALERT_DEBOUNCE_MS) {
              logToBackground(`⏳ Alert debounced (${Math.round(timeSinceLastAlert/1000)}s since last)`);
              continue;
            }

            logToBackground(`🚨 ${result.type} QUEUE DETECTED!`);
            logToBackground(`Text preview: ${result.text}...`);
            
            sendStatusMessage(`${result.type}_QUEUE_DETECTED`, {
              messageId: msg.id,
              type: result.type,
              timestamp: new Date().toISOString()
            });
            
            lastAlertTime = now;
            playAlert();
          }
        }
      }
    } else {
      // Only log "no new messages" during verbose mode (first 60 seconds)
      if (isVerboseMode) {
        if (isGracePeriod) {
          const remaining = Math.round((DISCORD_ALERT_CONFIG.INITIAL_GRACE_PERIOD_MS - timeSinceStart) / 1000);
          logToBackground(`⏳ Grace period (${remaining}s remaining)... ✓ No new messages`);
        } else {
          logToBackground(`👁️ Scanning... ✓ No new messages`);
        }
      }
    }

    // Send status update (silent heartbeat to keep tab tracking alive)
    sendStatusMessage('SCAN_COMPLETE', {
      channel: channelPath,
      newMessages: newMessages.length,
      timestamp: new Date().toISOString(),
      silent: !isVerboseMode // Background won't log if silent
    });
  };

  // Start the surveillance interval
  const startSurveillance = () => {
    if (surveillanceInterval) {
      clearInterval(surveillanceInterval);
    }

    logToBackground('🚀 Starting surveillance...');
    
    // Find the highest message ID on the page - only messages newer than this will trigger alerts
    const existingMessages = document.querySelectorAll('[id^="message-accessories-"]');
    let messageCount = 0;
    
    for (const container of existingMessages) {
      const messageIdStr = container.id.replace('message-accessories-', '');
      try {
        const messageId = BigInt(messageIdStr);
        if (messageId > highestSeenMessageId) {
          highestSeenMessageId = messageId;
        }
        messageCount++;
      } catch (e) {
        // Skip invalid IDs
      }
    }
    
    logToBackground(`📋 Found ${messageCount} existing messages, threshold ID: ${highestSeenMessageId}`);

    // Track start time for verbose/quiet mode switching
    surveillanceStartTime = Date.now();
    const gracePeriodSeconds = DISCORD_ALERT_CONFIG.INITIAL_GRACE_PERIOD_MS / 1000;
    const verboseDurationSeconds = DISCORD_ALERT_CONFIG.VERBOSE_LOGGING_DURATION_MS / 1000;
    logToBackground(`⏳ Grace period: ${gracePeriodSeconds}s (ignoring alerts while Discord loads)`);
    logToBackground(`📢 Verbose logging for ${verboseDurationSeconds}s, then quiet mode`);

    // Start periodic scanning
    surveillanceInterval = setInterval(performSurveillanceScan, DISCORD_ALERT_CONFIG.CHECK_INTERVAL_MS);
    
    logToBackground('✅ Surveillance active');

    // Log when grace period ends
    setTimeout(() => {
      logToBackground('✅ Grace period ended - now monitoring for alerts');
    }, DISCORD_ALERT_CONFIG.INITIAL_GRACE_PERIOD_MS);

    // Log when switching to quiet mode
    setTimeout(() => {
      logToBackground('🔇');
      lastPulseTime = Date.now(); // Start pulse timing from quiet mode start
    }, DISCORD_ALERT_CONFIG.VERBOSE_LOGGING_DURATION_MS);
  };

  const stopSurveillance = () => {
    if (surveillanceInterval) {
      clearInterval(surveillanceInterval);
      surveillanceInterval = null;
    }
    logToBackground('⏹️');
  };

  // Initialize
  checkAudioPermission();

  // Start surveillance based on extension state
  chrome.storage.sync.get({ isEnabled: true }, (s) => {
    logToBackground('Extension enabled: ' + s.isEnabled);

    if (s.isEnabled) {
      startSurveillance();
      sendStatusMessage('EXTENSION_ENABLED', {
        channel: channelPath
      });
    } else {
      logToBackground('Extension is disabled');
      sendStatusMessage('EXTENSION_DISABLED');
    }
  });

  // React to toggle changes
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    
    chrome.storage.sync.get({ isEnabled: true }, (s) => {
      logToBackground('Extension state changed: ' + s.isEnabled);
      
      if (!s.isEnabled) {
        logToBackground('Disabling extension');
        stopSurveillance();
        sendStatusMessage('EXTENSION_DISABLED');
      } else {
        logToBackground('Enabling extension');
        startSurveillance();
        sendStatusMessage('EXTENSION_ENABLED', {
          channel: channelPath
        });
      }
    });
  });
})();

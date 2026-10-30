/**
 * Krishi-Line WhatsApp Simulator Client Application
 * 
 * Implements interactive WhatsApp conversation simulation, quick action chips,
 * multi-farmer persona switching, live session inspection, and Mandi gate QR verification.
 */

// State Management
const state = {
  activeFarmerId: 'farmer-001',
  chatHistories: {}, // farmerId -> Array of message objects
  isProcessing: false,
  latestToken: null,
  latestBookingId: null
};

// Preset Farmer Personas
const FARMER_PERSONAS = {
  'farmer-001': { name: 'Ramesh Patil', village: 'Lasalgaon', district: 'Nashik' },
  'farmer-002': { name: 'Sunil Shinde', village: 'Pimpalgaon Baswant', district: 'Nashik' },
  'farmer-003': { name: 'Balasaheb Gite', village: 'Chandwad', district: 'Nashik' }
};

// DOM Elements
const chatCanvas = document.getElementById('chat-canvas');
const messagesList = document.getElementById('messages-list');
const typingIndicator = document.getElementById('typing-indicator');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const sendIcon = document.getElementById('send-icon');
const micIcon = document.getElementById('mic-icon');
const botStatusText = document.getElementById('bot-status-text');
const statusClock = document.getElementById('status-clock');

// Control Panel Elements
const farmerSelect = document.getElementById('farmer-select');
const customFarmerRow = document.getElementById('custom-farmer-row');
const customFarmerInput = document.getElementById('custom-farmer-input');
const applyCustomFarmerBtn = document.getElementById('apply-custom-farmer-btn');
const dispFarmerId = document.getElementById('disp-farmer-id');
const dispRegStatus = document.getElementById('disp-reg-status');
const dispState = document.getElementById('disp-state');
const tokenInput = document.getElementById('token-input');
const btnVerifyToken = document.getElementById('btn-verify-token');
const verificationResultBox = document.getElementById('verification-result-box');
const lifecycleControls = document.getElementById('lifecycle-controls');
const btnMarkCancelled = document.getElementById('btn-mark-cancelled');
const btnMarkArrived = document.getElementById('btn-mark-arrived');
const btnMarkCompleted = document.getElementById('btn-mark-completed');
const backendIndicator = document.getElementById('backend-indicator');
const backendStatusText = document.getElementById('backend-status-text');

// Quick Action Buttons
const btnQuickGreet = document.getElementById('btn-quick-greet');
const btnQuickRegister = document.getElementById('btn-quick-register');
const btnQuickBook = document.getElementById('btn-quick-book');
const btnQuickMybooking = document.getElementById('btn-quick-mybooking');
const btnQuickProcstatus = document.getElementById('btn-quick-procstatus');
const btnQuickPaystatus = document.getElementById('btn-quick-paystatus');
const btnQuickMenu = document.getElementById('btn-quick-menu');
const btnClearChat = document.getElementById('btn-clear-chat');

/**
 * Initializes the simulator.
 */
function init() {
  updateClock();
  setInterval(updateClock, 10000);

  setupInputHandlers();
  setupFarmerSwitcher();
  setupQuickActions();
  setupMandiGateScanner();
  checkBackendHealth();
  setInterval(checkBackendHealth, 15000);

  // Switch to default farmer and start conversation if empty
  switchFarmer('farmer-001', true);
}

/**
 * Updates the phone mockup status bar clock.
 */
function updateClock() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  if (statusClock) {
    statusClock.textContent = `${hours}:${minutes}`;
  }
}

/**
 * Formats a timestamp for WhatsApp message bubble.
 */
function formatTime(date = new Date()) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
}

/**
 * Configures input box auto-resize, mic/send toggle, and IME-safe submit.
 */
function setupInputHandlers() {
  // Toggle mic vs send icon based on input length
  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 100) + 'px';

    const hasText = chatInput.value.trim().length > 0;
    sendIcon.style.display = hasText ? 'block' : 'none';
    micIcon.style.display = hasText ? 'none' : 'block';
  });

  // Initial icon state
  sendIcon.style.display = 'none';
  micIcon.style.display = 'block';

  /**
   * IME-safe Enter-to-Submit
   * Adheres to Modern Web Guidance: ime-safe-enter-submit
   */
  chatInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();

      // Guard against IME character conversion submit in Japanese/Chinese/Indic IME keyboards
      if (event.isComposing || event.keyCode === 229) {
        return;
      }

      chatForm.requestSubmit();
    }
  });

  // Form submission
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text || state.isProcessing) return;

    chatInput.value = '';
    chatInput.style.height = 'auto';
    sendIcon.style.display = 'none';
    micIcon.style.display = 'block';

    sendMessage(text);
  });
}

/**
 * Sends a message from the active farmer to the backend bot.
 */
async function sendMessage(text) {
  if (!text || state.isProcessing) return;

  state.isProcessing = true;
  const timeStr = formatTime();

  // 1. Append outgoing farmer message to UI
  appendMessage({
    sender: 'farmer',
    text,
    time: timeStr
  });

  // 2. Show typing indicator
  setTyping(true);

  try {
    const response = await fetch('/api/bot/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        farmerId: state.activeFarmerId,
        message: text
      })
    });

    const data = await response.json();

    // Natural conversation delay (350ms)
    await new Promise((r) => setTimeout(r, 350));
    setTyping(false);

    if (data.success) {
      // Check for QR image reference
      let qrPassUrl = null;
      let qrToken = null;

      const qrRefMatch = data.reply.match(/QR Pass Reference:\s*\*?(\/qrcodes\/[a-zA-Z0-9_.-]+)\*?/i);
      if (qrRefMatch) {
        qrPassUrl = qrRefMatch[1];
      }

      // Check for booking ID
      const bookingIdMatch = data.reply.match(/Booking ID:\s*\*?([A-Z0-9-]+)\*?/i);
      if (bookingIdMatch) {
        state.latestBookingId = bookingIdMatch[1];
        // Query latest booking to get the cryptographic QR token
        fetchLatestBookingData(state.activeFarmerId);
      }

      // 3. Append bot incoming reply to UI
      appendMessage({
        sender: 'bot',
        text: data.reply,
        menuOptions: data.menuOptions,
        qrPassUrl,
        time: formatTime()
      });

      // Update session badge
      refreshSessionInfo(state.activeFarmerId);
    } else {
      appendMessage({
        sender: 'bot',
        text: `⚠️ *Error:* ${data.message || 'Could not process request.'}`,
        time: formatTime()
      });
    }
  } catch (err) {
    setTyping(false);
    appendMessage({
      sender: 'bot',
      text: `⚠️ *Network Error:* Failed to connect to Krishi-Line backend server (${err.message}).`,
      time: formatTime()
    });
  } finally {
    state.isProcessing = false;
    scrollToBottom();
  }
}

/**
 * Appends a message bubble into the conversation canvas.
 */
function appendMessage(msg) {
  if (!state.chatHistories[state.activeFarmerId]) {
    state.chatHistories[state.activeFarmerId] = [];
  }
  state.chatHistories[state.activeFarmerId].push(msg);

  const row = document.createElement('div');
  row.className = `message-row ${msg.sender === 'farmer' ? 'outgoing' : 'incoming'}`;

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';

  // Format message text
  const content = document.createElement('div');
  content.className = 'bubble-content';
  content.innerHTML = formatWhatsAppText(msg.text);
  bubble.appendChild(content);

  // If message includes QR pass reference, render QR Card
  if (msg.qrPassUrl) {
    const qrCard = document.createElement('div');
    qrCard.className = 'qr-pass-card';
    qrCard.innerHTML = `
      <div class="qr-image-wrapper">
        <img src="${msg.qrPassUrl}" alt="Procurement Gate QR Pass" class="qr-pass-img" onerror="this.alt='QR generated on server'"/>
      </div>
      <div class="qr-pass-id">Nashik APMC Gate Entry Pass</div>
      <div class="qr-pass-meta">Scan to verify at yard weighbridge</div>
      <button type="button" class="qr-scan-btn" data-qrurl="${msg.qrPassUrl}">
        🔍 Test Gate Verification
      </button>
    `;

    const scanBtn = qrCard.querySelector('.qr-scan-btn');
    scanBtn.addEventListener('click', () => {
      // Populate scanner and scroll into view
      if (tokenInput && state.latestToken) {
        tokenInput.value = state.latestToken;
        btnVerifyToken.click();
        tokenInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        fetchLatestBookingData(state.activeFarmerId, true);
      }
    });

    bubble.appendChild(qrCard);
  }

  // If bot response has interactive menu option chips
  if (msg.menuOptions && msg.menuOptions.length > 0 && msg.sender === 'bot') {
    const btnGroup = document.createElement('div');
    btnGroup.className = 'bubble-buttons-group';

    msg.menuOptions.forEach((opt) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'quick-reply-btn';
      btn.innerHTML = `<span>${escapeHtml(opt)}</span><span class="btn-arrow">›</span>`;
      btn.addEventListener('click', () => {
        // Send choice (extract option number or full text)
        const matchNumber = opt.match(/^(\d+)\./);
        const textToSend = matchNumber ? matchNumber[1] : opt;
        sendMessage(textToSend);
      });
      btnGroup.appendChild(btn);
    });

    bubble.appendChild(btnGroup);
  }

  // Meta row (timestamp & ticks)
  const meta = document.createElement('span');
  meta.className = 'bubble-meta';
  meta.innerHTML = `<span>${msg.time || formatTime()}</span>` + 
    (msg.sender === 'farmer' ? `<span class="msg-status-ticks" title="Read">✓✓</span>` : '');
  bubble.appendChild(meta);

  row.appendChild(bubble);
  messagesList.appendChild(row);

  scrollToBottom();
}

/**
 * Toggles bot typing status.
 */
function setTyping(isTyping) {
  if (isTyping) {
    botStatusText.textContent = 'typing...';
    botStatusText.classList.add('typing');
    typingIndicator.style.display = 'flex';
    scrollToBottom();
  } else {
    botStatusText.textContent = 'online';
    botStatusText.classList.remove('typing');
    typingIndicator.style.display = 'none';
  }
}

/**
 * Smoothly scrolls chat to latest message.
 */
function scrollToBottom() {
  requestAnimationFrame(() => {
    chatCanvas.scrollTop = chatCanvas.scrollHeight;
  });
}

/**
 * Formats WhatsApp markdown: *bold*, _italics_, lists, and newlines.
 */
function formatWhatsAppText(raw) {
  if (!raw) return '';
  let text = escapeHtml(raw);

  // Bold: *text*
  text = text.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');

  // Italic: _text_
  text = text.replace(/_([^_]+)_/g, '<em>$1</em>');

  // Monospace: `code`
  text = text.replace(/`([^`]+)`/g, '<code style="background:rgba(0,0,0,0.06);padding:2px 4px;border-radius:4px;">$1</code>');

  // Newlines
  text = text.replace(/\n/g, '<br/>');

  return text;
}

/**
 * HTML escaper.
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Configures switching between farmer personas.
 */
function setupFarmerSwitcher() {
  farmerSelect.addEventListener('change', () => {
    const val = farmerSelect.value;
    if (val === 'custom') {
      customFarmerRow.style.display = 'flex';
      customFarmerInput.focus();
    } else {
      customFarmerRow.style.display = 'none';
      switchFarmer(val);
    }
  });

  applyCustomFarmerBtn.addEventListener('click', () => {
    const customId = customFarmerInput.value.trim();
    if (customId) {
      switchFarmer(customId);
    }
  });

  customFarmerInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      applyCustomFarmerBtn.click();
    }
  });
}

/**
 * Switches the active conversation to a specific farmerId.
 */
function switchFarmer(farmerId, initial = false) {
  state.activeFarmerId = farmerId;
  dispFarmerId.textContent = farmerId;

  // Clear current messages view
  messagesList.innerHTML = '';

  // Render existing messages for this farmer if any
  const history = state.chatHistories[farmerId] || [];
  if (history.length > 0) {
    history.forEach((m) => appendMessage(m));
  } else {
    // Send automatic greeting to begin conversation
    sendMessage('Hi');
  }

  // Refresh profile info and latest bookings
  refreshSessionInfo(farmerId);
  fetchLatestBookingData(farmerId);
}

/**
 * Queries the session status from the backend.
 */
async function refreshSessionInfo(farmerId) {
  try {
    const res = await fetch(`/api/bot/session/${encodeURIComponent(farmerId)}`);
    if (!res.ok) return;
    const data = await res.json();

    if (data.success && data.session) {
      const s = data.session;
      dispState.textContent = s.state || 'MAIN_MENU';

      if (s.farmer && s.farmer.registered) {
        dispRegStatus.className = 'profile-badge badge-registered';
        dispRegStatus.textContent = `Registered (${s.farmer.name || 'Verified'})`;
      } else {
        dispRegStatus.className = 'profile-badge badge-pending';
        dispRegStatus.textContent = 'Not Registered';
      }
    }
  } catch (err) {
    console.warn('Session refresh error:', err.message);
  }
}

/**
 * Fetches latest booking data for a farmer and auto-populates the QR verifier.
 */
async function fetchLatestBookingData(farmerId, triggerVerify = false) {
  try {
    const res = await fetch(`/api/bookings/latest/${encodeURIComponent(farmerId)}`);
    if (!res.ok) return;
    const data = await res.json();

    if (data.success && data.booking) {
      state.latestBookingId = data.booking.bookingId;
      state.latestToken = data.booking.qrToken;

      tokenInput.value = data.booking.qrToken;
      lifecycleControls.style.display = 'block';

      if (triggerVerify) {
        btnVerifyToken.click();
      }
    } else {
      lifecycleControls.style.display = 'none';
    }
  } catch (err) {
    console.warn('Could not fetch latest booking:', err.message);
  }
}

/**
 * Configures the Mandi Gate QR Scanner verification terminal.
 */
function setupMandiGateScanner() {
  btnVerifyToken.addEventListener('click', async () => {
    const token = tokenInput.value.trim();
    if (!token) {
      alert('Please enter or scan a QR verification token.');
      return;
    }

    verificationResultBox.innerHTML = `
      <div class="verify-idle">
        <span>🔄 Verifying token with APMC Mandi Gate Registry...</span>
      </div>
    `;

    try {
      const res = await fetch('/api/bookings/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });

      const data = await res.json();

      if (data.valid) {
        verificationResultBox.innerHTML = `
          <div class="verify-card">
            <div class="verify-header-badge badge-valid">
              <span>✅ GATE PASS VERIFIED & ACTIVE</span>
            </div>
            <div class="verify-field">
              <span class="label">Booking ID:</span>
              <span class="val">${escapeHtml(data.bookingId)}</span>
            </div>
            <div class="verify-field">
              <span class="label">Mandi Yard:</span>
              <span class="val">${escapeHtml(data.centreName)}</span>
            </div>
            <div class="verify-field">
              <span class="label">Scheduled Slot:</span>
              <span class="val">${escapeHtml(data.slotText)}</span>
            </div>
            <div class="verify-field">
              <span class="label">Status:</span>
              <span class="val" style="color:#15803d">${escapeHtml(data.status)}</span>
            </div>
            <div class="verify-field">
              <span class="label">Verified At:</span>
              <span class="val">${new Date(data.verifiedAt).toLocaleTimeString()}</span>
            </div>
          </div>
        `;
      } else if (data.status === 'CANCELLED' || data.reason === 'CANCELLED') {
        verificationResultBox.innerHTML = `
          <div class="verify-card">
            <div class="verify-header-badge badge-cancelled">
              <span>❌ BOOKING CANCELLED - GATE ENTRY REFUSED</span>
            </div>
            <div class="verify-field">
              <span class="label">Booking ID:</span>
              <span class="val">${escapeHtml(data.bookingId || 'N/A')}</span>
            </div>
            <div class="verify-field">
              <span class="label">Reason:</span>
              <span class="val" style="color:#b91c1c">Pass revoked due to cancellation</span>
            </div>
          </div>
        `;
      } else {
        verificationResultBox.innerHTML = `
          <div class="verify-card">
            <div class="verify-header-badge badge-invalid">
              <span>⚠️ INVALID / NOT FOUND</span>
            </div>
            <div class="verify-field">
              <span class="label">Error:</span>
              <span class="val" style="color:#b45309">${escapeHtml(data.message || 'Token not recognized')}</span>
            </div>
          </div>
        `;
      }
    } catch (err) {
      verificationResultBox.innerHTML = `
        <div class="verify-card">
          <div class="verify-header-badge badge-invalid">
            <span>⚠️ GATE SYSTEM ERROR</span>
          </div>
          <div class="verify-field">
            <span class="label">Details:</span>
            <span class="val">${escapeHtml(err.message)}</span>
          </div>
        </div>
      `;
    }
  });

  // Lifecycle Testing Controls
  btnMarkCancelled.addEventListener('click', () => updateBookingLifecycle('CANCELLED'));
  btnMarkArrived.addEventListener('click', () => updateBookingLifecycle('ARRIVED'));
  btnMarkCompleted.addEventListener('click', () => updateBookingLifecycle('COMPLETED'));
}

/**
 * Updates booking lifecycle status (e.g. CANCELLED, ARRIVED, COMPLETED).
 */
async function updateBookingLifecycle(newStatus) {
  if (!state.latestBookingId) {
    alert('No active booking found for this farmer.');
    return;
  }

  try {
    const res = await fetch('/api/bookings/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingId: state.latestBookingId,
        status: newStatus
      })
    });

    const data = await res.json();
    if (data.success) {
      alert(`Booking ${state.latestBookingId} marked as ${newStatus}!`);
      // Immediately test verify button to observe status change
      btnVerifyToken.click();
    } else {
      alert(`Update failed: ${data.message}`);
    }
  } catch (err) {
    alert(`Error updating status: ${err.message}`);
  }
}

/**
 * Sets up Quick Action flow buttons.
 */
function setupQuickActions() {
  btnQuickGreet.addEventListener('click', () => sendMessage('Hi'));

  btnQuickMenu.addEventListener('click', () => sendMessage('MENU'));

  btnQuickMybooking.addEventListener('click', () => sendMessage('3'));

  btnQuickProcstatus.addEventListener('click', () => sendMessage('4'));

  btnQuickPaystatus.addEventListener('click', () => sendMessage('5'));

  // Clear chat screen
  btnClearChat.addEventListener('click', () => {
    state.chatHistories[state.activeFarmerId] = [];
    messagesList.innerHTML = '';
  });

  // Fast Full Registration Flow Simulation
  btnQuickRegister.addEventListener('click', async () => {
    if (state.isProcessing) return;
    const persona = FARMER_PERSONAS[state.activeFarmerId] || {
      name: 'Ramesh Patil',
      village: 'Lasalgaon',
      district: 'Nashik'
    };

    const steps = ['1', persona.name, persona.village, persona.district, '1'];
    for (const step of steps) {
      await sendMessage(step);
      await new Promise((r) => setTimeout(r, 600));
    }
  });

  // Fast Morning Slot Booking Simulation
  btnQuickBook.addEventListener('click', async () => {
    if (state.isProcessing) return;
    const steps = ['2', '1', '1', '1'];
    for (const step of steps) {
      await sendMessage(step);
      await new Promise((r) => setTimeout(r, 600));
    }
  });
}

/**
 * Pings backend health check.
 */
async function checkBackendHealth() {
  try {
    const res = await fetch('/health');
    const data = await res.json();
    if (data.success) {
      backendIndicator.className = 'status-indicator online';
      backendStatusText.textContent = `Backend online (PORT 3000)`;
    } else {
      backendIndicator.className = 'status-indicator offline';
      backendStatusText.textContent = `Backend issue`;
    }
  } catch (err) {
    backendIndicator.className = 'status-indicator offline';
    backendStatusText.textContent = `Backend unreachable`;
  }
}

// Boot simulator when DOM is ready
document.addEventListener('DOMContentLoaded', init);

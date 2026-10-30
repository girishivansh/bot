/**
 * Conversation Engine for Krishi-Line Bot
 * 
 * Manages farmer dialogue states, option selections, demo registrations,
 * and demo slot bookings for Nashik onion procurement with MongoDB persistence.
 */

const { getSession, resetStateToMenu } = require('./sessionStore');
const { CENTRES } = require('./centresData');
const farmerService = require('../services/farmerService');
const slotService = require('../services/slotService');
const bookingService = require('../services/bookingService');

const MAIN_MENU_TEXT = `Namaste! Welcome to Krishi-Line.
Transparent Procurement | Stronger Farmers

Please choose:

1. Farmer Registration
2. Book a Procurement Slot
3. My Booking
4. Procurement Status
5. Payment Status
6. Help`;

const MAIN_MENU_OPTIONS = [
  '1. Farmer Registration',
  '2. Book a Procurement Slot',
  '3. My Booking',
  '4. Procurement Status',
  '5. Payment Status',
  '6. Help'
];

/**
 * Normalizes input text for case-insensitive matching and trimming.
 * @param {string} text 
 * @returns {string}
 */
function normalize(text) {
  return (text || '').trim();
}

/**
 * Processes an incoming farmer message and advances conversation state.
 * @param {string} farmerId 
 * @param {string} messageText 
 * @returns {Promise<object>} { reply, menuOptions, state }
 */
async function processMessage(farmerId, messageText) {
  const session = getSession(farmerId);
  const input = normalize(messageText);
  const lowerInput = input.toLowerCase();

  // If in-memory session does not have registered profile, hydrate from MongoDB
  if (!session.farmer.registered) {
    try {
      const persistedFarmer = await farmerService.getFarmer(farmerId);
      if (persistedFarmer) {
        session.farmer.registered = true;
        session.farmer.name = persistedFarmer.name;
        session.farmer.village = persistedFarmer.village;
        session.farmer.district = persistedFarmer.district;
        session.farmer.state = persistedFarmer.state;
        session.farmer.registeredAt = persistedFarmer.registeredAt;
      }
    } catch (err) {
      console.warn(`Could not check database profile for ${farmerId}:`, err.message);
    }
  }

  // Global reset triggers: MENU, HI, HELLO, NAMASTE
  if (['hi', 'hello', 'namaste'].includes(lowerInput)) {
    resetStateToMenu(farmerId);
    return {
      reply: MAIN_MENU_TEXT,
      menuOptions: MAIN_MENU_OPTIONS,
      state: session.state
    };
  }

  if (lowerInput === 'menu') {
    resetStateToMenu(farmerId);
    return {
      reply: `📋 *Main Menu*\n\n${MAIN_MENU_TEXT}`,
      menuOptions: MAIN_MENU_OPTIONS,
      state: session.state
    };
  }

  // State Machine Routing
  switch (session.state) {
    case 'MAIN_MENU':
      return handleMainMenu(session, input, lowerInput);

    case 'REG_NAME':
      return handleRegName(session, input);

    case 'REG_VILLAGE':
      return handleRegVillage(session, input);

    case 'REG_DISTRICT':
      return handleRegDistrict(session, input);

    case 'REG_CONFIRM':
      return handleRegConfirm(session, lowerInput);

    case 'BOOK_CENTRE':
      return handleBookCentre(session, input);

    case 'BOOK_SLOT':
      return handleBookSlot(session, input);

    case 'BOOK_CONFIRM':
      return handleBookConfirm(session, lowerInput);

    default:
      resetStateToMenu(farmerId);
      return {
        reply: `Something went wrong. Returned to main menu.\n\n${MAIN_MENU_TEXT}`,
        menuOptions: MAIN_MENU_OPTIONS,
        state: 'MAIN_MENU'
      };
  }
}

/**
 * Handles options from the Main Menu
 */
async function handleMainMenu(session, input, lowerInput) {
  // Option 1: Farmer Registration
  if (input === '1' || lowerInput.includes('registration') || lowerInput.includes('register')) {
    if (session.farmer.registered) {
      return {
        reply: `🌾 *Farmer Registration (Demo)*\n\nYou are already registered as:\n• Name: ${session.farmer.name}\n• Village: ${session.farmer.village}\n• District: ${session.farmer.district}\n\nTo re-register with new details, reply *RE-REGISTER*.\nOr reply *2* to Book a Procurement Slot, or *MENU* for main menu.`,
        menuOptions: ['2. Book a Procurement Slot', 'RE-REGISTER', 'MENU'],
        state: session.state
      };
    }

    session.state = 'REG_NAME';
    return {
      reply: `🌾 *Farmer Registration (Demo)*\n\nPlease enter your full name:`,
      menuOptions: ['Send MENU to cancel'],
      state: session.state
    };
  }

  // Handle re-registration request if already registered
  if (lowerInput === 're-register') {
    session.farmer.registered = false;
    session.state = 'REG_NAME';
    return {
      reply: `🌾 *Farmer Registration (Demo)*\n\nPlease enter your full name:`,
      menuOptions: ['Send MENU to cancel'],
      state: session.state
    };
  }

  // Option 2: Book a Procurement Slot
  if (input === '2' || lowerInput.includes('book') || lowerInput.includes('slot')) {
    if (!session.farmer.registered) {
      return {
        reply: `⚠️ You are not registered yet. Please complete Farmer Registration before booking a procurement slot.\n\nReply *1* to start Farmer Registration, or send *MENU* to view all options.`,
        menuOptions: ['1. Farmer Registration', 'MENU'],
        state: session.state
      };
    }

    session.state = 'BOOK_CENTRE';
    let centresList = CENTRES.map((c) => `${c.id}. ${c.name} (${c.location})`).join('\n');
    return {
      reply: `🧅 *Book Onion Procurement Slot (Demo)*\n\nAvailable Procurement Centres in Nashik:\n${centresList}\n\nPlease reply with the centre number (1, 2, or 3), or send *MENU* to cancel:`,
      menuOptions: CENTRES.map((c) => `${c.id}. ${c.name}`),
      state: session.state
    };
  }

  // Option 3: My Booking
  if (input === '3' || lowerInput.includes('my booking')) {
    let booking = null;
    try {
      booking = await bookingService.getLatestBooking(session.farmerId);
    } catch (err) {
      console.warn('Could not read booking from database:', err.message);
    }

    if (!booking) {
      booking = session.latestBooking;
    }

    if (booking) {
      const bookedDateStr = booking.bookedAt instanceof Date
        ? booking.bookedAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
        : (booking.bookedAt || 'Recently');

      return {
        reply: `📋 *My Latest Procurement Booking (Demo)*\n\n• Booking ID: *${booking.bookingId}*\n• Centre: ${booking.centreName}\n• Date & Slot: ${booking.slotText}\n• Status: *${booking.status || 'CONFIRMED'} (Simulated Demo)*\n• QR Token Status: *${booking.qrTokenStatus || 'ACTIVE'}*\n• QR Pass Reference: *${booking.qrRelativeUrl || `/qrcodes/${booking.bookingId}.png`}*\n• Booked At: ${bookedDateStr}\n\n⚠️ *Demo Notice:* This is simulated data for prototype demonstration.\n\nSend *MENU* to return to the main menu.`,
        menuOptions: MAIN_MENU_OPTIONS,
        state: session.state
      };
    }

    return {
      reply: `ℹ️ You do not have any active procurement bookings.\n\nReply *2* to Book a Procurement Slot, or send *MENU* for the main menu.`,
      menuOptions: ['2. Book a Procurement Slot', 'MENU'],
      state: session.state
    };
  }

  // Option 4: Procurement Status
  if (input === '4' || lowerInput.includes('procurement status')) {
    const farmerName = session.farmer.name || 'Demo Farmer';
    return {
      reply: `📊 *Procurement Status (Simulated Demo Data)*\n\n• Farmer ID: ${session.farmerId}\n• Farmer Name: ${farmerName}\n• Produce: Red Onion (Garwa / Gavran)\n• Lot Reference: LOT-NSK-9281 (Simulated)\n• Quality Assessment: Fair Average Quality (FAQ) - Grade A\n• Net Weight: 42.5 Quintals (Weighed at Mandi Gate - Simulated)\n• Verification Status: Demo Verified (No real mandi integration)\n• Overall Status: *Produce Accepted & Weighed (Demo)*\n\n⚠️ *Disclaimer:* This is simulated demo data for prototype evaluation only.\n\nSend *MENU* to return to the main menu.`,
      menuOptions: MAIN_MENU_OPTIONS,
      state: session.state
    };
  }

  // Option 5: Payment Status
  if (input === '5' || lowerInput.includes('payment status')) {
    const farmerName = session.farmer.name || 'Demo Farmer';
    return {
      reply: `💰 *Payment Status (Simulated Demo Data)*\n\n• Farmer ID: ${session.farmerId}\n• Farmer Name: ${farmerName}\n• Linked Lot: LOT-NSK-9281 (Simulated)\n• Quantity: 42.5 Quintals @ ₹2,450/Qtl (Simulated Demo Rate)\n• Total Amount Payable: ₹1,04,125\n• Payment Mode: Direct Benefit Transfer (DBT - Demo)\n• Payment Status: *Processing (Demo - Expected within 48 hours)*\n• Simulated UTR: UTR-NSK-20261026-9817\n\n⚠️ *Disclaimer:* This is simulated demo data. Krishi-Line does not process real banking transactions or government disbursements in this prototype.\n\nSend *MENU* to return to the main menu.`,
      menuOptions: MAIN_MENU_OPTIONS,
      state: session.state
    };
  }

  // Option 6: Help
  if (input === '6' || lowerInput.includes('help')) {
    return {
      reply: `ℹ️ *Krishi-Line Help & Guidance (Demo)*\n\nKrishi-Line assists onion farmers across Nashik with transparent procurement slot scheduling and status tracking.\n\n*How to Use:*\n• Reply with a number (1 - 6) to choose an option.\n• Send *MENU* at any time to return to the main options.\n• Send *Hi*, *Hello*, or *Namaste* to see the welcome screen.\n\n*Main Options:*\n1. Farmer Registration\n2. Book a Procurement Slot\n3. My Booking\n4. Procurement Status\n5. Payment Status\n6. Help\n\n*Demo Support:* Nashik APMC Farmer Assistance Desk (Toll-Free Demo: 1800-000-KRISHI).\n\nSend *MENU* to return to the main menu.`,
      menuOptions: MAIN_MENU_OPTIONS,
      state: session.state
    };
  }

  // Unrecognized input in Main Menu
  return {
    reply: `❓ Unrecognized choice: "${input}".\n\nPlease reply with a number from 1 to 6, or send *MENU* to see all options.`,
    menuOptions: MAIN_MENU_OPTIONS,
    state: session.state
  };
}

/**
 * Step 1: Collect Name
 */
function handleRegName(session, input) {
  if (!input || input.length < 2) {
    return {
      reply: `Please enter a valid full name (at least 2 characters):\n(Or send *MENU* to cancel)`,
      menuOptions: ['Send MENU to cancel'],
      state: session.state
    };
  }

  session.tempRegistration.name = input;
  session.state = 'REG_VILLAGE';
  return {
    reply: `Thank you, ${input}.\n\nPlease enter your village name (e.g., Lasalgaon, Pimpalgaon, Chandwad):`,
    menuOptions: ['Send MENU to cancel'],
    state: session.state
  };
}

/**
 * Step 2: Collect Village
 */
function handleRegVillage(session, input) {
  if (!input || input.length < 2) {
    return {
      reply: `Please enter a valid village name:\n(Or send *MENU* to cancel)`,
      menuOptions: ['Send MENU to cancel'],
      state: session.state
    };
  }

  session.tempRegistration.village = input;
  session.state = 'REG_DISTRICT';
  return {
    reply: `Village noted: ${input}.\n\nPlease enter your district (e.g., Nashik):`,
    menuOptions: ['Send MENU to cancel'],
    state: session.state
  };
}

/**
 * Step 3: Collect District
 */
function handleRegDistrict(session, input) {
  if (!input || input.length < 2) {
    return {
      reply: `Please enter a valid district name:\n(Or send *MENU* to cancel)`,
      menuOptions: ['Send MENU to cancel'],
      state: session.state
    };
  }

  session.tempRegistration.district = input;
  session.state = 'REG_CONFIRM';
  return {
    reply: `📋 *Registration Summary (Demo)*\n\n• Name: ${session.tempRegistration.name}\n• Village: ${session.tempRegistration.village}\n• District: ${session.tempRegistration.district}\n\n⚠️ *Notice:* This is a prototype demo registration. No real government land records are modified.\n\nPlease confirm your registration:\n1. Yes, Confirm\n2. No, Cancel\n\nReply *1* to confirm or *2* to cancel:`,
    menuOptions: ['1. Yes, Confirm', '2. No, Cancel'],
    state: session.state
  };
}

/**
 * Step 4: Confirm Registration with MongoDB Persistence
 */
async function handleRegConfirm(session, lowerInput) {
  if (['1', 'yes', 'confirm', 'y'].includes(lowerInput)) {
    // Persist in MongoDB
    const saved = await farmerService.saveFarmer({
      farmerId: session.farmerId,
      name: session.tempRegistration.name,
      village: session.tempRegistration.village,
      district: session.tempRegistration.district
    });

    session.farmer.registered = true;
    session.farmer.name = saved.name;
    session.farmer.village = saved.village;
    session.farmer.district = saved.district;
    session.farmer.registeredAt = saved.registeredAt;
    session.tempRegistration = {};
    session.state = 'MAIN_MENU';

    return {
      reply: `✅ *Registration Successful! (Demo)*\n\nWelcome to Krishi-Line, ${session.farmer.name} from ${session.farmer.village}, ${session.farmer.district}.\nYour profile has been saved for demo procurement.\n\nYou can now proceed to book a procurement slot.\n\nReply *2* to Book a Procurement Slot, or send *MENU* to view all options.`,
      menuOptions: ['2. Book a Procurement Slot', 'MENU'],
      state: session.state
    };
  }

  if (['2', 'no', 'cancel', 'n'].includes(lowerInput)) {
    session.tempRegistration = {};
    session.state = 'MAIN_MENU';
    return {
      reply: `❌ Registration cancelled.\n\nSend *MENU* to return to the main menu.`,
      menuOptions: MAIN_MENU_OPTIONS,
      state: session.state
    };
  }

  return {
    reply: `Please reply *1* to Confirm your registration, *2* to Cancel, or send *MENU* to return to the main menu.`,
    menuOptions: ['1. Yes, Confirm', '2. No, Cancel', 'MENU'],
    state: session.state
  };
}

/**
 * Step 1 of Booking: Select Centre
 */
async function handleBookCentre(session, input) {
  const centreChoice = parseInt(input, 10);
  const selectedCentre = CENTRES.find((c) => c.id === centreChoice);

  if (!selectedCentre) {
    return {
      reply: `Invalid centre selection. Please reply with *1*, *2*, or *3* to choose a centre, or send *MENU* to cancel:`,
      menuOptions: CENTRES.map((c) => `${c.id}. ${c.name}`),
      state: session.state
    };
  }

  session.tempBooking.centreId = selectedCentre.id;
  session.tempBooking.centreName = `${selectedCentre.name} (${selectedCentre.location})`;
  session.state = 'BOOK_SLOT';

  // Read current slot capacity from database
  let slots = [];
  try {
    slots = await slotService.getCentreSlots(selectedCentre.id);
  } catch (err) {
    console.warn('Could not read slots from DB, using fallback defaults:', err.message);
  }

  if (!slots || slots.length === 0) {
    slots = selectedCentre.slots.map((s) => ({
      slotId: s.id,
      date: s.date,
      time: s.time,
      label: s.label,
      capacity: s.capacity || 2,
      bookedCount: 0
    }));
  }

  const slotsList = slots
    .map((s) => {
      const remaining = Math.max(0, s.capacity - s.bookedCount);
      const statusBadge = remaining === 0 ? '[FULLY BOOKED]' : `[${remaining} spots open]`;
      return `${s.slotId}. ${s.date} | ${s.time} (${s.label}) ${statusBadge}`;
    })
    .join('\n');

  return {
    reply: `Selected: *${selectedCentre.name}*\n\nPlease choose an available 4-hour procurement slot:\n\n${slotsList}\n\nReply with slot number (1 to ${slots.length}), or send *MENU* to cancel:`,
    menuOptions: slots.map((s) => `${s.slotId}. ${s.date} - ${s.label}`),
    state: session.state
  };
}

/**
 * Step 2 of Booking: Select Slot
 */
async function handleBookSlot(session, input) {
  const centre = CENTRES.find((c) => c.id === session.tempBooking.centreId);
  if (!centre) {
    session.state = 'BOOK_CENTRE';
    return {
      reply: `Centre session expired. Please select a procurement centre again (1, 2, or 3):`,
      menuOptions: CENTRES.map((c) => `${c.id}. ${c.name}`),
      state: session.state
    };
  }

  const slotChoice = parseInt(input, 10);
  const selectedSlot = centre.slots.find((s) => s.id === slotChoice);

  if (!selectedSlot) {
    return {
      reply: `Invalid slot selection. Please reply with a number between 1 and ${centre.slots.length}, or send *MENU* to cancel:`,
      menuOptions: centre.slots.map((s) => `${s.id}. ${s.date} - ${s.label}`),
      state: session.state
    };
  }

  // Pre-check slot capacity
  try {
    const slots = await slotService.getCentreSlots(centre.id);
    const dbSlot = slots.find((s) => s.slotId === slotChoice);
    if (dbSlot && dbSlot.bookedCount >= dbSlot.capacity) {
      return {
        reply: `⚠️ The slot "${selectedSlot.date} | ${selectedSlot.time}" is currently fully booked.\n\nPlease select another slot, or send *MENU* to cancel:`,
        menuOptions: centre.slots.map((s) => `${s.id}. ${s.date} - ${s.label}`),
        state: session.state
      };
    }
  } catch (err) {
    console.warn('Capacity pre-check error:', err.message);
  }

  session.tempBooking.slotId = selectedSlot.id;
  session.tempBooking.slotText = `${selectedSlot.date} | ${selectedSlot.time} (${selectedSlot.label})`;
  session.state = 'BOOK_CONFIRM';

  return {
    reply: `📦 *Booking Summary (Demo)*\n\n• Farmer: ${session.farmer.name}\n• Location: ${session.farmer.village}, ${session.farmer.district}\n• Centre: ${session.tempBooking.centreName}\n• Slot: ${session.tempBooking.slotText}\n\n⚠️ *Notice:* This is a simulated demo slot reservation. No real mandi quota is allocated.\n\nPlease confirm your slot booking:\n1. Yes, Confirm Booking\n2. No, Cancel\n\nReply *1* to confirm or *2* to cancel:`,
    menuOptions: ['1. Yes, Confirm Booking', '2. No, Cancel'],
    state: session.state
  };
}

/**
 * Step 3 of Booking: Confirm Booking with Atomic MongoDB Reservation
 */
async function handleBookConfirm(session, lowerInput) {
  if (['1', 'yes', 'confirm', 'y'].includes(lowerInput)) {
    // 1. Atomic reservation in MongoDB to guarantee no overbooking
    const reservedSlot = await slotService.reserveSlotAtomic(
      session.tempBooking.centreId,
      session.tempBooking.slotId
    );

    if (!reservedSlot) {
      session.state = 'BOOK_SLOT';
      return {
        reply: `⚠️ We apologize, but this slot was just filled to capacity by another booking.\n\nPlease select another slot, or send *MENU* to cancel:`,
        menuOptions: ['Send MENU to return to main menu'],
        state: session.state
      };
    }

    // 2. Persist booking in MongoDB
    let bookingDoc;
    try {
      bookingDoc = await bookingService.createBooking({
        farmerId: session.farmerId,
        centreId: session.tempBooking.centreId,
        centreName: session.tempBooking.centreName,
        slotId: session.tempBooking.slotId,
        slotText: session.tempBooking.slotText,
        status: 'CONFIRMED'
      });
    } catch (bookingErr) {
      // Rollback the slot capacity increment if booking record creation fails
      await slotService.releaseSlotAtomic(
        session.tempBooking.centreId,
        session.tempBooking.slotId
      );
      throw bookingErr;
    }

    session.latestBooking = bookingDoc;
    session.tempBooking = {};
    session.state = 'MAIN_MENU';

    return {
      reply: `🎉 *Procurement Slot Confirmed! (Demo)*\n\n• Booking ID: *${bookingDoc.bookingId}*\n• Centre: ${bookingDoc.centreName}\n• Slot: ${bookingDoc.slotText}\n• Booking Status: *CONFIRMED (Simulated Demo)*\n• QR Token Status: *${bookingDoc.qrTokenStatus || 'ACTIVE'}*\n• QR Pass Reference: *${bookingDoc.qrRelativeUrl || `/qrcodes/${bookingDoc.bookingId}.png`}*\n• Farmer: ${session.farmer.name}\n\nℹ️ *Prototype Notice:* A verification QR pass has been generated locally. In the future WhatsApp integration, this QR code image will be sent directly to your chat. No real procurement centre scanning is active in this prototype.\n\nPlease arrive during your scheduled 4-hour window with your onion produce.\n\nReply *3* to view My Booking, or send *MENU* to return to the main menu.`,
      menuOptions: ['3. My Booking', 'MENU'],
      state: session.state
    };
  }

  if (['2', 'no', 'cancel', 'n'].includes(lowerInput)) {
    session.tempBooking = {};
    session.state = 'MAIN_MENU';
    return {
      reply: `❌ Slot booking cancelled.\n\nSend *MENU* to return to the main menu.`,
      menuOptions: MAIN_MENU_OPTIONS,
      state: session.state
    };
  }

  return {
    reply: `Please reply *1* to Confirm your booking, *2* to Cancel, or send *MENU* to return to the main menu.`,
    menuOptions: ['1. Yes, Confirm Booking', '2. No, Cancel', 'MENU'],
    state: session.state
  };
}

module.exports = {
  processMessage,
  MAIN_MENU_TEXT,
  MAIN_MENU_OPTIONS
};

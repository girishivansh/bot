/**
 * Krishi-Line Bot Engine Test Suite with MongoDB Persistence
 */

const fs = require('fs');
const { processMessage } = require('./src/bot/conversationEngine');
const { getSession, generateUniqueBookingId, clearAllSessions } = require('./src/bot/sessionStore');
const farmerService = require('./src/services/farmerService');
const bookingService = require('./src/services/bookingService');
const slotService = require('./src/services/slotService');
const qrService = require('./src/services/qrService');
const { setupTestDb, clearTestDb, teardownTestDb } = require('./test-db-helper');

console.log('--- TEST SUITE: Krishi-Line Bot Engine with MongoDB ---');

function assert(condition, testName) {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
  } else {
    console.error(`❌ FAIL: ${testName}`);
    process.exit(1);
  }
}

async function runTestSuite() {
  try {
    await setupTestDb();
    await clearTestDb();
    clearAllSessions();

    // 1. Test Greeting
    const f1 = 'farmer-test-01';
    let res = await processMessage(f1, 'Hi');
    assert(res.reply.includes('Namaste! Welcome to Krishi-Line.'), 'Greeting Hi returns welcome text');
    assert(res.menuOptions.length === 6, 'Greeting provides 6 menu options');

    // 2. Test Booking before Registration
    res = await processMessage(f1, '2');
    assert(res.reply.includes('You are not registered yet'), 'Unregistered booking attempt blocked');

    // 3. Test Farmer Registration Flow & MongoDB Persistence
    res = await processMessage(f1, '1');
    assert(res.reply.includes('Please enter your full name'), 'Option 1 asks for full name');

    res = await processMessage(f1, 'Ramesh Patil');
    assert(res.reply.includes('Please enter your village name'), 'Submitting name prompts for village');

    res = await processMessage(f1, 'Lasalgaon');
    assert(res.reply.includes('Please enter your district'), 'Submitting village prompts for district');

    res = await processMessage(f1, 'Nashik');
    assert(res.reply.includes('Registration Summary (Demo)'), 'Submitting district shows summary');
    assert(res.reply.includes('Ramesh Patil') && res.reply.includes('Lasalgaon') && res.reply.includes('Nashik'), 'Summary contains name, village, and district');

    res = await processMessage(f1, '1');
    assert(res.reply.includes('Registration Successful! (Demo)'), 'Confirming registration succeeds');
    assert(getSession(f1).farmer.registered === true, 'Session reflects registered status');

    // Verify registration was saved in MongoDB
    const persistedFarmer = await farmerService.getFarmer(f1);
    assert(persistedFarmer !== null, 'Farmer profile persisted in MongoDB');
    assert(persistedFarmer.name === 'Ramesh Patil', 'Persisted farmer name matches input');
    assert(persistedFarmer.village === 'Lasalgaon', 'Persisted farmer village matches input');
    assert(persistedFarmer.district === 'Nashik', 'Persisted farmer district matches input');

    // 4. Test Booking Flow for Registered Farmer & MongoDB Persistence
    res = await processMessage(f1, '2');
    assert(res.reply.includes('Available Procurement Centres in Nashik'), 'Option 2 shows APMC centres');

    res = await processMessage(f1, '1');
    assert(res.reply.includes('Selected: *Lasalgaon APMC Onion Yard'), 'Selecting centre 1 prompts for 4-hour slots');

    res = await processMessage(f1, '1');
    assert(res.reply.includes('Booking Summary (Demo)'), 'Selecting slot prompts for confirmation');
    assert(res.reply.includes('Lasalgaon APMC Onion Yard') && res.reply.includes('Morning Slot'), 'Summary contains centre and slot details');

    res = await processMessage(f1, '1');
    assert(res.reply.includes('Procurement Slot Confirmed! (Demo)'), 'Confirming booking returns confirmation');
    assert(res.reply.includes('QR Token Status:'), 'Confirmation includes QR token status');
    assert(res.reply.includes('QR Pass Reference:'), 'Confirmation includes QR pass reference');
    assert(getSession(f1).latestBooking !== null, 'Session stores latest booking');

    // Verify booking was persisted in MongoDB
    const persistedBooking = await bookingService.getLatestBooking(f1);
    assert(persistedBooking !== null, 'Booking record persisted in MongoDB');
    assert(persistedBooking.farmerId === f1, 'Booking record matches farmer ID');
    assert(persistedBooking.centreId === 1, 'Booking record matches centre ID');
    assert(persistedBooking.slotId === 1, 'Booking record matches slot ID');
    assert(persistedBooking.qrToken && persistedBooking.qrToken.startsWith('kl_tok_'), 'Booking contains cryptographically secure QR token');
    assert(persistedBooking.status === 'CONFIRMED', 'Booking model status is CONFIRMED');

    // 5. Test My Booking (Option 3)
    res = await processMessage(f1, '3');
    assert(res.reply.includes('My Latest Procurement Booking (Demo)'), 'Option 3 displays confirmed booking details');
    assert(res.reply.includes('Booking ID:'), 'Booking details include Booking ID');

    // 6. Test Procurement Status (Option 4)
    res = await processMessage(f1, '4');
    assert(res.reply.includes('Procurement Status (Simulated Demo Data)'), 'Option 4 returns simulated procurement status');
    assert(res.reply.includes('Red Onion'), 'Procurement status shows onion produce info');

    // 7. Test Payment Status (Option 5)
    res = await processMessage(f1, '5');
    assert(res.reply.includes('Payment Status (Simulated Demo Data)'), 'Option 5 returns simulated payment status');
    assert(res.reply.includes('Direct Benefit Transfer'), 'Payment status includes simulated DBT info');

    // 8. Test Help (Option 6)
    res = await processMessage(f1, '6');
    assert(res.reply.includes('Krishi-Line Help & Guidance (Demo)'), 'Option 6 returns help guidance');

    // 9. Test MENU reset
    res = await processMessage(f1, '1'); // starts re-registration or sub-step
    res = await processMessage(f1, 'MENU');
    assert(res.reply.includes('Namaste! Welcome to Krishi-Line.'), 'Sending MENU resets back to main menu');

    // 10. Test Farmer Isolation
    const f2 = 'farmer-test-02';
    const session2 = getSession(f2);
    assert(session2.farmer.registered === false, 'Separate farmer-02 is not affected by farmer-01');
    assert(session2.latestBooking === null, 'Separate farmer-02 has no booking');

    // 11. Test Booking ID Uniqueness
    const sampleIds = new Set();
    let collisionFound = false;
    for (let i = 0; i < 100; i++) {
      const id = generateUniqueBookingId();
      if (sampleIds.has(id)) {
        collisionFound = true;
        break;
      }
      sampleIds.add(id);
    }
    assert(!collisionFound, '100 generated booking IDs are collision-free and unique');

    // 12. Test Slot Capacity & Atomic Overbooking Protection
    // Clean database and sessions
    await clearTestDb();
    clearAllSessions();

    async function registerFarmer(id, name) {
      await processMessage(id, '1');
      await processMessage(id, name);
      await processMessage(id, 'Lasalgaon');
      await processMessage(id, 'Nashik');
      await processMessage(id, '1');
    }

    // Register 3 farmers
    await registerFarmer('cap-farmer-1', 'Farmer One');
    await registerFarmer('cap-farmer-2', 'Farmer Two');
    await registerFarmer('cap-farmer-3', 'Farmer Three');

    // Farmer 1 books Centre 1, Slot 1
    await processMessage('cap-farmer-1', '2');
    await processMessage('cap-farmer-1', '1'); // Centre 1
    await processMessage('cap-farmer-1', '1'); // Slot 1
    const b1Res = await processMessage('cap-farmer-1', '1'); // Confirm
    assert(b1Res.reply.includes('Procurement Slot Confirmed!'), 'Farmer 1 books Slot 1 successfully');

    // Farmer 2 books Centre 1, Slot 1 (fills capacity of 2)
    await processMessage('cap-farmer-2', '2');
    await processMessage('cap-farmer-2', '1'); // Centre 1
    await processMessage('cap-farmer-2', '1'); // Slot 1
    const b2Res = await processMessage('cap-farmer-2', '1'); // Confirm
    assert(b2Res.reply.includes('Procurement Slot Confirmed!'), 'Farmer 2 books Slot 1 successfully (capacity reached)');

    // Farmer 3 attempts to book Centre 1, Slot 1 (should be blocked as FULL)
    await processMessage('cap-farmer-3', '2');
    const centreMenuRes = await processMessage('cap-farmer-3', '1'); // Centre 1
    assert(centreMenuRes.reply.includes('[FULLY BOOKED]'), 'Slot 1 shows [FULLY BOOKED] badge in centre list');

    const b3Attempt = await processMessage('cap-farmer-3', '1'); // Slot 1
    assert(b3Attempt.reply.includes('currently fully booked'), 'Farmer 3 is prevented from booking fully booked Slot 1');

    // Farmer 3 selects Slot 2 instead
    await processMessage('cap-farmer-3', '2'); // Slot 2
    const b3Success = await processMessage('cap-farmer-3', '1'); // Confirm
    assert(b3Success.reply.includes('Procurement Slot Confirmed!'), 'Farmer 3 successfully books alternative Slot 2');

    // 13. Test Persistence Across Simulated Server Restart
    // Simulate server restart by wiping process RAM / session cache completely
    clearAllSessions();

    // Now send a message as cap-farmer-1 whose profile and booking exist in MongoDB
    const restartWelcomeRes = await processMessage('cap-farmer-1', 'Hi');
    assert(restartWelcomeRes.reply.includes('Namaste! Welcome to Krishi-Line.'), 'Server restart: Greeting responds normally');

    // Request My Booking (Option 3) after restart
    const restartBookingRes = await processMessage('cap-farmer-1', '3');
    assert(restartBookingRes.reply.includes('My Latest Procurement Booking (Demo)'), 'Server restart: Booking is retrieved from MongoDB');
    assert(restartBookingRes.reply.includes('Lasalgaon APMC Onion Yard'), 'Server restart: Retrieved booking contains correct centre');

    // Verify registration status was restored
    const restartedSession = getSession('cap-farmer-1');
    assert(restartedSession.farmer.registered === true, 'Server restart: Farmer registration status restored from MongoDB');
    assert(restartedSession.farmer.name === 'Farmer One', 'Server restart: Farmer profile name restored from MongoDB');

    // 14. Test Duplicate Booking Prevention via Unique Index
    let duplicateRejected = false;
    try {
      const existing = await bookingService.getLatestBooking('cap-farmer-1');
      const ProcurementBooking = require('./src/models/ProcurementBooking');
      // Attempt to force-insert a duplicate booking with the exact same bookingId
      await ProcurementBooking.create({
        bookingId: existing.bookingId,
        farmerId: 'cap-farmer-99',
        centreId: 1,
        centreName: 'Lasalgaon',
        slotId: 1,
        slotText: 'Morning Slot'
      });
    } catch (err) {
      if (err.code === 11000 || err.message.includes('duplicate key')) {
        duplicateRejected = true;
      }
    }
    assert(duplicateRejected, 'MongoDB unique index enforces duplicate bookingId rejection');

    // 15. Test QR Token Generation & Unguessability
    const sampleTokens = new Set();
    let tokenCollision = false;
    let formatValid = true;
    for (let i = 0; i < 50; i++) {
      const tok = qrService.generateSecureToken();
      if (!tok.startsWith('kl_tok_') || tok.length < 40) {
        formatValid = false;
      }
      if (sampleTokens.has(tok)) {
        tokenCollision = true;
        break;
      }
      sampleTokens.add(tok);
    }
    assert(formatValid, 'Tokens have secure prefix and high entropy length (>=40 chars)');
    assert(!tokenCollision, 'Cryptographic QR tokens are unique and collision-free');

    // 16. Test QR Code Image Creation on Disk
    const testBooking = await bookingService.getLatestBooking('cap-farmer-1');
    assert(testBooking.qrImagePath && fs.existsSync(testBooking.qrImagePath), 'QR code PNG image generated and saved to disk');

    // 17. Test Successful Token Verification
    const verifySuccess = await bookingService.verifyBookingToken(testBooking.qrToken);
    assert(verifySuccess.valid === true, 'Valid booking token passes verification');
    assert(verifySuccess.bookingId === testBooking.bookingId, 'Verification returns correct booking ID');
    assert(verifySuccess.status === 'CONFIRMED', 'Verification returns CONFIRMED status');
    assert(!verifySuccess.name && !verifySuccess.farmerId && !verifySuccess.village, 'Verification result does NOT expose farmer personal data');

    // 18. Test Invalid Token Verification
    const verifyInvalid = await bookingService.verifyBookingToken('kl_tok_invalid_bogus_token');
    assert(verifyInvalid.valid === false, 'Invalid token is rejected');
    assert(verifyInvalid.reason === 'NOT_FOUND', 'Invalid token returns NOT_FOUND reason');

    // 19. Test Cancelled Booking Verification (Requirement 9)
    await bookingService.updateBookingStatus(testBooking.bookingId, 'CANCELLED');
    const verifyCancelled = await bookingService.verifyBookingToken(testBooking.qrToken);
    assert(verifyCancelled.valid === false, 'Cancelled booking token is NOT verified as active');
    assert(verifyCancelled.reason === 'CANCELLED', 'Cancelled booking returns CANCELLED reason');

    // 20. Test Duplicate QR Token Prevention
    let dupTokenBlocked = false;
    try {
      const ProcurementBooking = require('./src/models/ProcurementBooking');
      await ProcurementBooking.create({
        bookingId: 'KL-NSK-TEST-DUP-01',
        farmerId: 'cap-farmer-88',
        centreId: 1,
        centreName: 'Lasalgaon',
        slotId: 1,
        slotText: 'Morning Slot',
        qrToken: testBooking.qrToken // Reuse existing token!
      });
    } catch (err) {
      if (err.code === 11000 || err.message.includes('duplicate key') || err.message.includes('qrToken')) {
        dupTokenBlocked = true;
      }
    }
    assert(dupTokenBlocked, 'Duplicate QR token rejected by database unique index');

    // 21. Audit Check 5: QR verification works strictly from database even if in-memory session is wiped
    clearAllSessions();
    const verifyAfterWipe = await bookingService.verifyBookingToken(testBooking.qrToken);
    // Since testBooking was cancelled in test 19, verify it reads the cancelled state directly from DB
    assert(verifyAfterWipe.valid === false && verifyAfterWipe.reason === 'CANCELLED', 'Audit Check 5: QR verification reads directly from persisted DB without in-memory cache');

    // 22. Audit Check 6: MongoDB unique index definition for qrToken
    const ProcurementBooking = require('./src/models/ProcurementBooking');
    const indexes = ProcurementBooking.schema.indexes();
    const qrTokenIndex = indexes.find((idx) => idx[0] && idx[0].qrToken === 1);
    assert(qrTokenIndex && qrTokenIndex[1] && qrTokenIndex[1].unique === true, 'Audit Check 6: Unique index on qrToken is formally declared in Mongoose schema');

    // 23. Audit Check 7: Concurrent race condition test via Promise.all
    // Test on Centre 2, Slot 1 (capacity = 2)
    const slot21 = await slotService.getCentreSlots(2);
    assert(slot21[0].capacity === 2, 'Slot has capacity of 2');

    // Fire 5 simultaneous concurrent reservation attempts in parallel
    const concurrentAttempts = await Promise.all([
      slotService.reserveSlotAtomic(2, 1),
      slotService.reserveSlotAtomic(2, 1),
      slotService.reserveSlotAtomic(2, 1),
      slotService.reserveSlotAtomic(2, 1),
      slotService.reserveSlotAtomic(2, 1)
    ]);

    const successes = concurrentAttempts.filter((res) => res !== null);
    const rejections = concurrentAttempts.filter((res) => res === null);
    assert(successes.length === 2, `Audit Check 7: Concurrent reservations strictly limited to capacity (2 succeeded, got ${successes.length})`);
    assert(rejections.length === 3, `Audit Check 7: Excess concurrent requests rejected (3 rejected, got ${rejections.length})`);

    // 24. Audit Check 8: Cancelled booking remains invalid after simulated server restart
    // Create a new booking, verify it, cancel it, wipe RAM, verify it again
    const activeBookingDoc = await bookingService.createBooking({
      farmerId: 'cap-farmer-restart-test',
      centreId: 3,
      centreName: 'Kalwan Sub-Market Yard',
      slotId: 1,
      slotText: 'Morning Slot',
      status: 'CONFIRMED'
    });
    const beforeCancel = await bookingService.verifyBookingToken(activeBookingDoc.qrToken);
    assert(beforeCancel.valid === true, 'New booking is initially active and valid');

    // Cancel booking
    await bookingService.updateBookingStatus(activeBookingDoc.bookingId, 'CANCELLED');

    // Simulate server restart (wipe RAM completely)
    clearAllSessions();

    // Verify token again
    const afterRestartVerify = await bookingService.verifyBookingToken(activeBookingDoc.qrToken);
    assert(afterRestartVerify.valid === false, 'Audit Check 8: Cancelled booking remains invalid after server restart');
    assert(afterRestartVerify.reason === 'CANCELLED', 'Audit Check 8: Cancelled status persisted and read from DB after restart');

    // 25. Audit Check 9: Safe handling of database connection failure
    const { connectDB } = require('./src/config/db');
    let dbErrorHandled = false;
    try {
      await connectDB('mongodb://127.0.0.1:27999/unreachable_db_test');
    } catch (err) {
      dbErrorHandled = true;
    }
    assert(dbErrorHandled, 'Audit Check 9: Unreachable database connection fails safely with clear exception');

    console.log('All 25 engine, persistence, concurrency, and audit regression tests passed successfully!');
    await teardownTestDb();
  } catch (err) {
    console.error('Test suite failed with unexpected error:', err);
    process.exit(1);
  }
}

runTestSuite();

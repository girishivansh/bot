const path = require('path');
const express = require('express');
const botRoutes = require('./src/routes/botRoutes');
const bookingRoutes = require('./src/routes/bookingRoutes');
const bookingService = require('./src/services/bookingService');
const { setupTestDb, clearTestDb, teardownTestDb } = require('./test-db-helper');

const app = express();
app.use(express.json());

// Health route
app.get('/health', (req, res) => {
  res.status(200).json({ success: true, service: 'Krishi-Line Bot Backend', status: 'healthy' });
});

// Bot routes
app.use('/api/bot', botRoutes);

// Booking verification routes
app.use('/api/bookings', bookingRoutes);

// WhatsApp Simulator static UI
app.use('/simulator', express.static(path.join(process.cwd(), 'public', 'simulator')));

// 404 & error handlers
app.use((req, res) => res.status(404).json({ success: false, message: 'Not found' }));
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ success: false, message: 'Invalid JSON payload received.' });
  }
  res.status(500).json({ success: false, message: 'Server error' });
});

async function runHttpTests() {
  await setupTestDb();
  await clearTestDb();

  const server = app.listen(3999, async () => {
    console.log('HTTP Test Server running on port 3999');

    try {
      const BASE_URL = 'http://localhost:3999';

      // 1. Health check
      const healthRes = await fetch(`${BASE_URL}/health`);
      const healthData = await healthRes.json();
      console.assert(healthRes.status === 200 && healthData.success === true, 'Health check passed');
      console.log('✅ PASS: Health check endpoint returned 200');

      // 2. Validation error - missing farmerId
      const valRes1 = await fetch(`${BASE_URL}/api/bot/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Hi' })
      });
      console.assert(valRes1.status === 400, 'Missing farmerId rejected with 400');
      console.log('✅ PASS: Missing farmerId correctly rejected with 400 Bad Request');

      // 3. Validation error - missing message
      const valRes2 = await fetch(`${BASE_URL}/api/bot/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ farmerId: 'farmer-001' })
      });
      console.assert(valRes2.status === 400, 'Missing message rejected with 400');
      console.log('✅ PASS: Missing message correctly rejected with 400 Bad Request');

      // 3b. Regression test: Request body is Array or non-object
      const arrayBodyRes = await fetch(`${BASE_URL}/api/bot/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(['invalid', 'array', 'body'])
      });
      console.assert(arrayBodyRes.status === 400, 'Array body rejected with 400');
      console.log('✅ PASS: Array body safely rejected with 400 Bad Request without crashing');

      // 4. Greeting
      const greetRes = await fetch(`${BASE_URL}/api/bot/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ farmerId: 'farmer-http-01', message: 'Namaste' })
      });
      const greetData = await greetRes.json();
      console.assert(greetRes.status === 200 && greetData.reply.includes('Namaste! Welcome to Krishi-Line.'), 'Greeting passed');
      console.log('✅ PASS: POST /api/bot/message greeting returned 200 with menu');

      // 5. Help query
      const helpRes = await fetch(`${BASE_URL}/api/bot/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ farmerId: 'farmer-http-01', message: '6' })
      });
      const helpData = await helpRes.json();
      console.assert(helpRes.status === 200 && helpData.reply.includes('Krishi-Line Help & Guidance'), 'Help query passed');
      console.log('✅ PASS: Option 6 returned help details');

      // 6. Registration through HTTP
      await fetch(`${BASE_URL}/api/bot/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ farmerId: 'farmer-http-reg', message: '1' })
      });
      await fetch(`${BASE_URL}/api/bot/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ farmerId: 'farmer-http-reg', message: 'Balasaheb Shinde' })
      });
      await fetch(`${BASE_URL}/api/bot/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ farmerId: 'farmer-http-reg', message: 'Chandwad' })
      });
      await fetch(`${BASE_URL}/api/bot/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ farmerId: 'farmer-http-reg', message: 'Nashik' })
      });
      const confirmRegRes = await fetch(`${BASE_URL}/api/bot/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ farmerId: 'farmer-http-reg', message: '1' })
      });
      const confirmRegData = await confirmRegRes.json();
      console.assert(confirmRegData.reply.includes('Registration Successful!'), 'HTTP registration confirmed');
      console.log('✅ PASS: Farmer registration completed successfully over HTTP');

      // 7. Booking through HTTP
      await fetch(`${BASE_URL}/api/bot/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ farmerId: 'farmer-http-reg', message: '2' })
      });
      await fetch(`${BASE_URL}/api/bot/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ farmerId: 'farmer-http-reg', message: '1' })
      });
      await fetch(`${BASE_URL}/api/bot/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ farmerId: 'farmer-http-reg', message: '1' })
      });
      const bookingConfirmRes = await fetch(`${BASE_URL}/api/bot/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ farmerId: 'farmer-http-reg', message: '1' })
      });
      const bookingConfirmData = await bookingConfirmRes.json();
      console.assert(bookingConfirmData.reply.includes('Procurement Slot Confirmed!'), 'HTTP booking confirmed');
      console.assert(bookingConfirmData.reply.includes('QR Token Status:'), 'HTTP confirmation contains QR token status');
      console.log('✅ PASS: Procurement slot booked with QR token via HTTP');

      // 8. Verification endpoint validation - missing token
      const verifyNoTokenRes = await fetch(`${BASE_URL}/api/bookings/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      console.assert(verifyNoTokenRes.status === 400, 'Verify endpoint rejected missing token with 400');
      console.log('✅ PASS: POST /api/bookings/verify rejected missing token with 400');

      // 9. Verification endpoint - invalid/unknown token
      const verifyInvalidRes = await fetch(`${BASE_URL}/api/bookings/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'kl_tok_nonexistent_xyz_999' })
      });
      console.assert(verifyInvalidRes.status === 404, 'Verify endpoint returned 404 for non-existent token');
      const verifyInvalidData = await verifyInvalidRes.json();
      console.assert(verifyInvalidData.valid === false, 'Invalid token returns valid: false');
      console.log('✅ PASS: POST /api/bookings/verify returned 404 for unknown token');

      // 10. Verification endpoint - valid token
      const httpFarmerBooking = await bookingService.getLatestBooking('farmer-http-reg');
      console.assert(httpFarmerBooking && httpFarmerBooking.qrToken, 'Booking record has QR token');

      const verifyValidRes = await fetch(`${BASE_URL}/api/bookings/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: httpFarmerBooking.qrToken })
      });
      console.assert(verifyValidRes.status === 200, 'Valid token returned 200 OK');
      const verifyValidData = await verifyValidRes.json();
      console.assert(verifyValidData.valid === true, 'Verification returns valid: true');
      console.assert(verifyValidData.bookingId === httpFarmerBooking.bookingId, 'Verification matches booking ID');
      console.assert(verifyValidData.status === 'CONFIRMED', 'Verification confirms active status');
      console.assert(!verifyValidData.farmerId && !verifyValidData.name, 'Verification does not leak personal data');
      console.log('✅ PASS: POST /api/bookings/verify successfully verified active booking');

      // 11. Verification endpoint - cancelled booking
      await fetch(`${BASE_URL}/api/bookings/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: httpFarmerBooking.bookingId, status: 'CANCELLED' })
      });

      const verifyCancelledRes = await fetch(`${BASE_URL}/api/bookings/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: httpFarmerBooking.qrToken })
      });
      console.assert(verifyCancelledRes.status === 400, 'Cancelled token rejected with 400');
      const verifyCancelledData = await verifyCancelledRes.json();
      console.assert(verifyCancelledData.valid === false, 'Cancelled token returns valid: false');
      console.assert(verifyCancelledData.status === 'CANCELLED', 'Cancelled token indicates CANCELLED status');
      console.log('✅ PASS: POST /api/bookings/verify correctly refused cancelled booking token');

      // 12. Latest booking endpoint check
      const latestBookingRes = await fetch(`${BASE_URL}/api/bookings/latest/farmer-http-reg`);
      console.assert(latestBookingRes.status === 200, 'Latest booking endpoint returned 200');
      const latestBookingData = await latestBookingRes.json();
      console.assert(latestBookingData.success === true && latestBookingData.booking.bookingId === httpFarmerBooking.bookingId, 'Latest booking endpoint returned expected booking');
      console.log('✅ PASS: GET /api/bookings/latest/:farmerId returned booking');

      // 13. Simulator Web Interface Delivery
      const simHtmlRes = await fetch(`${BASE_URL}/simulator/index.html`);
      console.assert(simHtmlRes.status === 200, 'Simulator index.html returned 200 OK');
      const simHtmlText = await simHtmlRes.text();
      console.assert(simHtmlText.includes('Krishi-Line WhatsApp Simulator'), 'Simulator HTML contains expected title');
      console.assert(simHtmlText.includes('chat-canvas'), 'Simulator HTML contains chat canvas');
      console.log('✅ PASS: WhatsApp Simulator web interface served successfully at /simulator');

      console.log('All HTTP integration and verification checks passed successfully!');
    } catch (err) {
      console.error('HTTP test failure:', err);
      process.exitCode = 1;
    } finally {
      server.close();
      await teardownTestDb();
    }
  });
}

runHttpTests();

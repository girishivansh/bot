const express = require('express');
const dotenv = require('dotenv');
const { connectDB } = require('./src/config/db');
const { seedSlotsIfEmpty } = require('./src/services/slotService');

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable JSON request body parsing
app.use(express.json());

// Root route: Redirect browser visitors directly to the interactive WhatsApp Simulator
app.get('/', (req, res) => {
  res.redirect('/simulator/');
});

// Health check route: returns JSON status
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    service: 'Krishi-Line Bot Backend',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Bot conversation engine routes
const botRoutes = require('./src/routes/botRoutes');
app.use('/api/bot', botRoutes);

// Booking verification routes
const bookingRoutes = require('./src/routes/bookingRoutes');
app.use('/api/bookings', bookingRoutes);

// Static QR code images delivery
const path = require('path');
app.use('/qrcodes', express.static(path.join(process.cwd(), 'public', 'qrcodes')));

// WhatsApp Web Simulator static UI
app.use('/simulator', express.static(path.join(process.cwd(), 'public', 'simulator')));
app.get('/whatsapp', (req, res) => res.redirect('/simulator'));

// Handle unknown routes (404 Not Found)
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

// Global error handling middleware (handles invalid JSON payloads and server errors)
app.use((err, req, res, next) => {
  // Check if error is due to malformed JSON body
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON payload received.'
    });
  }

  console.error('Unhandled server error:', err);
  return res.status(err.status || 500).json({
    success: false,
    message: 'Internal server error'
  });
});

/**
 * Starts the HTTP server and initializes MongoDB
 */
async function startServer() {
  try {
    if (process.env.MONGODB_URI) {
      await connectDB();
      await seedSlotsIfEmpty();
    } else {
      console.warn('⚠️ MONGODB_URI is not set. Running without active MongoDB connection.');
    }

    app.listen(PORT, () => {
      console.log(`Krishi-Line server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Fatal error during server startup:', error.message);
    process.exit(1);
  }
}

// Start if executed directly
if (require.main === module) {
  startServer();
}

module.exports = app;

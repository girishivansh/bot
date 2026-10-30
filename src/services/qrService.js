/**
 * QR Code & Verification Token Service
 * 
 * Generates cryptographically secure, unguessable tokens and local QR code PNG images
 * for verified procurement slot reservations.
 * 
 * Privacy Safeguard: The QR code contains strictly the opaque verification token.
 * No personal details (such as farmer name, phone number, village, or Aadhaar) are encoded.
 */

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');

const QR_STORAGE_DIR = path.join(process.cwd(), 'public', 'qrcodes');

// Ensure destination directory exists
if (!fs.existsSync(QR_STORAGE_DIR)) {
  fs.mkdirSync(QR_STORAGE_DIR, { recursive: true });
}

/**
 * Generates a cryptographically random, unguessable verification token.
 * 192 bits of entropy (24 bytes hex).
 * @returns {string} e.g. kl_tok_7a1b...
 */
function generateSecureToken() {
  return `kl_tok_${crypto.randomBytes(24).toString('hex')}`;
}

/**
 * Generates a QR code image file for a booking token and writes it to disk.
 * @param {string} bookingId 
 * @param {string} token 
 * @returns {Promise<{ qrToken: string, qrImagePath: string, qrRelativeUrl: string }>}
 */
async function generateBookingQRCode(bookingId, token) {
  if (!token) {
    throw new Error('Token is required to generate QR code.');
  }

  // Ensure storage dir exists
  if (!fs.existsSync(QR_STORAGE_DIR)) {
    fs.mkdirSync(QR_STORAGE_DIR, { recursive: true });
  }

  // Sanitize bookingId for safe filename
  const safeFilename = `${bookingId.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
  const absolutePath = path.join(QR_STORAGE_DIR, safeFilename);
  const relativeUrl = `/qrcodes/${safeFilename}`;

  // Generate PNG file with QR library
  // Encoding ONLY the opaque token
  await QRCode.toFile(absolutePath, token, {
    errorCorrectionLevel: 'M',
    type: 'png',
    margin: 2,
    width: 300,
    color: {
      dark: '#1e3a1e', // Dark green for agriculture theme
      light: '#ffffff'
    }
  });

  return {
    qrToken: token,
    qrImagePath: absolutePath,
    qrRelativeUrl: relativeUrl
  };
}

module.exports = {
  generateSecureToken,
  generateBookingQRCode,
  QR_STORAGE_DIR
};

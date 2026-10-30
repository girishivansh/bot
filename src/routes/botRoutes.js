/**
 * Bot API Routes
 * 
 * Exposes the simulated message processing endpoint for farmer interactions.
 */

const express = require('express');
const router = express.Router();
const { processMessage } = require('../bot/conversationEngine');
const { getSession, resetStateToMenu } = require('../bot/sessionStore');

/**
 * POST /api/bot/message
 * Accepts simulated incoming farmer message and returns the bot's response.
 */
router.post('/message', async (req, res) => {
  // Safeguard against null, non-object, or array request bodies
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({
      success: false,
      message: "Validation Error: Request body must be a valid JSON object."
    });
  }

  const { farmerId, message } = req.body;

  // Validation: Check for presence and type
  if (!farmerId || typeof farmerId !== 'string' || farmerId.trim() === '') {
    return res.status(400).json({
      success: false,
      message: "Validation Error: 'farmerId' is required and must be a non-empty string."
    });
  }

  if (message === undefined || message === null || typeof message !== 'string' || message.trim() === '') {
    return res.status(400).json({
      success: false,
      message: "Validation Error: 'message' is required and must be a non-empty string."
    });
  }

  try {
    const result = await processMessage(farmerId.trim(), message.trim());

    return res.status(200).json({
      success: true,
      farmerId: farmerId.trim(),
      reply: result.reply,
      menuOptions: result.menuOptions,
      state: result.state
    });
  } catch (error) {
    console.error(`Error processing message for farmer ${farmerId}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while processing message.'
    });
  }
});

/**
 * GET /api/bot/session/:farmerId
 * Helper endpoint to inspect session status for testing & verification.
 */
router.get('/session/:farmerId', (req, res) => {
  const { farmerId } = req.params;
  const session = getSession(farmerId);
  return res.status(200).json({
    success: true,
    session
  });
});

/**
 * POST /api/bot/reset/:farmerId
 * Helper endpoint to reset a farmer's conversation state to the main menu.
 */
router.post('/reset/:farmerId', (req, res) => {
  const { farmerId } = req.params;
  const session = resetStateToMenu(farmerId);
  return res.status(200).json({
    success: true,
    message: `Session for farmer ${farmerId} reset to MAIN_MENU.`,
    session
  });
});

module.exports = router;

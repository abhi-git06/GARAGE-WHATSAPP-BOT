// notifier.js
// Express server that the backend (Flutter app admin) calls to push WhatsApp notifications
// When admin updates job status → backend hits POST /notify → sends WhatsApp to customer

require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const GARAGE_NAME     = process.env.GARAGE_NAME     || 'Sundar Auto Care';
const GARAGE_LOCATION = process.env.GARAGE_LOCATION || 'Musiri, Trichy District, Tamil Nadu';

// ─── Notification Message Templates ──────────────────────────────────────────

function getNotificationMessage(type, vehicleNumber, service) {
  switch (type) {
    case 'confirmed':
      return (
        `✅ *Booking Confirmed!*\n\n` +
        `🚗 Vehicle: *${vehicleNumber}*\n` +
        `🔧 Service: *${service}*\n\n` +
        `You are now in the queue.\n` +
        `We'll notify you when we start! 🙏`
      );
    case 'in_progress':
      return (
        `🔧 *Work Started!*\n\n` +
        `We've started working on your vehicle.\n\n` +
        `🚗 Vehicle: *${vehicleNumber}*\n` +
        `🔧 Service: *${service}*\n\n` +
        `We'll notify you when it's ready!`
      );
    case 'completed':
      return (
        `✅ *Your vehicle is ready for pickup!*\n\n` +
        `🚗 Vehicle: *${vehicleNumber}*\n` +
        `🔧 Service: *${service}*\n\n` +
        `📍 *${GARAGE_NAME}*\n` +
        `${GARAGE_LOCATION}\n\n` +
        `Thank you for choosing us! 🙏`
      );
    default:
      return null;
  }
}

// ─── Create Notifier Server ───────────────────────────────────────────────────

// sendMessage is injected from index.js (twilioClient.sendMessage)
function createNotifierServer(sendMessage) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', garage: GARAGE_NAME });
  });

  // POST /notify — backend calls this when admin updates job status on Flutter app
  // Body: { phone, vehicleNumber, service, type }
  app.post('/notify', async (req, res) => {
    const { phone, vehicleNumber, service, type } = req.body;

    if (!phone || !vehicleNumber || !service || !type) {
      return res.status(400).json({
        success: false,
        error: 'Missing fields: phone, vehicleNumber, service, type',
      });
    }

    const message = getNotificationMessage(type, vehicleNumber, service);
    if (!message) {
      return res.status(400).json({
        success: false,
        error: `Unknown type: "${type}". Use: confirmed, in_progress, completed`,
      });
    }

    const result = await sendMessage(phone, message);
    if (result.success) {
      console.log(`[Notifier] ✅ Sent '${type}' to ${phone} for ${vehicleNumber}`);
      res.json({ success: true, message: `Notification sent to ${phone}` });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  });

  return app;
}

module.exports = { createNotifierServer };

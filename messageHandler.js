// messageHandler.js
// Core bot brain — reads every incoming message and decides what to reply
// All conversation logic lives here

require('dotenv').config();
const { STATES, getSession, updateSession, resetSession, getServiceName } = require('./flowManager');
const { createJob, getJobStatus } = require('./apiClient');

const GARAGE_NAME = process.env.GARAGE_NAME || 'Sundar Auto Care';

// ─── Message Templates ──────────────────────────────────────────────────────

const MSG = {
  welcome: () =>
    `👋 Welcome to *${GARAGE_NAME}*!\n\n` +
    `Please select a service:\n\n` +
    `1️⃣ - Car Washing\n` +
    `2️⃣ - Tyre Changing\n` +
    `3️⃣ - Tyre Alignment\n` +
    `4️⃣ - Tyre Balancing\n` +
    `5️⃣ - Check my vehicle status\n\n` +
    `_Reply with the number of your choice._`,

  askVehicleNumber: (service) =>
    `✅ You selected: *${service}*\n\n` +
    `Please send your *vehicle registration number*.\n` +
    `_(Example: TN45AB1234)_`,

  bookingReceived: (vehicleNumber, service) =>
    `🙏 Thank you! Your request has been sent.\n\n` +
    `🚗 Vehicle: *${vehicleNumber}*\n` +
    `🔧 Service: *${service}*\n` +
    `📋 Status: _Waiting for confirmation..._\n\n` +
    `We will notify you once the workshop confirms your slot!`,

  bookingError: () =>
    `⚠️ Sorry, something went wrong with your booking.\n` +
    `Please try again or call us directly.\n\n` +
    `Reply *Hi* to start again.`,

  statusFound: (vehicleNumber, service, status) => {
    const emoji = status === 'queued' ? '⏳' : status === 'in_progress' ? '🔧' : '✅';
    const label = status === 'queued' ? 'In Queue' : status === 'in_progress' ? 'In Progress' : 'Completed';
    return (
      `🔍 *Vehicle Status*\n\n` +
      `🚗 Vehicle: *${vehicleNumber}*\n` +
      `🔧 Service: *${service}*\n` +
      `${emoji} Status: *${label}*\n\n` +
      `We will notify you when there's an update!`
    );
  },

  statusNotFound: (vehicleNumber) =>
    `❌ No active job found for vehicle: *${vehicleNumber}*\n\n` +
    `Please check the number and try again.\n` +
    `Reply *Hi* to start over.`,

  askVehicleForStatus: () =>
    `🔍 Please send your *vehicle registration number* to check status.\n` +
    `_(Example: TN45AB1234)_`,

  unknown: () =>
    `🤔 Sorry, I didn't understand that.\n\n` +
    `Reply *Hi* to see the main menu.`,

  alreadyBooked: (vehicleNumber, service) =>
    `✅ You already have an active booking!\n\n` +
    `🚗 Vehicle: *${vehicleNumber}*\n` +
    `🔧 Service: *${service}*\n\n` +
    `We will notify you with updates. Reply *5* to check status.`,
};

// ─── Vehicle Number Validator ────────────────────────────────────────────────

function isValidVehicleNumber(text) {
  // Indian vehicle number format: TN45AB1234 or TN 45 AB 1234
  const cleaned = text.replace(/\s+/g, '').toUpperCase();
  return /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{1,4}$/.test(cleaned);
}

function normalizeVehicleNumber(text) {
  return text.replace(/\s+/g, '').toUpperCase();
}

// ─── Main Handler ────────────────────────────────────────────────────────────

async function handleMessage(phone, messageText) {
  const input = messageText.trim();
  const inputLower = input.toLowerCase();
  const session = getSession(phone);

  console.log(`[Bot] Message from ${phone} | State: ${session.state} | Input: "${input}"`);

  // ── Any state: "hi" / "hello" / "menu" resets to welcome ──
  if (['hi', 'hello', 'hey', 'start', 'menu'].includes(inputLower)) {
    updateSession(phone, STATES.AWAITING_SERVICE);
    return MSG.welcome();
  }

  // ── IDLE: nudge them to say hi ──
  if (session.state === STATES.IDLE) {
    updateSession(phone, STATES.AWAITING_SERVICE);
    return MSG.welcome();
  }

  // ── AWAITING_SERVICE: customer picks 1-5 ──
  if (session.state === STATES.AWAITING_SERVICE) {
    if (input === '5') {
      // Status check flow
      updateSession(phone, STATES.AWAITING_VEHICLE, { flowType: 'status' });
      return MSG.askVehicleForStatus();
    }

    const serviceName = getServiceName(input);
    if (!serviceName) {
      return MSG.unknown() + '\n\n' + MSG.welcome();
    }

    updateSession(phone, STATES.AWAITING_VEHICLE, {
      service: serviceName,
      flowType: 'booking',
    });
    return MSG.askVehicleNumber(serviceName);
  }

  // ── AWAITING_VEHICLE: customer sends vehicle number ──
  if (session.state === STATES.AWAITING_VEHICLE) {
    if (!isValidVehicleNumber(input)) {
      return (
        `⚠️ That doesn't look like a valid vehicle number.\n` +
        `Please send it in this format: *TN45AB1234*\n\n` +
        `Try again:`
      );
    }

    const vehicleNumber = normalizeVehicleNumber(input);

    // ── Status check flow ──
    if (session.data.flowType === 'status') {
      const result = await getJobStatus(vehicleNumber);
      resetSession(phone);

      if (result.success && result.data && result.data.job) {
        const job = result.data.job;
        return MSG.statusFound(vehicleNumber, job.service, job.status);
      } else {
        return MSG.statusNotFound(vehicleNumber);
      }
    }

    // ── Booking flow ──
    if (session.data.flowType === 'booking') {
      const { service } = session.data;

      const result = await createJob(phone, vehicleNumber, service);

      if (result.success) {
        updateSession(phone, STATES.BOOKED, { vehicleNumber });
        return MSG.bookingReceived(vehicleNumber, service);
      } else {
        resetSession(phone);
        return MSG.bookingError();
      }
    }
  }

  // ── BOOKED: customer messages again after booking ──
  if (session.state === STATES.BOOKED) {
    if (input === '5') {
      updateSession(phone, STATES.AWAITING_VEHICLE, { flowType: 'status' });
      return MSG.askVehicleForStatus();
    }
    return MSG.alreadyBooked(session.data.vehicleNumber, session.data.service);
  }

  // ── Fallback ──
  return MSG.unknown();
}

module.exports = { handleMessage };

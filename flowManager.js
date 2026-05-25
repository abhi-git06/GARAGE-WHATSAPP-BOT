// flowManager.js
// Tracks where each customer is in the conversation flow
// States: IDLE -> AWAITING_SERVICE -> AWAITING_VEHICLE -> BOOKED

require('dotenv').config();

const TIMEOUT_MS = (parseInt(process.env.SESSION_TIMEOUT_MINUTES) || 10) * 60 * 1000;

// In-memory store: { phoneNumber: { state, data, lastActive } }
const sessions = {};

const STATES = {
  IDLE: 'IDLE',
  AWAITING_SERVICE: 'AWAITING_SERVICE',
  AWAITING_VEHICLE: 'AWAITING_VEHICLE',
  BOOKED: 'BOOKED',
};

// Service map: what customer types -> what we store
const SERVICE_MAP = {
  '1': 'Car Washing',
  '2': 'Tyre Changing',
  '3': 'Tyre Alignment',
  '4': 'Tyre Balancing',
};

function getSession(phone) {
  _cleanupIfExpired(phone);
  if (!sessions[phone]) {
    sessions[phone] = {
      state: STATES.IDLE,
      data: {},
      lastActive: Date.now(),
    };
  }
  return sessions[phone];
}

function updateSession(phone, state, data = {}) {
  const session = getSession(phone);
  session.state = state;
  session.data = { ...session.data, ...data };
  session.lastActive = Date.now();
}

function resetSession(phone) {
  sessions[phone] = {
    state: STATES.IDLE,
    data: {},
    lastActive: Date.now(),
  };
}

function _cleanupIfExpired(phone) {
  if (sessions[phone]) {
    const elapsed = Date.now() - sessions[phone].lastActive;
    if (elapsed > TIMEOUT_MS) {
      delete sessions[phone];
    }
  }
}

function getServiceName(input) {
  return SERVICE_MAP[input.trim()] || null;
}

function getAllSessions() {
  return sessions;
}

module.exports = {
  STATES,
  SERVICE_MAP,
  getSession,
  updateSession,
  resetSession,
  getServiceName,
  getAllSessions,
};

// apiClient.js
// Handles all communication between the bot and the backend API
// When backend is ready: just update BACKEND_URL in .env — nothing else changes

require('dotenv').config();
const axios = require('axios');

const BASE_URL = process.env.BACKEND_URL || 'http://localhost:3002';

// Shared axios instance
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
    // When real backend is ready, add: Authorization: `Bearer ${TOKEN}`
  },
});

/**
 * Create a new job card (called when customer completes booking flow)
 * @param {string} phone - customer phone number
 * @param {string} vehicleNumber - vehicle registration number
 * @param {string} serviceName - selected service name
 * @param {string} customerName - optional, will be 'WhatsApp Customer' if unknown
 */
async function createJob(phone, vehicleNumber, serviceName, customerName = 'WhatsApp Customer') {
  try {
    const response = await api.post('/jobs/create', {
      customer_phone: phone,
      customer_name: customerName,
      vehicle_number: vehicleNumber,
      service: serviceName,
      source: 'whatsapp',
    });
    return { success: true, data: response.data };
  } catch (error) {
    console.error('[apiClient] createJob error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Get the current status of a vehicle
 * @param {string} vehicleNumber - vehicle registration number
 */
async function getJobStatus(vehicleNumber) {
  try {
    const response = await api.get(`/customers/search?q=${vehicleNumber}`);
    return { success: true, data: response.data };
  } catch (error) {
    console.error('[apiClient] getJobStatus error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Confirm a booking (used by admin action on Flutter app)
 * @param {string} jobId - the job card ID
 */
async function confirmJob(jobId) {
  try {
    const response = await api.patch(`/jobs/${jobId}/status`, { status: 'confirmed' });
    return { success: true, data: response.data };
  } catch (error) {
    console.error('[apiClient] confirmJob error:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  createJob,
  getJobStatus,
  confirmJob,
};

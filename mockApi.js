// mockApi.js
// Simulates the real backend API so the bot can run standalone
// Replace BACKEND_URL in .env with the real backend URL when ready
// This file is NOT needed in production

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.MOCK_API_PORT || 3002;

// ─── In-Memory Mock Database ─────────────────────────────────────────────────

let jobCounter = 1000;

const jobs = {};       // jobId -> job object
const vehicles = {};   // vehicleNumber -> jobId (latest active job)
const customers = {};  // phone -> customer info

// ─── Routes ──────────────────────────────────────────────────────────────────

// POST /jobs/create — creates a new job card
app.post('/jobs/create', (req, res) => {
  const { customer_phone, customer_name, vehicle_number, service, source } = req.body;

  if (!customer_phone || !vehicle_number || !service) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const jobId = `JOB${++jobCounter}`;
  const job = {
    job_id: jobId,
    customer_phone,
    customer_name: customer_name || 'WhatsApp Customer',
    vehicle_number: vehicle_number.toUpperCase(),
    service,
    source: source || 'whatsapp',
    status: 'queued',
    created_at: new Date().toISOString(),
  };

  jobs[jobId] = job;
  vehicles[vehicle_number.toUpperCase()] = jobId;

  // Save customer
  if (!customers[customer_phone]) {
    customers[customer_phone] = {
      phone: customer_phone,
      name: customer_name || 'WhatsApp Customer',
      created_at: new Date().toISOString(),
    };
  }

  console.log(`[MockAPI] ✅ Job created: ${jobId} | Vehicle: ${vehicle_number} | Service: ${service}`);

  res.status(201).json({
    success: true,
    job_id: jobId,
    message: 'Job card created successfully',
    job,
  });
});

// GET /customers/search?q= — search by vehicle number or phone
app.get('/customers/search', (req, res) => {
  const query = (req.query.q || '').toUpperCase().trim();

  if (!query) {
    return res.status(400).json({ error: 'Query parameter q is required' });
  }

  // Search by vehicle number
  const jobId = vehicles[query];
  if (jobId && jobs[jobId]) {
    const job = jobs[jobId];
    return res.json({
      success: true,
      found: true,
      job: {
        job_id: job.job_id,
        vehicle_number: job.vehicle_number,
        service: job.service,
        status: job.status,
        created_at: job.created_at,
        customer_name: job.customer_name,
      },
    });
  }

  // Not found
  res.json({ success: true, found: false, job: null });
});

// PATCH /jobs/:id/status — update job status (simulates admin action)
app.patch('/jobs/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['queued', 'confirmed', 'in_progress', 'completed'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Use: ${validStatuses.join(', ')}` });
  }

  if (!jobs[id]) {
    return res.status(404).json({ error: `Job ${id} not found` });
  }

  jobs[id].status = status;
  jobs[id].updated_at = new Date().toISOString();

  console.log(`[MockAPI] 🔄 Job ${id} status updated to: ${status}`);

  res.json({
    success: true,
    job_id: id,
    status,
    message: `Job status updated to ${status}`,
    job: jobs[id],
  });
});

// GET /jobs/:id — get single job details
app.get('/jobs/:id', (req, res) => {
  const job = jobs[req.params.id];
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json({ success: true, job });
});

// GET /jobs/today — all today's jobs (for admin queue board)
app.get('/jobs/today', (req, res) => {
  const today = new Date().toDateString();
  const todayJobs = Object.values(jobs).filter(
    (j) => new Date(j.created_at).toDateString() === today
  );
  res.json({ success: true, count: todayJobs.length, jobs: todayJobs });
});

// GET /mock/all — debug route to see everything in memory
app.get('/mock/all', (req, res) => {
  res.json({ jobs, vehicles, customers });
});

// ─── Start ───────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[MockAPI] 🟢 Mock backend running on http://localhost:${PORT}`);
  console.log(`[MockAPI] Routes available:`);
  console.log(`  POST   /jobs/create`);
  console.log(`  GET    /jobs/today`);
  console.log(`  GET    /jobs/:id`);
  console.log(`  PATCH  /jobs/:id/status`);
  console.log(`  GET    /customers/search?q=VEHICLENUMBER`);
  console.log(`  GET    /mock/all  (debug)`);
});

module.exports = app;

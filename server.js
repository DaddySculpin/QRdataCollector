const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for external application tracking integration
app.use(cors());

// Parse JSON request bodies
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// 1. QR Code Scan Tracker and Redirect Endpoint
// Example: GET http://localhost:3000/qr?appId=retail-promo-2026&expType=coupon_deal&redirect=https://google.com
app.get('/qr', async (req, res) => {
  const { appId, expType, redirect } = req.query;
  const destination = redirect || '/'; // Fallback to dashboard if no redirect URL

  const userAgent = req.headers['user-agent'];
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  try {
    // Record the QR scan event
    await db.addEvent({
      appId: appId || 'qr-unknown-app',
      experienceType: expType || 'qr-scan',
      eventType: 'qr_scan',
      eventData: {
        redirectUrl: destination,
        source: req.query.source || 'qr_code'
      },
      userAgent,
      ip
    });
  } catch (error) {
    console.error('Error logging QR scan event:', error);
  }

  // Perform redirect immediately to avoid slowing down the user experience
  res.redirect(destination);
});

// 2. REST API for External Application Events Ingestion
// Example: POST http://localhost:3000/api/events
app.post('/api/events', async (req, res) => {
  const { appId, experienceType, eventType, eventData, timestamp } = req.body;

  if (!appId || !eventType) {
    return res.status(400).json({ 
      error: 'Missing required parameters: "appId" and "eventType" are required.' 
    });
  }

  const userAgent = req.headers['user-agent'];
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  try {
    const newEvent = await db.addEvent({
      appId,
      experienceType,
      eventType,
      eventData,
      timestamp,
      userAgent,
      ip
    });
    res.status(201).json({ success: true, event: newEvent });
  } catch (error) {
    console.error('Error adding event:', error);
    res.status(500).json({ error: 'Failed to record event.' });
  }
});

// 3. API to Fetch Dashboard Statistics
app.get('/api/dashboard/stats', (req, res) => {
  const { appId, experienceType, startDate, endDate } = req.query;
  
  try {
    const stats = db.getStats({ appId, experienceType, startDate, endDate });
    res.json(stats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to compute dashboard stats.' });
  }
});

// 4. API to Fetch Logged Events (Filtered, Sorted, Paginated)
app.get('/api/dashboard/events', (req, res) => {
  const { appId, experienceType, eventType, startDate, endDate, sortBy, sortOrder, page, limit } = req.query;

  try {
    const eventsData = db.getEvents({
      appId,
      experienceType,
      eventType,
      startDate,
      endDate,
      sortBy,
      sortOrder,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50
    });
    res.json(eventsData);
  } catch (error) {
    console.error('Error fetching logged events:', error);
    res.status(500).json({ error: 'Failed to fetch events.' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Express server error:', err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Initialize database and start listening
async function startServer() {
  await db.init();
  app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(` QR Data Ingestion Server & Dashboard active at:`);
    console.log(` http://localhost:${PORT}`);
    console.log(`==================================================`);
  });
}

startServer();

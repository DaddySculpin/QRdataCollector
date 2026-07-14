const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const DB_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DB_DIR, 'events.json');

let events = [];
let writePromise = Promise.resolve();

// Save the current in-memory events to events.json (queued to prevent corruption)
async function save() {
  writePromise = writePromise.then(async () => {
    try {
      await fs.mkdir(DB_DIR, { recursive: true });
      await fs.writeFile(DB_PATH, JSON.stringify(events, null, 2), 'utf8');
    } catch (err) {
      console.error('Error writing to database file:', err);
    }
  });
  return writePromise;
}

// Generate realistic mock data for the last 7 days
function generateMockEvents() {
  const mockEvents = [];
  const apps = [
    { appId: 'retail-promo-2026', experienceType: 'coupon_deal' },
    { appId: 'museum-tour-ar', experienceType: 'ar_exhibit' },
    { appId: 'product-survey', experienceType: 'feedback_form' }
  ];

  const now = new Date();
  
  // Create entries over the last 7 days
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    // Determine number of events for this day
    const numEvents = Math.floor(Math.random() * 15) + 10; // 10 to 24 events per day
    
    for (let j = 0; j < numEvents; j++) {
      const app = apps[Math.floor(Math.random() * apps.length)];
      const hour = Math.floor(Math.random() * 14) + 8; // 8 AM to 10 PM
      const minute = Math.floor(Math.random() * 60);
      const seconds = Math.floor(Math.random() * 60);
      
      const eventTime = new Date(date);
      eventTime.setHours(hour, minute, seconds);

      // Flow sequence: Start with QR scan, then app start, then interactions
      const flowSeed = Math.random();
      let eventType = 'interaction';
      let eventData = {};

      if (flowSeed < 0.25) {
        eventType = 'qr_scan';
        eventData = { 
          redirectUrl: app.appId === 'retail-promo-2026' ? 'https://example.com/promo' : 
                       app.appId === 'museum-tour-ar' ? 'https://example.com/museum' : 'https://example.com/survey',
          scannedFrom: ['flyer', 'poster', 'table_stand', 'badge'][Math.floor(Math.random() * 4)]
        };
      } else if (flowSeed < 0.50) {
        eventType = 'app_start';
        eventData = { 
          deviceType: ['mobile', 'tablet'][Math.floor(Math.random() * 2)],
          os: ['iOS', 'Android'][Math.floor(Math.random() * 2)],
          browser: ['Safari', 'Chrome', 'Firefox'][Math.floor(Math.random() * 3)]
        };
      } else if (flowSeed < 0.85) {
        if (app.appId === 'product-survey') {
          eventType = 'question_response';
          const questions = [
            { qId: 'q1', q: 'How would you rate the product quality?', a: ['Excellent', 'Good', 'Average'][Math.floor(Math.random() * 3)] },
            { qId: 'q2', q: 'Would you recommend us to a friend?', a: ['Yes, definitely', 'Maybe', 'No'][Math.floor(Math.random() * 3)] },
            { qId: 'q3', q: 'Was the pricing fair?', a: ['Yes', 'Somewhat', 'No'][Math.floor(Math.random() * 3)] }
          ];
          eventData = questions[Math.floor(Math.random() * questions.length)];
        } else if (app.appId === 'museum-tour-ar') {
          eventType = 'ar_trigger';
          eventData = {
            exhibitId: ['trex_skeleton', 'mummy_tomb', 'starry_night'][Math.floor(Math.random() * 3)],
            viewDurationSeconds: Math.floor(Math.random() * 120) + 10
          };
        } else {
          eventType = 'coupon_claim';
          eventData = {
            couponCode: `SAVE-${Math.floor(Math.random() * 90) + 10}`,
            discountPct: [10, 15, 20, 25][Math.floor(Math.random() * 4)]
          };
        }
      } else {
        eventType = 'app_exit';
        eventData = { sessionsDurationSeconds: Math.floor(Math.random() * 300) + 30 };
      }

      mockEvents.push({
        id: crypto.randomUUID(),
        appId: app.appId,
        experienceType: app.experienceType,
        eventType,
        eventData,
        timestamp: eventTime.toISOString(),
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
        ip: `192.168.1.${Math.floor(Math.random() * 254) + 1}`
      });
    }
  }

  // Sort chronologically
  return mockEvents.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

// Initialize the database
async function init() {
  try {
    await fs.mkdir(DB_DIR, { recursive: true });
    const data = await fs.readFile(DB_PATH, 'utf8');
    events = JSON.parse(data);
    console.log(`Database loaded successfully. Found ${events.length} events.`);
  } catch (err) {
    console.log('Database file not found or empty. Initializing with mock data...');
    events = generateMockEvents();
    await save();
    console.log(`Database initialized and seeded with ${events.length} mock events.`);
  }
}

// Add a new event record
async function addEvent({ appId, experienceType, eventType, eventData, userAgent, ip, timestamp }) {
  const newEvent = {
    id: crypto.randomUUID(),
    appId: appId || 'unknown-app',
    experienceType: experienceType || 'unknown-experience',
    eventType: eventType || 'generic_interaction',
    eventData: eventData || {},
    timestamp: timestamp || new Date().toISOString(),
    userAgent: userAgent || 'Unknown Client',
    ip: ip || '127.0.0.1'
  };

  events.push(newEvent);
  await save();
  return newEvent;
}

// Get filtered, sorted, and paginated events
function getEvents({ appId, experienceType, eventType, startDate, endDate, sortBy = 'timestamp', sortOrder = 'desc', page = 1, limit = 50 }) {
  let filtered = [...events];

  // Apply filters
  if (appId) {
    filtered = filtered.filter(e => e.appId === appId);
  }
  if (experienceType) {
    filtered = filtered.filter(e => e.experienceType === experienceType);
  }
  if (eventType) {
    filtered = filtered.filter(e => e.eventType === eventType);
  }
  if (startDate) {
    const start = new Date(startDate);
    filtered = filtered.filter(e => new Date(e.timestamp) >= start);
  }
  if (endDate) {
    const end = new Date(endDate);
    // Include the entire end day (up to 23:59:59.999)
    if (endDate.length <= 10) {
      end.setHours(23, 59, 59, 999);
    }
    filtered = filtered.filter(e => new Date(e.timestamp) <= end);
  }

  // Apply sorting
  filtered.sort((a, b) => {
    let valA = a[sortBy];
    let valB = b[sortBy];

    // Handle nested eventData sorting if requested (though simple string/date fields are normal)
    if (sortBy === 'timestamp') {
      valA = new Date(valA);
      valB = new Date(valB);
    }

    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  // Apply pagination
  const total = filtered.length;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const paginated = filtered.slice(startIndex, endIndex);

  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    results: paginated
  };
}

// Calculate analytics data
function getStats({ appId, experienceType, startDate, endDate }) {
  let filtered = [...events];

  if (appId) {
    filtered = filtered.filter(e => e.appId === appId);
  }
  if (experienceType) {
    filtered = filtered.filter(e => e.experienceType === experienceType);
  }
  if (startDate) {
    const start = new Date(startDate);
    filtered = filtered.filter(e => new Date(e.timestamp) >= start);
  }
  if (endDate) {
    const end = new Date(endDate);
    if (endDate.length <= 10) {
      end.setHours(23, 59, 59, 999);
    }
    filtered = filtered.filter(e => new Date(e.timestamp) <= end);
  }

  // Aggregate metadata lists (unfiltered by selection, to populate filter choices)
  const uniqueApps = [...new Set(events.map(e => e.appId))].sort();
  const uniqueExpTypes = [...new Set(events.map(e => e.experienceType))].sort();
  const uniqueEventTypes = [...new Set(events.map(e => e.eventType))].sort();

  // Basic counters
  const totalCount = filtered.length;
  const qrScansCount = filtered.filter(e => e.eventType === 'qr_scan').length;
  const appInteractionsCount = totalCount - qrScansCount;

  // Group by event type
  const eventTypeDistribution = {};
  // Group by experience type
  const experienceTypeDistribution = {};

  filtered.forEach(e => {
    eventTypeDistribution[e.eventType] = (eventTypeDistribution[e.eventType] || 0) + 1;
    experienceTypeDistribution[e.experienceType] = (experienceTypeDistribution[e.experienceType] || 0) + 1;
  });

  // Group by date for trends (line chart)
  const trendDataMap = {};
  filtered.forEach(e => {
    const dateStr = e.timestamp.split('T')[0]; // YYYY-MM-DD
    if (!trendDataMap[dateStr]) {
      trendDataMap[dateStr] = { date: dateStr, qrScans: 0, appEvents: 0, total: 0 };
    }
    
    trendDataMap[dateStr].total++;
    if (e.eventType === 'qr_scan') {
      trendDataMap[dateStr].qrScans++;
    } else {
      trendDataMap[dateStr].appEvents++;
    }
  });

  const trendData = Object.values(trendDataMap).sort((a, b) => new Date(a.date) - new Date(b.date));

  return {
    summary: {
      totalEvents: totalCount,
      qrScans: qrScansCount,
      appEvents: appInteractionsCount,
      activeAppsCount: [...new Set(filtered.map(e => e.appId))].length
    },
    meta: {
      appIds: uniqueApps,
      experienceTypes: uniqueExpTypes,
      eventTypes: uniqueEventTypes
    },
    distributions: {
      eventTypes: eventTypeDistribution,
      experienceTypes: experienceTypeDistribution
    },
    trend: trendData
  };
}

module.exports = {
  init,
  addEvent,
  getEvents,
  getStats
};

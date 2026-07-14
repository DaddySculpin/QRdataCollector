const http = require('http');

const SERVER_URL = 'http://localhost:3000';

// Helper to make HTTP requests
function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const isPost = options.method === 'POST';
    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (isPost && options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🚀 Starting API integration tests on running Express server...');

  try {
    // 1. Fetch initial statistics
    console.log('\n--- Test 1: Fetching initial statistics ---');
    const initialStats = await request(`${SERVER_URL}/api/dashboard/stats`);
    console.log(`HTTP Status: ${initialStats.status}`);
    const initialTotal = initialStats.data.summary.totalEvents;
    console.log(`Seeded Events: ${initialTotal}`);
    console.log('App IDs available:', initialStats.data.meta.appIds);
    console.log('Experience types available:', initialStats.data.meta.experienceTypes);
    
    if (initialStats.status === 200 && initialTotal > 0) {
      console.log('✅ Test 1 Passed: Initial data retrieval successful.');
    } else {
      throw new Error('Test 1 Failed: Metrics could not be retrieved.');
    }

    // 2. Simulate external telemetry interaction event
    console.log('\n--- Test 2: Ingesting simulated telemetry event ---');
    const newEventPayload = {
      appId: 'automated-test-widget',
      experienceType: 'health_check',
      eventType: 'pulse_heartbeat',
      eventData: {
        agent: 'antigravity-verifier',
        status: 'healthy',
        latencyMs: 14
      }
    };
    
    const postRes = await request(`${SERVER_URL}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: newEventPayload
    });
    console.log(`HTTP Status: ${postRes.status}`);
    console.log('Ingestion Response:', postRes.data);

    if (postRes.status === 201 && postRes.data.success) {
      console.log('✅ Test 2 Passed: Ingestion endpoint recorded telemetry event.');
    } else {
      throw new Error('Test 2 Failed: Event post was rejected.');
    }

    // 3. Re-fetch stats to confirm total count incremented
    console.log('\n--- Test 3: Verifying event count incremented ---');
    const updatedStats = await request(`${SERVER_URL}/api/dashboard/stats`);
    const newTotal = updatedStats.data.summary.totalEvents;
    console.log(`New Total Events: ${newTotal} (Previous: ${initialTotal})`);

    if (newTotal === initialTotal + 1) {
      console.log('✅ Test 3 Passed: Total events successfully incremented by 1.');
    } else {
      throw new Error(`Test 3 Failed: Expected ${initialTotal + 1} events, but found ${newTotal}`);
    }

    // 4. Simulate a QR redirect scan
    console.log('\n--- Test 4: Tracking QR code scanner redirect ---');
    const qrUrl = `${SERVER_URL}/qr?appId=test-qr-campaign&expType=scanner_promo&redirect=https://google.com`;
    const qrRes = await request(qrUrl, { method: 'GET' });
    console.log(`HTTP Status: ${qrRes.status}`);
    console.log(`Redirect Destination (Location header): ${qrRes.headers.location}`);

    if (qrRes.status === 302 && qrRes.headers.location === 'https://google.com') {
      console.log('✅ Test 4 Passed: QR tracker registered scan and executed HTTP 302 redirect.');
    } else {
      throw new Error('Test 4 Failed: QR endpoint did not redirect properly.');
    }

    // 5. Verify the QR Scan event was saved
    console.log('\n--- Test 5: Confirming QR scan event was persisted ---');
    const finalStats = await request(`${SERVER_URL}/api/dashboard/stats`);
    const finalTotal = finalStats.data.summary.totalEvents;
    console.log(`Final Total Events: ${finalTotal}`);
    console.log('Active App IDs:', finalStats.data.meta.appIds);

    if (finalTotal === newTotal + 1 && finalStats.data.meta.appIds.includes('test-qr-campaign')) {
      console.log('✅ Test 5 Passed: QR scan event registered and updated filtering options.');
    } else {
      throw new Error('Test 5 Failed: QR scan event was not persisted.');
    }

    console.log('\n==================================================');
    console.log(' 🎉 ALL API & PERSISTENCE TESTS PASSED SUCCESSFULLY! ');
    console.log('==================================================');
  } catch (error) {
    console.error('\n❌ Integration Test Suite Failed:', error.message);
  }
}

runTests();

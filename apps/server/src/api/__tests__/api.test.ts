import { buildServer } from '../server';
import { closeDb } from '../../db';
import { closeRedisConnection } from '../../queues/connection';
import { logger } from '../../utils/logger';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function runApiTests() {
  logger.info('Starting Fastify REST API integration test suite...');
  const app = await buildServer();

  let createdMonitorId: string | null = null;

  try {
    // 1. Health Check
    logger.info('Test 1: Health Check GET /health');
    const resHealth = await app.inject({
      method: 'GET',
      url: '/health',
    });
    assert(resHealth.statusCode === 200, `Health check returned ${resHealth.statusCode}`);
    const healthJson = resHealth.json();
    assert(healthJson.status === 'ok', 'Health status is not ok');
    assert(healthJson.service === 'omnisentinel-api', 'Service identifier mismatch');
    logger.info('[PASS] Health Check');

    // 2. Intent Parsing: Validation failure (empty body)
    logger.info('Test 2: Intent Parsing Validation Error (400)');
    const resIntentInvalid = await app.inject({
      method: 'POST',
      url: '/api/v1/intent/parse',
      payload: { prompt: 'hi' }, // Too short (< 3 chars)
    });
    assert(resIntentInvalid.statusCode === 400, `Expected 400, got ${resIntentInvalid.statusCode}`);
    const intentErrJson = resIntentInvalid.json();
    assert(intentErrJson.error === 'Bad Request', 'Expected Bad Request error message');
    logger.info('[PASS] Intent Parsing Validation Error');

    // 3. Intent Parsing: Valid prompt
    logger.info('Test 3: Intent Parsing Valid Prompt (200)');
    const resIntentValid = await app.inject({
      method: 'POST',
      url: '/api/v1/intent/parse',
      payload: { prompt: 'Alert me when Reliance stock drops below 2800' },
    });
    assert(resIntentValid.statusCode === 200, `Expected 200, got ${resIntentValid.statusCode}`);
    const intentResult = resIntentValid.json();
    assert(intentResult.success === true, 'Expected success: true');
    assert(intentResult.data.analysis.type === 'STOCK', `Expected STOCK type, got ${intentResult.data.analysis.type}`);
    assert(intentResult.data.analysis.conditionOperator === 'LT', 'Expected LT condition');
    assert(Array.isArray(intentResult.data.previewResults), 'Expected previewResults array');
    logger.info('[PASS] Intent Parsing Valid Prompt');

    // 4. Monitor Creation: Validation failure
    logger.info('Test 4: Monitor Creation Validation Error (400)');
    const resCreateInvalid = await app.inject({
      method: 'POST',
      url: '/api/v1/monitors',
      payload: { title: 'Missing required fields' },
    });
    assert(resCreateInvalid.statusCode === 400, `Expected 400, got ${resCreateInvalid.statusCode}`);
    logger.info('[PASS] Monitor Creation Validation Error');

    // 5. Monitor Creation: Valid monitor
    logger.info('Test 5: Create Monitor POST /api/v1/monitors (201)');
    const resCreate = await app.inject({
      method: 'POST',
      url: '/api/v1/monitors',
      payload: {
        title: 'API Test Tata Motors Watch',
        type: 'STOCK',
        targetSymbol: 'TATAMOTORS.NS',
        rawPrompt: 'Notify me when Tata Motors drops below 950',
        conditionOperator: 'LT',
        targetValue: 950,
        currency: 'INR',
        frequencyMinutes: 30,
      },
    });
    assert(resCreate.statusCode === 201, `Expected 201 Created, got ${resCreate.statusCode}`);
    const createJson = resCreate.json();
    assert(createJson.success === true, 'Expected success: true');
    assert(createJson.data.id !== undefined, 'Expected monitor ID in response');
    assert(createJson.data.title === 'API Test Tata Motors Watch', 'Title mismatch');
    createdMonitorId = createJson.data.id;
    logger.info({ createdMonitorId }, '[PASS] Monitor Created Successfully');

    // 6. List Monitors: GET /api/v1/monitors
    logger.info('Test 6: List Monitors GET /api/v1/monitors (200)');
    const resList = await app.inject({
      method: 'GET',
      url: '/api/v1/monitors',
    });
    assert(resList.statusCode === 200, `Expected 200, got ${resList.statusCode}`);
    const listJson = resList.json();
    assert(Array.isArray(listJson.data), 'Expected array of monitors');
    assert(listJson.data.some((m: any) => m.id === createdMonitorId), 'Created monitor not in list');
    logger.info({ monitorCount: listJson.data.length }, '[PASS] List Monitors');

    // 7. Get Single Monitor: GET /api/v1/monitors/:id
    logger.info(`Test 7: Get Monitor GET /api/v1/monitors/${createdMonitorId} (200)`);
    const resGet = await app.inject({
      method: 'GET',
      url: `/api/v1/monitors/${createdMonitorId}`,
    });
    assert(resGet.statusCode === 200, `Expected 200, got ${resGet.statusCode}`);
    const getJson = resGet.json();
    assert(getJson.data.id === createdMonitorId, 'Monitor ID mismatch');
    assert(getJson.data.targetSymbol === 'TATAMOTORS.NS', 'Target symbol mismatch');
    logger.info('[PASS] Get Single Monitor');

    // 8. Get Non-existent Monitor: 404
    logger.info('Test 8: Non-existent Monitor GET (404)');
    const res404 = await app.inject({
      method: 'GET',
      url: '/api/v1/monitors/00000000-0000-0000-0000-000000000000',
    });
    assert(res404.statusCode === 404, `Expected 404, got ${res404.statusCode}`);
    logger.info('[PASS] Non-existent Monitor 404');

    // 9. Patch Monitor: Update threshold & Re-arm
    logger.info(`Test 9: Patch Monitor PATCH /api/v1/monitors/${createdMonitorId} (200)`);
    const resPatch = await app.inject({
      method: 'PATCH',
      url: `/api/v1/monitors/${createdMonitorId}`,
      payload: {
        targetValue: 975.5,
        status: 'ACTIVE',
        frequencyMinutes: 15,
      },
    });
    assert(resPatch.statusCode === 200, `Expected 200, got ${resPatch.statusCode}`);
    const patchJson = resPatch.json();
    assert(Number(patchJson.data.targetValue) === 975.5, 'Target value was not updated');
    assert(patchJson.data.frequencyMinutes === 15, 'Frequency was not updated');
    assert(patchJson.data.status === 'ACTIVE', 'Status was not updated');
    logger.info('[PASS] Patch Monitor');

    // 10. Get Monitor History: GET /api/v1/monitors/:id/history
    logger.info(`Test 10: Get Monitor History GET /api/v1/monitors/${createdMonitorId}/history (200)`);
    const resHistory = await app.inject({
      method: 'GET',
      url: `/api/v1/monitors/${createdMonitorId}/history`,
    });
    assert(resHistory.statusCode === 200, `Expected 200, got ${resHistory.statusCode}`);
    const historyJson = resHistory.json();
    assert(Array.isArray(historyJson.data), 'Expected history data array');
    logger.info({ historyPoints: historyJson.data.length }, '[PASS] Get Monitor History');

    // 11. Delete Monitor: DELETE /api/v1/monitors/:id
    logger.info(`Test 11: Delete Monitor DELETE /api/v1/monitors/${createdMonitorId} (200)`);
    const resDelete = await app.inject({
      method: 'DELETE',
      url: `/api/v1/monitors/${createdMonitorId}`,
    });
    assert(resDelete.statusCode === 200, `Expected 200, got ${resDelete.statusCode}`);
    logger.info('[PASS] Delete Monitor');

    // 12. Confirm Deletion: Subsequent GET returns 404
    logger.info(`Test 12: Confirm Monitor Deletion (404)`);
    const resConfirmDelete = await app.inject({
      method: 'GET',
      url: `/api/v1/monitors/${createdMonitorId}`,
    });
    assert(resConfirmDelete.statusCode === 404, `Expected 404 after deletion, got ${resConfirmDelete.statusCode}`);
    logger.info('[PASS] Confirm Monitor Deletion');

    logger.info('=====================================================');
    logger.info('ALL 12 REST API INTEGRATION TESTS PASSED SUCCESSFULLY!');
    logger.info('=====================================================');
  } finally {
    await app.close();
    await closeDb();
    await closeRedisConnection();
  }
}

runApiTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('API Integration Test Failed:', err);
    process.exit(1);
  });

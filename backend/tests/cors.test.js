const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');

process.env.NODE_ENV = 'production';
process.env.FRONTEND_URL = 'https://feedback-portal.example';

const app = require('../app');
let server;
let baseUrl;

before(async function () {
  server = await new Promise(function (resolve, reject) {
    const listener = app.listen(0, '127.0.0.1', function () {
      resolve(listener);
    });
    listener.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

after(async function () {
  if (!server) return;
  await new Promise(function (resolve, reject) {
    server.close(function (error) {
      if (error) reject(error);
      else resolve();
    });
  });
});

test('allows the configured production frontend origin', async function () {
  const response = await fetch(`${baseUrl}/health`, {
    headers: { Origin: 'https://feedback-portal.example' }
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://feedback-portal.example');
});

test('rejects unconfigured origins in production', async function () {
  const response = await fetch(`${baseUrl}/health`, {
    headers: { Origin: 'http://localhost:5500' }
  });

  assert.equal(response.status, 403);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
});

test('allows health checks without a browser origin', async function () {
  const response = await fetch(`${baseUrl}/health`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
});

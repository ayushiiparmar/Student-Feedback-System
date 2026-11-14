'use strict';

const fs = require('node:fs');
const path = require('node:path');

const configuredApiUrl = process.env.API_BASE_URL;
if (!configuredApiUrl) {
  throw new Error('API_BASE_URL is required to build the production frontend.');
}

let apiUrl;
try {
  apiUrl = new URL(configuredApiUrl);
} catch (error) {
  throw new Error('API_BASE_URL must be an absolute HTTPS URL ending in /api.');
}

if (
  apiUrl.protocol !== 'https:'
  || apiUrl.pathname.replace(/\/+$/, '') !== '/api'
  || apiUrl.username
  || apiUrl.password
  || apiUrl.search
  || apiUrl.hash
) {
  throw new Error('API_BASE_URL must be an absolute HTTPS URL ending in /api and contain no credentials or query string.');
}

const apiBaseUrl = `${apiUrl.origin}/api`;
const generatedConfig = `window.SRU_FEEDBACK_CONFIG = Object.freeze({ apiBaseUrl: ${JSON.stringify(apiBaseUrl)}, demoAccountsEnabled: false });\n`;
fs.writeFileSync(path.join(__dirname, 'config.js'), generatedConfig, 'utf8');
console.log('Production frontend API configuration generated; local demo login is disabled.');

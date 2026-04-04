const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Read from .env
const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
let ucmUser = '', ucmPassword = '';
for (const line of envContent.split('\n')) {
  if (line.startsWith('UCM_ADMIN_USER=')) ucmUser = line.split('=').slice(1).join('=').trim();
  if (line.startsWith('UCM_ADMIN_PASSWORD=')) ucmPassword = line.split('=').slice(1).join('=').trim();
}

function apiCall(apiPath, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: '192.168.7.2', port: 8089, path: apiPath, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      rejectUnauthorized: false, timeout: 10000
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch(e) { resolve({ raw: body }); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function tryLogin(label, apiPath, user, challenge, tokenStr) {
  const token = crypto.createHash('md5').update(tokenStr).digest('hex');
  const login = await apiCall(apiPath, { request: { action: 'login', token, user } });
  console.log(`  ${label}: status=${login.status}`, login.response ? JSON.stringify(login.response) : '');
  return login;
}

async function test() {
  console.log('User:', ucmUser, '| Password:', ucmPassword, '| Length:', ucmPassword.length);

  // Get challenge from /api
  console.log('\n=== Getting challenge from /api ===');
  const ch1 = await apiCall('/api', { request: { action: 'challenge', user: ucmUser, version: '1.2' } });
  console.log('Challenge:', ch1.response?.challenge, '| Status:', ch1.status);

  if (ch1.status !== 0) { console.log('Challenge failed!'); return; }
  const c1 = ch1.response.challenge;

  // Try different token formats on /api
  console.log('\n=== Login attempts on /api ===');
  await tryLogin('MD5(challenge+pass)', '/api', ucmUser, c1, c1 + ucmPassword);

  // Get fresh challenge for each attempt
  const ch2 = await apiCall('/api', { request: { action: 'challenge', user: ucmUser, version: '1.2' } });
  const c2 = ch2.response.challenge;
  await tryLogin('MD5(pass+challenge)', '/api', ucmUser, c2, ucmPassword + c2);

  const ch3 = await apiCall('/api', { request: { action: 'challenge', user: ucmUser, version: '1.2' } });
  const c3 = ch3.response.challenge;
  await tryLogin('MD5(user+challenge+pass)', '/api', ucmUser, c3, ucmUser + c3 + ucmPassword);

  // Try SHA256 instead of MD5
  const ch4 = await apiCall('/api', { request: { action: 'challenge', user: ucmUser, version: '1.2' } });
  const c4 = ch4.response.challenge;
  const sha256token = crypto.createHash('sha256').update(c4 + ucmPassword).digest('hex');
  const loginSha = await apiCall('/api', { request: { action: 'login', token: sha256token, user: ucmUser } });
  console.log(`  SHA256(challenge+pass): status=${loginSha.status}`, loginSha.response ? JSON.stringify(loginSha.response) : '');

  // Try on /api/v2
  console.log('\n=== Login attempts on /api/v2 ===');
  const ch5 = await apiCall('/api/v2', { request: { action: 'challenge', user: ucmUser, version: '1.2' } });
  const c5 = ch5.response?.challenge;
  if (c5) {
    await tryLogin('/api/v2 MD5(challenge+pass)', '/api/v2', ucmUser, c5, c5 + ucmPassword);
  }

  // Try with web GUI admin credentials (dipesh) on new API
  console.log('\n=== Try web GUI admin user on /api ===');
  const ch6 = await apiCall('/api', { request: { action: 'challenge', user: 'dipesh', version: '1.2' } });
  if (ch6.status === 0) {
    const c6 = ch6.response.challenge;
    // Read dipesh password from known value
    const dipeshPass = 'Welcome@2027##$';
    await tryLogin('dipesh MD5(challenge+pass)', '/api', 'dipesh', c6, c6 + dipeshPass);
  } else {
    console.log('  dipesh challenge: status', ch6.status);
  }

  console.log('\n=== Done. No more attempts. ===');
}

test().catch(e => console.error('Error:', e));

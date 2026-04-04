const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Read password directly from .env file to avoid shell escaping issues
const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
const envLines = envContent.split('\n');
let ucmUser = '';
let ucmPassword = '';
for (const line of envLines) {
  if (line.startsWith('UCM_ADMIN_USER=')) ucmUser = line.split('=').slice(1).join('=').trim();
  if (line.startsWith('UCM_ADMIN_PASSWORD=')) ucmPassword = line.split('=').slice(1).join('=').trim();
}

console.log('UCM User:', ucmUser);
console.log('UCM Password length:', ucmPassword.length, 'chars');
console.log('UCM Password last 4 chars:', ucmPassword.slice(-4));

function apiCall(body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: '192.168.7.2', port: 8089, path: '/api', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      rejectUnauthorized: false, timeout: 10000
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch(e) { reject(body); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function test() {
  // Step 1: Challenge
  console.log('\n=== Step 1: Challenge ===');
  const ch = await apiCall({ request: { action: 'challenge', user: ucmUser, version: '1.2' } });
  console.log('Status:', ch.status);

  if (ch.status !== 0) {
    console.log('STOPPED: User not recognized. Status:', ch.status);
    console.log('Full response:', JSON.stringify(ch));
    return;
  }

  const challenge = ch.response.challenge;
  console.log('Challenge received:', challenge);

  // Step 2: MD5(challenge + password)
  const token = crypto.createHash('md5').update(challenge + ucmPassword).digest('hex');
  console.log('\n=== Step 2: Login ===');
  console.log('MD5 input length:', (challenge + ucmPassword).length);

  const login = await apiCall({ request: { action: 'login', token: token, user: ucmUser } });
  console.log('Login status:', login.status);
  console.log('Full response:', JSON.stringify(login));

  if (login.status !== 0) {
    console.log('\nSTOPPED: Login failed. NOT retrying.');
    console.log('remain_num:', login.response?.remain_num);
    return;
  }

  const cookie = login.response.cookie;
  console.log('\n=== SUCCESS! Connected to UCM6304 ===');

  // Step 3: List extensions (read-only)
  console.log('\n=== Step 3: List Extensions ===');
  const list = await apiCall({ request: { action: 'listAccount', cookie: cookie, page: 1, item_num: 50 } });
  console.log('Status:', list.status);
  if (list.status === 0 && list.response) {
    console.log('Total extensions:', list.response.total_item || 'unknown');
    if (list.response.account) {
      list.response.account.forEach(acc => {
        console.log('  Ext:', acc.extension, '| Name:', acc.account_name || acc.callerid_name || 'N/A');
      });
    }
  }

  // Step 4: Logout
  console.log('\n=== Step 4: Logout ===');
  await apiCall({ request: { action: 'logout', cookie: cookie } });
  console.log('Logged out cleanly.');
}

test().catch(e => console.error('Error:', e));

#!/usr/bin/env node
// Debug customer API request with cookie
const http = require('http');

let authCookie = null;

const TEST_CREDENTIALS = {
  email: 'admin@trade-erp.com',
  password: 'Admin123!'
};

function login() {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(TEST_CREDENTIALS);
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    
    const req = http.request(options, (res) => {
      let cookies = res.headers['set-cookie'];
      if (cookies) {
        if (!Array.isArray(cookies)) cookies = [cookies];
        const authCookieStr = cookies.find(c => c.startsWith('auth-token='));
        if (authCookieStr) {
          authCookie = authCookieStr.split(';')[0];
          console.log('Login OK, got cookie');
        }
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function getCustomers() {
  return new Promise((resolve, reject) => {
    console.log('\nGetting /api/customers...');
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/customers',
      method: 'GET',
      headers: {
        'Cookie': authCookie,
        'Host': 'localhost:3000'
      }
    };
    
    const req = http.request(options, (res) => {
      console.log('Status:', res.statusCode);
      console.log('Headers:', JSON.stringify(res.headers, null, 2));
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('\nResponse:', data);
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  await login();
  await getCustomers();
}

main().catch(console.error);

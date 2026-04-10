#!/usr/bin/env node
const http = require('http');

const data = JSON.stringify({
  email: 'admin@trade-erp.com',
  password: 'Admin123!'
});

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
  },
};

const req = http.request(options, (res) => {
  console.log('Status Code:', res.statusCode);
  console.log('Headers:', res.headers);
  
  const cookies = res.headers['set-cookie'];
  if (cookies) {
    console.log('\nCookies:');
    cookies.forEach(cookie => {
      console.log(cookie);
      if (cookie.startsWith('auth-token=')) {
        const token = cookie.split(';')[0].split('=')[1];
        console.log('\n✅ Extracted auth-token:\n' + token);
        // Print just the token for easy use
        console.log('\n---TOKEN-BEGIN---\n' + token + '\n---TOKEN-END---');
      }
    });
  }

  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });
  res.on('end', () => {
    console.log('\nResponse Body:');
    console.log(body);
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
});
req.write(data);
req.end();

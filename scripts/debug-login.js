#!/usr/bin/env node
// Debug login and cookie extraction
const http = require('http');

const TEST_CREDENTIALS = {
  email: 'admin@trade-erp.com',
  password: 'Admin123!'
};

function main() {
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
    
    console.log('Sending login request...');
    
    const req = http.request(options, (res) => {
      console.log('\nStatus Code:', res.statusCode);
      console.log('\nHeaders:');
      for (const [key, value] of Object.entries(res.headers)) {
        console.log(`  ${key}: ${value}`);
      }
      
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log('\nBody:');
        console.log(data);
        resolve();
      });
    });
    
    req.on('error', (err) => {
      console.error('Error:', err);
      reject(err);
    });
    
    req.write(body);
    req.end();
  });
}

main().catch(console.error);

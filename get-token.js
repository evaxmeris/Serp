const http = require('http');

const data = JSON.stringify({
  email: 'admin@example.com',
  password: 'Admin123!'
});

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });
  res.on('end', () => {
    console.log(body);
  });
});

req.on('error', (e) => {
  console.error(e.message);
});

req.write(data);
req.end();

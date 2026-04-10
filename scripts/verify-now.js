const { jwtVerify } = require('jose');

const token = 'eyJhbGciOiJIUzI1NiJ9.eyJpZCI6ImNtbmc3djNzZjAwMDBzOTZ5dHAybnhkcTYiLCJlbWFpbCI6ImFkbWluQHRyYWRlLWVycC5jb20iLCJuYW1lIjoiNTtO71+16WOh55CG5ZGYiLCJyb2xlIjoiQURNSU4iLCJpYXQiOjE3NDY4MDM0OTYsImV4cCI6MTc3NjMyMzQ5Nn0.4SFzGTs61wV7mg6yXmYOomTlZMb7qKCNR15-JGPdbDY';
const SECRET = new TextEncoder().encode('TradeERP_Dev_Secret_Key_2026');

async function verify() {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    console.log('✅ Verification successful!');
    console.log('Payload:', payload);
  } catch (error) {
    console.log('❌ Verification failed:');
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
  }
}

verify();

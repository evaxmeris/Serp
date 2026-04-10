const { jwtVerify } = require('jose');

// Full token from cookie
const token = 'eyJhbGciOiJIUzI1NiJ9.eyJpZCI6ImNtbmc3djNzZjAwMDBzOTZ5dHAybnhkcTYiLCJlbWFpbCI6ImFkbWluQHRyYWRlLWVycC5jb20iLCJuYW1lIjoiNTtO71+16WOh55CG5ZGYiLCJyb2xlIjoiQURNSU4iLCJpYXQiOjE3NDY4MDM1NTIsImV4cCI6MTc3NjMyMzE1Mn0.lkRYlcrM1j8hO-WEYpM8gFISe665p0Fe4yiPnDdlfTs';

// Get secret from environment
const SECRET = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);

console.log('Token length:', token.length);
console.log('Token:', token);
console.log('Secret:', process.env.NEXTAUTH_SECRET);
console.log('Secret length:', SECRET.length);

async function verify() {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    console.log('\n✅ Verification successful!');
    console.log('Payload:', payload);
  } catch (error) {
    console.log('\n❌ Verification failed:');
    console.error('Error name:', error.name);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
  }
}

verify();

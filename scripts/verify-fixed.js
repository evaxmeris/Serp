const { jwtVerify, SignJWT } = require('jose');

const token = 'eyJhbGciOiJIUzI1NiJ9.eyJpZCI6ImNtbmc3djNzZjAwMDBzOTZ5dHAybnhkcTYiLCJlbWFpbCI6ImFkbWluQHRyYWRlLWVycC5jb20iLCJuYW1lIjoiNTtO71+16WOh55CG5ZGYiLCJyb2xlIjoiQURNSU4iLCJpYXQiOjE3NDY4MDM0MjksImV4cCI6MTc3NjMyMzQyOX0=.MjhHTUpkN1F3ZXd4WVJhUVFGMmZpVjY5MDFxVzczNUFabm0xblFWbzNrUA==';
const SECRET = new TextEncoder().encode('TradeERP_Dev_Secret_Key_2026');

async function verify() {
  try {
    // Remove any extra dots/spaces
    const cleanToken = token.trim().replace(/\s+/g, '');
    console.log('Clean token:', cleanToken);
    
    const { payload } = await jwtVerify(cleanToken, SECRET);
    console.log('\n✅ Verification successful!');
    console.log('Payload:', payload);
    
    // Re-sign to compare
    const newToken = await new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .sign(SECRET);
    
    console.log('\nRe-signed token:', newToken);
    
  } catch (error) {
    console.log('\n❌ Verification failed:');
    console.error('Error name:', error.name);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
  }
}

verify();

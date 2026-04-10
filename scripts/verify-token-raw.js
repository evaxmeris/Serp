const { jwtVerify } = require('jose');

// Original token from cookie:
// auth-token=eyJhbGciOiJIUzI1NiJ9.eyJpZCI6ImNtbmc3djNzZjAwMDBzOTZ5dHAybnhkcTYiLCJlbWFpbCI6ImFkbWluQHRyYWRlLWVycC5jb20iLCJuYW1lIjoi57O757uf566h55CG5ZGYIiwicm9sZSI6IkFETUlOIiwiaWF0IjoxNzQ2ODAzNTUyLCJleHAiOjE3NzYzMjMxNTJ9.lkRYlcrM1j8hO-WEYpM8gFISe665p0Fe4yiPnDdlfTs
const token = 'eyJhbGciOiJIUzI1NiJ9.eyJpZCI6ImNtbmc3djNzZjAwMDBzOTZ5dHAybnhkcTYiLCJlbWFpbCI6ImFkbWluQHRyYWRlLWVycC5jb20iLCJuYW1lIjoi57O757uf566h55CG5ZGYIiwicm9sZSI6IkFETUlOIiwiaWF0IjoxNzQ2ODAzNTUyLCJleHAiOjE3NzYzMjMxNTJ9.lkRYlcrM1j8hO-WEYpM8gFISe665p0Fe4yiPnDdlfTs';
const SECRET = new TextEncoder().encode('TradeERP_Dev_Secret_Key_2026');

async function verify() {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    console.log('✅ Verification successful!');
    console.log('Payload:', payload);
  } catch (error) {
    console.log('❌ Verification failed:');
    console.error(error);
    console.log('\nError code:', error.code);
  }
}

verify();

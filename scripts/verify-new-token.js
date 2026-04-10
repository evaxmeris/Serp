const { jwtVerify } = require('jose');

const token = 'eyJhbGciOiJIUzI1NiJ9.eyJpZCI6ImNtbmc3djNzZjAwMDBzOTZ5dHAybnhkcTYiLCJlbWFpbCI6ImFkbWluQHRyYWRlLWVycC5jb20iLCJuYW1lIjoiNTtO71+16WOh55CG5ZGYiLCJyb2xlIjoiQURNSU4iLCJleHAiOjE3NzYzMjMyNTN9.AJ8Cg0+xmWz28Q+O8JzZ/qcO8sS2Kp6d03NQo+W+yLcY';
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

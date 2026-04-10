const { jwtVerify, SignJWT } = require('jose');
const SECRET = new TextEncoder().encode('TradeERP_Dev_Secret_Key_2026');

async function test() {
  // 创建 token
  const token = await new SignJWT({
    id: 'cmng7v3sf0000s96ytp2nxdq6',
    email: 'admin@trade-erp.com',
    name: '系统管理员',
    role: 'ADMIN'
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(SECRET);

  console.log('Generated token:', token);
  console.log('');

  // 验证 token
  try {
    const { payload } = await jwtVerify(token, SECRET);
    console.log('✅ Verification successful!');
    console.log('Payload:', payload);
  } catch (error) {
    console.log('❌ Verification failed:');
    console.error(error);
  }
}

test();

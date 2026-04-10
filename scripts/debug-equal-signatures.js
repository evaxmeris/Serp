const { SignJWT } = require('jose');
const SECRET = new TextEncoder().encode('TradeERP_Dev_Secret_Key_2026');

async function createToken() {
  const token = await new SignJWT({
    id: 'cmng7v3sf0000s96ytp2nxdq6',
    email: 'admin@trade-erp.com',
    name: '系统管理员',
    role: 'ADMIN',
    iat: 1746803429,
    exp: 1776323429,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .sign(SECRET);
  
  console.log('Token:', token);
  console.log('Signature part:', token.split('.')[2]);
}

createToken();

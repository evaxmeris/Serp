#!/usr/bin/env node
/**
 * 重置 admin 账号密码
 * 用法：node scripts/reset-admin-password.js
 */

const bcrypt = require('bcryptjs');

async function main() {
  const newPassword = 'Admin123!';
  const hash = bcrypt.hashSync(newPassword, 10);
  
  console.log('新密码:', newPassword);
  console.log('密码哈希:', hash);
  console.log('\n执行 SQL:');
  console.log(`UPDATE users SET "passwordHash" = '${hash}' WHERE email = 'admin@trade-erp.com';`);
}

main();

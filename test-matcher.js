
// 测试当前 matcher 正则表达式
const regex = /((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)/;

// 测试各种路径
const testPaths = [
  '/',           // 首页
  '/dashboard',  // 页面路由
  '/orders',     // 页面路由  
  '/login',      // 登录页
  '/api/orders', // API 路由
  '/_next/static/css/app.css',
  '/favicon.ico',
  '/image.png',
];

console.log('Testing current regex:', regex);
console.log('=' + '='.repeat(50));
testPaths.forEach(path => {
  const match = path.match(regex);
  console.log(`Path: ${path} -> matched: ${!!match}, captured: ${match?.[0]}`);
});

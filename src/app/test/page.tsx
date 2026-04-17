export default function TestPage() {
  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif' }}>
      <h1>✅ 开发服务器测试</h1>
      <p>如果你能看到这个页面，说明开发服务器运行正常！</p>
      <p>时间：{new Date().toLocaleString('zh-CN')}</p>
    </div>
  );
}

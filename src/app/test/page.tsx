'use client';

export default function TestPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">✅ 测试页面</h1>
        <p className="text-xl">如果能看到这个页面，说明系统正常</p>
        <div className="mt-8 space-y-4">
          <div>
            <a href="/" className="text-blue-600 hover:underline block">← 返回首页</a>
          </div>
          <div>
            <a href="/customers" className="text-blue-600 hover:underline block">客户管理</a>
          </div>
          <div>
            <a href="/products" className="text-blue-600 hover:underline block">产品管理</a>
          </div>
          <div>
            <a href="/inquiries" className="text-blue-600 hover:underline block">询盘管理</a>
          </div>
        </div>
      </div>
    </div>
  );
}

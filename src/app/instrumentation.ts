/**
 * Next.js Instrumentation
 * 
 * 在服务器启动时执行初始化代码
 * 官方文档：https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 */

export async function register() {
  // 仅在 Node.js 服务器端运行
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[Instrumentation] Server starting...');
    
    try {
      // 动态导入同步调度器（避免客户端打包错误）
      const { initSyncScheduler } = await import('@/lib/sync/scheduler');
      await initSyncScheduler();
      console.log('[Instrumentation] Sync scheduler initialized successfully');
    } catch (error) {
      console.error('[Instrumentation] Failed to initialize sync scheduler:', error);
    }
    
    // 这里可以添加其他初始化逻辑
    // 例如：数据库连接池预热、缓存预加载等
  }
}

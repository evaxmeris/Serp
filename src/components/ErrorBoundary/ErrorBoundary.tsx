'use client';

/**
 * 错误边界组件
 * 捕获子组件树中的 JavaScript 错误，显示友好的错误信息
 */

import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('错误边界捕获:', error, errorInfo);
    this.setState({ errorInfo });
    
    // 在生产环境，可以将错误发送到错误追踪服务
    if (process.env.NODE_ENV === 'production') {
      // TODO: 集成错误追踪服务 (Sentry, etc.)
      console.error('生产环境错误:', {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      });
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[60vh] flex items-center justify-center p-4">
          <Card className="max-w-md w-full border-red-200 dark:border-red-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertCircle className="h-6 w-6" />
                出错了
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-zinc-600 dark:text-zinc-400">
                <p>抱歉，页面遇到了一些问题。</p>
                {process.env.NODE_ENV === 'development' && this.state.error && (
                  <details className="mt-2 text-xs font-mono bg-zinc-100 dark:bg-zinc-800 p-2 rounded">
                    <summary className="cursor-pointer">错误详情</summary>
                    <p className="mt-1 text-red-600">{this.state.error.message}</p>
                    {this.state.error.stack && (
                      <pre className="mt-2 overflow-auto max-h-40">
                        {this.state.error.stack}
                      </pre>
                    )}
                  </details>
                )}
              </div>
              
              <div className="flex gap-2">
                <Button onClick={this.handleRetry} className="flex-1">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  重试
                </Button>
                <Button onClick={this.handleGoHome} variant="outline" className="flex-1">
                  <Home className="h-4 w-4 mr-2" />
                  返回首页
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

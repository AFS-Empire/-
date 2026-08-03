/**
 * 全局错误边界 — 捕获子组件渲染异常，防止整个应用白屏
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-ink-950 p-6">
          <div className="max-w-sm text-center space-y-4">
            <div className="text-6xl">⚠️</div>
            <h1 className="text-xl font-bold text-gold-200">页面出错了</h1>
            <p className="text-sm text-ink-400 leading-relaxed">
              应用遇到了意外错误。
              <br />
              尝试刷新页面，如果问题持续请重新安装。
            </p>
            {this.state.error && (
              <details className="text-left text-xs text-ink-600 bg-ink-900/60 rounded-lg p-3 border border-ink-800">
                <summary className="cursor-pointer text-ink-500">错误详情</summary>
                <pre className="mt-2 whitespace-pre-wrap break-all">{this.state.error.message}</pre>
              </details>
            )}
            <button onClick={this.handleReload} className="btn-gold w-full">
              刷新页面
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let friendly = 'เกิดข้อผิดพลาดที่ไม่คาดคิดในการทำงานของระบบ';
    try {
      const parsed = JSON.parse(error.message) as { error?: string };
      if (parsed && typeof parsed.error === 'string') {
        friendly = parsed.error.includes('permission') || parsed.error.includes('PERMISSION_DENIED')
          ? 'สิทธิ์การเข้าถึงข้อมูล Firebase ไม่เพียงพอ กรุณาเข้าสู่ระบบด้วยบัญชี HR ที่ได้รับอนุญาต'
          : 'ไม่สามารถเชื่อมต่อฐานข้อมูล Firebase ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง';
      }
    } catch {
      if (error.message) {
        friendly = error.message;
      }
    }
    return { hasError: true, message: friendly };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Application ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#a8dfd0] p-4">
          <div className="glass-panel max-w-md w-full rounded-3xl p-6 text-center shadow-xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h2 className="font-display mt-4 text-lg font-bold text-teal-950">
              ขออภัย เกิดข้อผิดพลาดชั่วคราว
            </h2>
            <p className="mt-2 text-sm text-teal-900/80">{this.state.message}</p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, message: '' });
                window.location.reload();
              }}
              className="btn-lift mt-5 inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-teal-800 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-900 cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" />
              <span>โหลดหน้าใหม่</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

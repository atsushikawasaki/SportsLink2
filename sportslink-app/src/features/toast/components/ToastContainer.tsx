'use client';

import { useToastStore } from '../hooks/useToastStore';

const typeStyles = {
  success: 'bg-green-500/20 border-green-500/30 text-green-400',
  error: 'bg-red-500/20 border-red-500/30 text-red-400',
  info: 'bg-blue-500/20 border-blue-500/30 text-blue-400',
};

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-md w-full mx-4"
      role="region"
      aria-label="通知"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`px-4 py-3 rounded-lg border backdrop-blur-xl shadow-lg ${typeStyles[toast.type]}`}
          role="alert"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium flex-1">{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 p-1 hover:opacity-80 transition-opacity"
              aria-label="閉じる"
            >
              <span className="text-lg leading-none">×</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

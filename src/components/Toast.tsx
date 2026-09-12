import { X } from 'lucide-react';
import type { ToastData } from '../types';

interface ToastProps {
  toast: ToastData;
  onDismiss: () => void;
}

export function Toast({ toast, onDismiss }: ToastProps) {
  return (
    <div className="toast" role="status">
      <span>{toast.message}</span>
      {toast.action && (
        <button
          className="toast-action"
          onClick={() => {
            toast.action?.onClick();
            onDismiss();
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button className="toast-close" aria-label="关闭提示" onClick={onDismiss}>
        <X size={13} />
      </button>
    </div>
  );
}

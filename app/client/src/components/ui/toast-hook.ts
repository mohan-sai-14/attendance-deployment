
import * as React from 'react';

type ToastVariant = 'default' | 'destructive';

interface ToastFunctionProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: ToastVariant;
  duration?: number;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  onActionClick?: () => void;
  actionLabel?: string;
}

interface ToastItem extends ToastFunctionProps {
  id: string;
  open: boolean;
}

type ToastContextType = {
  toasts: ToastItem[];
  toast: (props: ToastFunctionProps) => string;
  dismiss: (id: string) => void;
};

const ToastContext = React.createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const dismiss = React.useCallback((id: string) => {
    setToasts((currentToasts) =>
      currentToasts.filter((toast) => toast.id !== id)
    );
  }, []);

  const toast = React.useCallback(({
    title,
    description,
    variant = 'default',
    duration = 5000,
    open = true,
    onOpenChange,
    className,
    ...props
  }: ToastFunctionProps): string => {
    const id = Math.random().toString(36).substring(2, 9);

    const newToast: ToastItem = {
      id,
      title,
      description,
      variant,
      duration,
      open,
      onOpenChange,
      className,
      ...props,
    };

    setToasts((currentToasts) => [...currentToasts, newToast]);

    if (duration > 0) {
      const timer = setTimeout(() => dismiss(id), duration);
      // Just return the ID, don't return the cleanup function
      return id;
    }

    return id;
  }, [dismiss]);

  const contextValue = React.useMemo(
    () => ({
      toasts,
      toast,
      dismiss,
    }),
    [toasts, toast, dismiss]
  );

  return React.createElement(
    ToastContext.Provider,
    { value: contextValue },
    children
  );
}

export function useToast(): ToastContextType {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

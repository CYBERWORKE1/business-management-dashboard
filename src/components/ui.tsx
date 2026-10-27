
import {
  type ReactNode,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  useEffect,
} from 'react';

export function KpiCard({
  title,
  value,
  subtitle,
  trend,
  trendLabel,
  icon,
  tone = 'default',
}: {
  title: string;
  value: string;
  subtitle?: string;
  trend?: number;
  trendLabel?: string;
  icon?: ReactNode;
  tone?: 'default' | 'positive' | 'warning' | 'negative' | 'info';
}) {
  const iconBg: Record<string, string> = {
    default: 'bg-blue-50 text-blue-600 dark:bg-zinc-700 dark:text-blue-300',
    positive: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
    warning: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
    negative: 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400',
    info: 'bg-blue-50 text-blue-600 dark:bg-zinc-700 dark:text-blue-300',
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 text-slate-800 shadow-sm transition-colors hover:shadow-md dark:border-[#3a3c38] dark:bg-[#292b28] dark:text-zinc-100">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">
            {title}
          </p>
          <p className="mt-1 break-words text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
            {value}
          </p>
        </div>

        {icon && (
          <div className={`shrink-0 rounded-lg p-2.5 ${iconBg[tone]}`}>
            {icon}
          </div>
        )}
      </div>

      {(trend !== undefined || subtitle || trendLabel) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {trend !== undefined && (
            <span
              className={`inline-flex items-center gap-1 text-xs font-semibold ${
                trend >= 0
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-rose-700 dark:text-rose-400'
              }`}
            >
              {trend >= 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}%
            </span>
          )}

          {(trendLabel || subtitle) && (
            <span className="text-xs text-slate-500 dark:text-zinc-400">
              {trendLabel || subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function Card({
  title,
  children,
  actions,
  className = '',
}: {
  title?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white text-slate-800 shadow-sm dark:border-[#3a3c38] dark:bg-[#292b28] dark:text-zinc-100 ${className}`}
    >
      {title && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-[#3a3c38]">
          <h3 className="font-semibold text-slate-800 dark:text-zinc-100">
            {title}
          </h3>
          {actions}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

export function Badge({
  children,
  tone = 'default',
}: {
  children: ReactNode;
  tone?: 'default' | 'positive' | 'warning' | 'negative' | 'info';
}) {
  const tones: Record<string, string> = {
    default: 'bg-slate-100 text-slate-700 dark:bg-zinc-700 dark:text-zinc-200',
    positive: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
    warning: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    negative: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
    info: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  type = 'button',
  disabled = false,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  type?: 'button' | 'submit';
  disabled?: boolean;
  className?: string;
}) {
  const variants: Record<string, string> = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500 disabled:bg-blue-300 dark:disabled:bg-blue-900',
    secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-500 disabled:bg-rose-300 dark:disabled:bg-rose-950',
    ghost: 'text-slate-700 hover:bg-slate-100 focus-visible:ring-blue-500 dark:text-zinc-300 dark:hover:bg-zinc-800',
  };

  const sizes: Record<string, string> = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900 ${variants[variant]} ${sizes[size]} ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${className}`}
    >
      {children}
    </button>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-emerald-500 dark:focus:ring-emerald-950 dark:disabled:bg-zinc-900 ${props.className ?? ''}`}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-950 dark:disabled:bg-zinc-900 ${props.className ?? ''}`}
    />
  );
}

export function Label({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`mb-1 block text-sm font-medium text-slate-700 dark:text-zinc-300 ${className}`}>
      {children}
    </label>
  );
}

export function EmptyState({
  message,
  icon,
}: {
  message: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-slate-500 dark:text-zinc-400">
      {icon && <div className="mb-3">{icon}</div>}
      <p className="text-sm">{message}</p>
    </div>
  );
}

export function LoadingState({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex items-center justify-center py-12">
      <div
        role="status"
        aria-label={message}
        className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600 dark:border-emerald-500"
      />
      <span className="ml-3 text-sm text-slate-600 dark:text-zinc-400">
        {message}
      </span>
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const sizes: Record<string, string> = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="fixed inset-0 cursor-default bg-slate-900/40 backdrop-blur-sm dark:bg-black/70"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative flex max-h-[90vh] w-full flex-col rounded-xl border border-slate-200 bg-white text-slate-800 shadow-xl dark:border-[#3a3c38] dark:bg-[#292b28] dark:text-zinc-100 ${sizes[size]}`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-[#3a3c38]">
          <h2 className="font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-md px-2 py-1 text-xl leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
          >
            &times;
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

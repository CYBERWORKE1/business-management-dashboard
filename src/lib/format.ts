const dateFmt = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Kolkata',
});

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return '-';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '-';
  return dateFmt.format(date);
}

export function formatINR(value: number, opts?: { compact?: boolean; decimals?: number }): string {
  const compact = opts?.compact ?? false;
  const decimals = opts?.decimals ?? (compact ? 2 : 0);
  if (compact) {
    if (Math.abs(value) >= 1e7) return '₹' + (value / 1e7).toFixed(2) + ' Cr';
    if (Math.abs(value) >= 1e5) return '₹' + (value / 1e5).toFixed(2) + ' L';
    if (Math.abs(value) >= 1e3) return '₹' + (value / 1e3).toFixed(2) + ' K';
  }
  return '₹' + new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPercent(value: number, decimals = 1): string {
  return value.toFixed(decimals) + '%';
}

export function parseDate(s: string): Date {
  return new Date(s);
}

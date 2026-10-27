export type DateRangeKey =
  | 'today'
  | 'week'
  | 'month'
  | 'quarter'
  | 'fy'
  | 'custom'
  | 'all';

export type DateRange = { start: Date; end: Date; key: DateRangeKey; label: string };

export function getIndianFY(date: Date): { start: Date; end: Date } {
  const year = date.getFullYear();
  const fyStart = new Date(year, 3, 1); // April 1
  if (date < fyStart) {
    return { start: new Date(year - 1, 3, 1), end: new Date(year, 2, 31) };
  }
  return { start: fyStart, end: new Date(year + 1, 2, 31) };
}

export function getQuarter(date: Date): { start: Date; end: Date } {
  const month = date.getMonth();
  const q = Math.floor(month / 3);
  const start = new Date(date.getFullYear(), q * 3, 1);
  const end = new Date(date.getFullYear(), q * 3 + 3, 0, 23, 59, 59);
  return { start, end };
}

export function getWeek(date: Date): { start: Date; end: Date } {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  const start = new Date(d);
  start.setDate(d.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function getMonth(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
  return { start, end };
}

export function getDateRange(key: DateRangeKey, custom?: { start: Date; end: Date }): DateRange {
  const today = new Date();
  switch (key) {
    case 'today':
      return { start: new Date(today.getFullYear(), today.getMonth(), today.getDate()), end: today, key, label: 'Today' };
    case 'week':
      return { ...getWeek(today), key, label: 'This Week' };
    case 'month':
      return { ...getMonth(today), key, label: 'This Month' };
    case 'quarter':
      return { ...getQuarter(today), key, label: 'This Quarter' };
    case 'fy':
      return { ...getIndianFY(today), key, label: 'Financial Year' };
    case 'custom':
      return custom ? { ...custom, key, label: 'Custom' } : { ...getIndianFY(today), key, label: 'Financial Year' };
    case 'all':
      return { start: new Date(2000, 0, 1), end: new Date(2100, 11, 31), key, label: 'All Time' };
  }
}

export function previousEquivalentRange(range: DateRange): DateRange {
  const start = new Date(range.start);
  const end = new Date(range.end);
  const diffMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1); // day before current start
  const prevStart = new Date(prevEnd.getTime() - diffMs);
  return { start: prevStart, end: prevEnd, key: range.key, label: 'Previous ' + range.label };
}

export function dateInRange(dateStr: string, range: DateRange): boolean {
  const d = new Date(dateStr);
  d.setHours(12, 0, 0, 0);
  const start = new Date(range.start);
  start.setHours(0, 0, 0, 0);
  const end = new Date(range.end);
  end.setHours(23, 59, 59, 999);
  return d >= start && d <= end;
}

export function toDateString(d: Date): string {
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${dy}`;
}

import { useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { type DateRange, type DateRangeKey, getDateRange } from '@/lib/dateRanges';

export function DateRangeFilter({
  range,
  onChange,
}: {
  range: DateRange;
  onChange: (range: DateRange) => void;
}) {
  const [open, setOpen] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const keys: { key: DateRangeKey; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'This Week' },
    { key: 'month', label: 'This Month' },
    { key: 'quarter', label: 'This Quarter' },
    { key: 'fy', label: 'Financial Year' },
    { key: 'all', label: 'All Time' },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        <Calendar size={16} />
        {range.label}
        <ChevronDown size={14} className="text-slate-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-slate-200 z-20 p-2">
            {keys.map((k) => (
              <button
                key={k.key}
                onClick={() => {
                  onChange(getDateRange(k.key));
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium ${
                  range.key === k.key ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {k.label}
              </button>
            ))}
            <div className="border-t border-slate-100 mt-1 pt-2">
              <p className="px-3 py-1 text-xs font-medium text-slate-500">Custom Date Range</p>
              <div className="px-2 py-1 space-y-2">
                <div>
                  <label className="text-xs text-slate-500">Start</label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">End</label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </div>
                <button
                  onClick={() => {
                    if (customStart && customEnd) {
                      onChange(getDateRange('custom', {
                        start: new Date(customStart),
                        end: new Date(customEnd),
                      }));
                      setOpen(false);
                    }
                  }}
                  className="w-full bg-brand-600 text-white rounded-lg py-1.5 text-sm font-medium hover:bg-brand-700"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

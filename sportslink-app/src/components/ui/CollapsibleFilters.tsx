'use client';

import { useState } from 'react';
import { ChevronDown, Filter } from 'lucide-react';

interface CollapsibleFiltersProps {
  children: React.ReactNode;
  label?: string;
}

export default function CollapsibleFilters({ children, label = 'フィルター' }: CollapsibleFiltersProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="md:hidden flex items-center gap-2 w-full py-2.5 px-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-left"
      >
        <Filter className="w-4 h-4 text-slate-400 shrink-0" />
        <span>{label}</span>
        <ChevronDown
          className={`w-4 h-4 ml-auto shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <div className={`${open ? 'block mt-3 md:mt-0' : 'hidden'} md:block`}>{children}</div>
    </div>
  );
}

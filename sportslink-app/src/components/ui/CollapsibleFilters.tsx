'use client';

import { useState } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';

interface CollapsibleFiltersProps {
    children: React.ReactNode;
}

export default function CollapsibleFilters({ children }: CollapsibleFiltersProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="mb-6">
            {/* Mobile toggle */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-300 hover:text-white transition-colors sm:hidden w-full justify-center"
            >
                <SlidersHorizontal className="w-4 h-4" />
                フィルター
                <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Filters content - always visible on sm+, toggleable on mobile */}
            <div className={`${isOpen ? 'block' : 'hidden'} sm:block mt-2 sm:mt-0`}>
                {children}
            </div>
        </div>
    );
}

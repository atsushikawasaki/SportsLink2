'use client';

import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description: string;
    action?: React.ReactNode;
}

export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
    return (
        <div className="text-center py-16">
            <Icon className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-300 mb-2">{title}</h3>
            <p className="text-slate-400 mb-6 max-w-md mx-auto">{description}</p>
            {action && <div>{action}</div>}
        </div>
    );
}

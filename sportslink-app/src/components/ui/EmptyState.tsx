'use client';

import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-12 text-center ${className}`}
    >
      <Icon className="w-16 h-16 text-slate-500 mx-auto mb-4" aria-hidden />
      <p className="text-slate-400 text-lg mb-2">{title}</p>
      {description && <p className="text-slate-500 text-sm mb-4">{description}</p>}
      {action}
    </div>
  );
}

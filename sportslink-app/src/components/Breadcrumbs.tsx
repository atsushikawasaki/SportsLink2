'use client';

import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbItem {
    label: string;
    href?: string;
}

interface BreadcrumbsProps {
    items: BreadcrumbItem[];
}

export default function Breadcrumbs({ items }: BreadcrumbsProps) {
    return (
        <nav className="flex items-center space-x-2 text-sm text-slate-400 mb-4">
            <Link
                href="/dashboard"
                className="flex items-center hover:text-white transition-colors"
            >
                <Home className="w-4 h-4" />
            </Link>
            {items.map((item, index) => (
                <div key={index} className="flex items-center space-x-2">
                    <ChevronRight className="w-4 h-4" />
                    {item.href ? (
                        <Link
                            href={item.href}
                            className="hover:text-white transition-colors"
                        >
                            {item.label}
                        </Link>
                    ) : (
                        <span className="text-white">{item.label}</span>
                    )}
                </div>
            ))}
        </nav>
    );
}


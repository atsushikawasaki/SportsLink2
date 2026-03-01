'use client';

interface AuthKeyDisplayProps {
    token: string;
    size?: 'sm' | 'md' | 'lg';
}

export default function AuthKeyDisplay({ token, size = 'md' }: AuthKeyDisplayProps) {
    const sizeClasses = {
        sm: 'text-xs px-2 py-0.5',
        md: 'text-sm px-3 py-1',
        lg: 'text-base px-4 py-2',
    };

    return (
        <span className={`inline-block font-mono bg-slate-700 text-slate-200 rounded ${sizeClasses[size]}`}>
            {token}
        </span>
    );
}

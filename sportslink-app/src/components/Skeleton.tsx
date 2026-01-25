'use client';

interface SkeletonProps {
    width?: string | number;
    height?: string | number;
    className?: string;
    rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full';
}

export default function Skeleton({ width, height, className = '', rounded = 'md' }: SkeletonProps) {
    const roundedClass = {
        none: '',
        sm: 'rounded-sm',
        md: 'rounded-md',
        lg: 'rounded-lg',
        full: 'rounded-full',
    }[rounded];

    const style: React.CSSProperties = {};
    if (width) {
        style.width = typeof width === 'number' ? `${width}px` : width;
    }
    if (height) {
        style.height = typeof height === 'number' ? `${height}px` : height;
    }

    return (
        <div
            className={`bg-slate-700/50 animate-pulse ${roundedClass} ${className}`}
            style={style}
            aria-label="読み込み中"
        />
    );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
    return (
        <div className={`p-6 bg-slate-800/50 rounded-xl border border-slate-700/50 ${className}`}>
            <Skeleton width="60%" height={24} className="mb-4" />
            <Skeleton width="100%" height={16} className="mb-2" />
            <Skeleton width="80%" height={16} />
        </div>
    );
}

export function SkeletonList({ count = 3, className = '' }: { count?: number; className?: string }) {
    return (
        <div className={`space-y-4 ${className}`}>
            {Array.from({ length: count }).map((_, i) => (
                <SkeletonCard key={i} />
            ))}
        </div>
    );
}

export function SkeletonGrid({ count = 6, className = '' }: { count?: number; className?: string }) {
    return (
        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${className}`}>
            {Array.from({ length: count }).map((_, i) => (
                <SkeletonCard key={i} />
            ))}
        </div>
    );
}


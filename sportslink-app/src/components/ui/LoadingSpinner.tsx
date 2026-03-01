interface LoadingSpinnerProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'h-6 w-6 border-2',
  md: 'h-12 w-12 border-4',
  lg: 'h-16 w-16 border-4',
};

export default function LoadingSpinner({ className = '', size = 'md' }: LoadingSpinnerProps) {
  return (
    <div
      className={`animate-spin rounded-full border-blue-500 border-t-transparent ${sizeClasses[size]} ${className}`}
      aria-label="読み込み中"
    />
  );
}

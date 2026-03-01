'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface AuthKeyDisplayProps {
  token: string;
  size?: 'sm' | 'lg';
  className?: string;
}

export default function AuthKeyDisplay({ token, size = 'sm', className = '' }: AuthKeyDisplayProps) {
  const [visible, setVisible] = useState(false);
  const textSize = size === 'lg' ? 'text-3xl' : 'text-2xl';

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className={`font-bold text-blue-400 font-mono ${textSize}`}>
        {visible ? token : '••••'}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setVisible((v) => !v);
        }}
        className="p-1 text-slate-400 hover:text-white transition-colors"
        title={visible ? '非表示にする' : '表示する'}
        aria-label={visible ? '認証キーを非表示にする' : '認証キーを表示する'}
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

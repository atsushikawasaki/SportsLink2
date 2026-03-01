'use client';

import { useEffect, useRef } from 'react';
import { useConfirmStore } from '../hooks/useConfirmStore';
import Button from '@/components/ui/Button';

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export default function ConfirmModalGlobal() {
  const { isOpen, title, message, confirmLabel, close } = useConfirmStore();
  const contentRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !contentRef.current) return;
      const focusables = contentRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      document.addEventListener('keydown', handleEscape);
      document.addEventListener('keydown', handleKeyDown);
      requestAnimationFrame(() => {
        const first = contentRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
        first?.focus();
      });
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [isOpen, close]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => close(false)}
        aria-hidden
      />
      <div ref={contentRef} tabIndex={-1} className="relative bg-slate-800 rounded-xl shadow-xl border border-slate-700 max-w-md w-full mx-4 p-6 animate-fade-in">
        <h2 id="confirm-modal-title" className="text-xl font-semibold text-white mb-4">
          {title}
        </h2>
        <p className="text-slate-400 mb-6">{message}</p>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={() => close(false)}>
            キャンセル
          </Button>
          <Button onClick={() => close(true)}>{confirmLabel ?? '確認'}</Button>
        </div>
      </div>
    </div>
  );
}

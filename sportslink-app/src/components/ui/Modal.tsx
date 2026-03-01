'use client';

import { useEffect, useRef } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export default function Modal({ isOpen, onClose, title, children, className = '' }: ModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
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
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(() => {
        const first = contentRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
        first?.focus();
      });
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
      previousFocusRef.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      <div
        className="absolute inset-0 bg-black/50 transition-opacity duration-200"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={contentRef}
        tabIndex={-1}
        className={`relative bg-slate-800 rounded-xl shadow-xl border border-slate-700 max-w-md w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col animate-fade-in ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <h2 id="modal-title" className="text-xl font-semibold text-white p-6 pb-0">
            {title}
          </h2>
        )}
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

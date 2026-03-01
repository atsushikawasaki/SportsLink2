import { create } from 'zustand';

interface ConfirmState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  resolveRef: ((value: boolean) => void) | null;
  open: (params: {
    title: string;
    message: string;
    confirmLabel?: string;
  }) => Promise<boolean>;
  close: (result: boolean) => void;
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  isOpen: false,
  title: '',
  message: '',
  resolveRef: null,
  open: ({ title, message, confirmLabel }) => {
    return new Promise<boolean>((resolve) => {
      set({
        isOpen: true,
        title,
        message,
        confirmLabel,
        resolveRef: resolve,
      });
    });
  },
  close: (result) => {
    const { resolveRef } = get();
    resolveRef?.(result);
    set({ isOpen: false, resolveRef: null });
  },
}));

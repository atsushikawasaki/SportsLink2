import { useToastStore } from '@/features/toast/hooks/useToastStore';
import { useConfirmStore } from '@/features/confirm/hooks/useConfirmStore';

export const toast = {
  success: (message: string) => {
    useToastStore.getState().addToast({ type: 'success', message });
  },
  error: (message: string) => {
    useToastStore.getState().addToast({ type: 'error', message });
  },
  info: (message: string) => {
    useToastStore.getState().addToast({ type: 'info', message });
  },
};

export const confirmAsync = (params: {
  title: string;
  message: string;
  confirmLabel?: string;
}) => useConfirmStore.getState().open(params);

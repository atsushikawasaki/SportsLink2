/**
 * Simple toast notification and confirmation dialog utilities.
 * Uses window.alert/confirm as lightweight implementations.
 */

export const toast = {
    success: (message: string) => {
        console.info('[toast:success]', message);
    },
    error: (message: string) => {
        console.error('[toast:error]', message);
    },
    info: (message: string) => {
        console.info('[toast:info]', message);
    },
    warning: (message: string) => {
        console.warn('[toast:warning]', message);
    },
};

interface ConfirmOptions {
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
}

export async function confirmAsync(options: ConfirmOptions): Promise<boolean> {
    return window.confirm(options.message);
}

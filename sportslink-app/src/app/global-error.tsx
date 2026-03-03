'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        Sentry.captureException(error);
    }, [error]);

    return (
        <html>
            <body style={{ background: '#0f1d23', color: '#e8f1f5', fontFamily: 'sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', margin: 0 }}>
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>予期しないエラーが発生しました</h2>
                    <button
                        onClick={reset}
                        style={{ padding: '0.5rem 1.5rem', background: '#00a0eb', color: '#fff', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '1rem' }}
                    >
                        再試行
                    </button>
                </div>
            </body>
        </html>
    );
}

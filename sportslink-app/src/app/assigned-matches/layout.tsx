import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: '担当試合 | SportsLink',
    description: '担当する試合の一覧とスコア入力',
};

export default function AssignedMatchesLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}

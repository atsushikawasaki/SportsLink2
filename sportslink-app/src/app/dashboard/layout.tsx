import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'ダッシュボード | SportsLink',
    description: '大会の管理状況と担当試合を確認できます',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}

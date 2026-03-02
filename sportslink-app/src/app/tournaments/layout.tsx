import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: '大会一覧 | SportsLink',
    description: 'スポーツ大会の作成・管理・運営ができます',
};

export default function TournamentsLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}

import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';

type Props = {
    children: React.ReactNode;
    params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const adminClient = createAdminClient();
    const { data } = await adminClient
        .from('tournaments')
        .select('name, description')
        .eq('id', id)
        .single();

    return {
        title: data?.name ? `${data.name} | SportsLink` : '大会詳細 | SportsLink',
        description: data?.description ?? 'スポーツ大会の管理ページ',
    };
}

export default function TournamentDetailLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}

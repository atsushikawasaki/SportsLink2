import { useQuery } from '@tanstack/react-query';

export interface Match {
    id: string;
    round_name: string;
    match_number: number;
    status: 'pending' | 'inprogress' | 'paused' | 'finished';
    court_number: number | null;
    match_scores?: {
        game_count_a: number;
        game_count_b: number;
    };
    match_pairs?: Array<{
        id: string;
        pair_number: number;
        teams?: { name: string };
    }>;
    tournaments?: {
        id: string;
        name: string;
    };
}

async function fetchUmpireMatches(userId: string): Promise<{ data: Match[] }> {
    const response = await fetch(`/api/matches/umpire/${userId}`);
    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '試合一覧の取得に失敗しました');
    }
    return response.json();
}

export function useUmpireMatches(userId: string | undefined) {
    return useQuery({
        queryKey: ['matches', 'umpire', userId],
        queryFn: () => fetchUmpireMatches(userId!),
        enabled: !!userId,
    });
}

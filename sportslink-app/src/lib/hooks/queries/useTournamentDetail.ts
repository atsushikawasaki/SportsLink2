import { useQueries } from '@tanstack/react-query';

export interface TournamentDetail {
    id: string;
    name: string;
    status: 'draft' | 'published' | 'finished';
    is_public: boolean;
    description: string | null;
    match_format: string | null;
    umpire_mode: 'LOSER' | 'ASSIGNED' | 'FREE';
    start_date: string | null;
    end_date: string | null;
    created_at: string;
}

interface EntriesResponse {
    data: unknown[];
}

interface DrawTreeResponse {
    rounds?: unknown[];
}

async function fetchTournament(id: string): Promise<TournamentDetail> {
    const res = await fetch(`/api/tournaments/${id}`);
    if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '大会の取得に失敗しました');
    }
    return res.json();
}

async function fetchEntries(id: string): Promise<EntriesResponse> {
    const res = await fetch(`/api/tournaments/${id}/entries`);
    if (!res.ok) return { data: [] };
    return res.json();
}

async function fetchDrawTree(id: string): Promise<DrawTreeResponse> {
    const res = await fetch(`/api/tournaments/${id}/draw/tree`);
    if (!res.ok) return {};
    return res.json();
}

export function useTournamentDetail(tournamentId: string) {
    const results = useQueries({
        queries: [
            {
                queryKey: ['tournament', tournamentId],
                queryFn: () => fetchTournament(tournamentId),
            },
            {
                queryKey: ['tournament', tournamentId, 'entries'],
                queryFn: () => fetchEntries(tournamentId),
            },
            {
                queryKey: ['tournament', tournamentId, 'draw'],
                queryFn: () => fetchDrawTree(tournamentId),
            },
        ],
    });

    const [tournamentResult, entriesResult, drawResult] = results;

    return {
        tournament: tournamentResult.data ?? null,
        isLoading: tournamentResult.isLoading,
        error: tournamentResult.error as Error | null,
        entryCount: entriesResult.data?.data?.length ?? 0,
        drawTree: drawResult.data ?? null,
        refetch: tournamentResult.refetch,
    };
}

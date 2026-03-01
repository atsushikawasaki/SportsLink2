import { useQueries } from '@tanstack/react-query';

interface DashboardTournament {
    id: string;
    name: string;
    status: 'draft' | 'published' | 'finished';
    is_public: boolean;
    created_at: string;
}

interface DashboardMatch {
    id: string;
    round_name: string;
    match_number: number;
    status: 'pending' | 'inprogress' | 'finished';
    tournaments?: { id: string; name: string };
    match_pairs?: Array<{ teams?: { name: string } }>;
}

const FETCH_TIMEOUT_MS = 10_000;

async function fetchWithTimeout<T>(url: string, fallback: T): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!res.ok) return fallback;
        return res.json();
    } catch {
        clearTimeout(timeoutId);
        return fallback;
    }
}

export function useDashboard(userId: string | undefined) {
    const results = useQueries({
        queries: [
            {
                queryKey: ['dashboard', 'tournaments'],
                queryFn: () =>
                    fetchWithTimeout<{ data: DashboardTournament[] }>('/api/tournaments?limit=5', { data: [] }),
                staleTime: 30 * 1000,
            },
            {
                queryKey: ['dashboard', 'consent'],
                queryFn: () =>
                    fetchWithTimeout<{ needs_reconsent: boolean }>('/api/auth/consent/check', {
                        needs_reconsent: false,
                    }),
                staleTime: 5 * 60 * 1000,
            },
            {
                queryKey: ['dashboard', 'matches', userId],
                queryFn: () =>
                    fetchWithTimeout<{ data: DashboardMatch[] }>(
                        `/api/matches/umpire/${userId}`,
                        { data: [] }
                    ),
                enabled: !!userId,
                staleTime: 30 * 1000,
            },
        ],
    });

    const [tournamentsResult, consentResult, matchesResult] = results;
    const isLoading = results.some((r) => r.isLoading);

    const tournaments = tournamentsResult.data?.data ?? [];
    const needsReconsent = consentResult.data?.needs_reconsent ?? false;
    const allMatches = matchesResult.data?.data ?? [];
    const assignedMatches = allMatches
        .filter((m) => m.status === 'inprogress' || m.status === 'pending')
        .slice(0, 5);

    const managed = tournaments.length;
    const entered = tournaments.filter(
        (t) => t.status === 'published' || t.status === 'finished'
    ).length;
    const publicCount = tournaments.filter(
        (t) => t.is_public && t.status === 'published'
    ).length;

    return {
        isLoading,
        tournaments,
        assignedMatches,
        needsReconsent,
        tournamentStats: { managed, entered, public: publicCount },
    };
}

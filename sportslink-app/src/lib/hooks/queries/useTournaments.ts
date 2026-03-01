import { useQuery } from '@tanstack/react-query';

export interface Tournament {
    id: string;
    name: string;
    status: 'draft' | 'published' | 'finished';
    is_public: boolean;
    description: string | null;
    start_date: string | null;
    end_date: string | null;
    created_at: string;
}

export interface TournamentsParams {
    limit?: number;
    offset?: number;
    status?: 'all' | 'draft' | 'published' | 'finished';
    search?: string;
    startDate?: string;
    endDate?: string;
}

interface TournamentsResponse {
    data: Tournament[];
    count: number;
    limit: number;
    offset: number;
}

async function fetchTournaments(params: TournamentsParams): Promise<TournamentsResponse> {
    const { limit = 20, offset = 0, status, search, startDate, endDate } = params;
    const searchParams = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
    });
    if (status && status !== 'all') searchParams.append('status', status);
    if (search) searchParams.append('search', search);
    if (startDate) searchParams.append('start_date', startDate);
    if (endDate) searchParams.append('end_date', endDate);

    const response = await fetch(`/api/tournaments?${searchParams.toString()}`);
    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '大会一覧の取得に失敗しました');
    }
    return response.json();
}

export function useTournaments(params: TournamentsParams = {}) {
    return useQuery({
        queryKey: ['tournaments', params],
        queryFn: () => fetchTournaments(params),
    });
}

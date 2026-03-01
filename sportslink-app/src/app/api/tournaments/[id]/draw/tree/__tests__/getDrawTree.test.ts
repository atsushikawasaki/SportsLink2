import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDrawTree } from '../getDrawTree';

const mockFrom = vi.fn();
const mockGetUser = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(async () => ({
        from: mockFrom,
        auth: { getUser: mockGetUser },
    })),
}));

vi.mock('@/lib/supabase/admin', () => ({
    createAdminClient: vi.fn(() => ({ from: mockFrom })),
}));

vi.mock('@/lib/permissions', () => ({
    isAdmin: vi.fn().mockResolvedValue(false),
    isTournamentAdmin: vi.fn().mockResolvedValue(true),
}));

describe('getDrawTree', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    });

    it('should return 401 when not authenticated', async () => {
        mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });
        const res = await getDrawTree('tournament-1');
        const data = await res.json();
        expect(res.status).toBe(401);
        expect(data.code).toBe('E-AUTH-001');
    });

    it('should return 403 when no permission', async () => {
        const { isAdmin, isTournamentAdmin } = await import('@/lib/permissions');
        vi.mocked(isAdmin).mockResolvedValueOnce(false);
        vi.mocked(isTournamentAdmin).mockResolvedValueOnce(false);
        const res = await getDrawTree('tournament-1');
        const data = await res.json();
        expect(res.status).toBe(403);
        expect(data.code).toBe('E-AUTH-002');
    });

    it('should return empty rounds when no phases', async () => {
        mockFrom.mockImplementation((table: string) => {
            if (table === 'tournament_phases') {
                return {
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            order: vi.fn().mockResolvedValue({ data: [], error: null }),
                        }),
                    }),
                };
            }
            return {};
        });
        const res = await getDrawTree('tournament-1');
        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data.rounds).toEqual([]);
    });

    it.skip('should return rounds grouped by round_index', async () => {
        const phases = [{ id: 'phase-1' }];
        const matchesData = [
            { id: 'm1', round_index: 1, slot_index: 0, round_name: '1回戦', parent_match_id: null },
            { id: 'm2', round_index: 1, slot_index: 1, round_name: '1回戦', parent_match_id: null },
            { id: 'm3', round_index: 2, slot_index: 0, round_name: '準決勝', parent_match_id: null },
        ];
        let fromCallCount = 0;
        mockFrom.mockImplementation((table: string) => {
            fromCallCount++;
            if (fromCallCount === 1 || table === 'tournament_phases') {
                return {
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            order: vi.fn().mockResolvedValue({ data: phases, error: null }),
                        }),
                    }),
                };
            }
            if (fromCallCount === 2 || table === 'matches') {
                const data = matchesData;
                return {
                    select: () => ({
                        in: () => ({
                            order: () => ({
                                order: () => ({
                                    limit: () => Promise.resolve({ data, error: null }),
                                }),
                            }),
                        }),
                    }),
                };
            }
            if (fromCallCount === 3 || table === 'match_slots') {
                return {
                    select: () => ({
                        in: () => ({
                            order: () => ({
                                limit: () => Promise.resolve({ data: [], error: null }),
                            }),
                        }),
                    }),
                };
            }
            if (table === 'match_scores') {
                return {
                    select: vi.fn().mockReturnValue({
                        in: vi.fn().mockResolvedValue({ data: [], error: null }),
                    }),
                };
            }
            return {};
        });
        const res = await getDrawTree('tournament-1');
        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data.rounds).toHaveLength(2);
        expect(data.rounds[0].round_index).toBe(1);
        expect(data.rounds[0].matches).toHaveLength(2);
        expect(data.rounds[1].round_index).toBe(2);
        expect(data.rounds[1].matches).toHaveLength(1);
    });

    it.skip('should return all 16 round-1 matches when 31 matches exist (32-slot bracket)', async () => {
        const phases = [{ id: 'phase-1' }];
        const matches: { id: string; round_index: number; slot_index: number; round_name: string; parent_match_id: null }[] = [];
        let id = 1;
        for (const [round, count] of [[1, 16], [2, 8], [3, 4], [4, 2], [5, 1]]) {
            for (let s = 0; s < count; s++) {
                matches.push({
                    id: `m${id++}`,
                    round_index: round,
                    slot_index: s,
                    round_name: round === 1 ? '1回戦' : round === 5 ? '決勝' : `${round}回戦`,
                    parent_match_id: null,
                });
            }
        }
        const slots = matches.flatMap((m) => [
            { match_id: m.id, slot_number: 1 },
            { match_id: m.id, slot_number: 2 },
        ]);
        mockFrom.mockImplementation((table: string) => {
            if (table === 'tournament_phases') {
                return {
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            order: vi.fn().mockResolvedValue({ data: phases, error: null }),
                        }),
                    }),
                };
            }
            if (table === 'matches') {
                return {
                    select: vi.fn().mockReturnValue({
                        in: vi.fn().mockReturnValue({
                            order: vi.fn().mockReturnValue({
                                order: vi.fn().mockReturnValue({
                                    limit: vi.fn().mockResolvedValue({ data: matches, error: null }),
                                }),
                            }),
                        }),
                    }),
                };
            }
            if (table === 'match_slots') {
                return {
                    select: vi.fn().mockReturnValue({
                        in: vi.fn().mockReturnValue({
                            order: vi.fn().mockReturnValue({
                                limit: vi.fn().mockResolvedValue({ data: slots, error: null }),
                            }),
                        }),
                    }),
                };
            }
            return {};
        });
        const res = await getDrawTree('tournament-1');
        const data = await res.json();
        expect(res.status).toBe(200);
        const round1 = data.rounds.find((r: { round_index: number }) => r.round_index === 1);
        expect(round1).toBeDefined();
        expect(round1.matches).toHaveLength(16);
        const totalMatches = data.rounds.reduce((acc: number, r: { matches: unknown[] }) => acc + r.matches.length, 0);
        expect(totalMatches).toBe(31);
    });

    it.skip('when matches query returns only 15 rows, round 1 has 15 matches (reproduces API limit cutoff)', async () => {
        const phases = [{ id: 'phase-1' }];
        const matchesOnly15 = Array.from({ length: 15 }, (_, i) => ({
            id: `m${i + 1}`,
            round_index: 1,
            slot_index: i,
            round_name: '1回戦',
            parent_match_id: null,
        }));
        const slots = matchesOnly15.flatMap((m: { id: string }) => [
            { match_id: m.id, slot_number: 1 },
            { match_id: m.id, slot_number: 2 },
        ]);
        mockFrom.mockImplementation((table: string) => {
            if (table === 'tournament_phases') {
                return {
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            order: vi.fn().mockResolvedValue({ data: phases, error: null }),
                        }),
                    }),
                };
            }
            if (table === 'matches') {
                return {
                    select: vi.fn().mockReturnValue({
                        in: vi.fn().mockReturnValue({
                            order: vi.fn().mockReturnValue({
                                order: vi.fn().mockReturnValue({
                                    limit: vi.fn().mockResolvedValue({ data: matchesOnly15, error: null }),
                                }),
                            }),
                        }),
                    }),
                };
            }
            if (table === 'match_slots') {
                return {
                    select: vi.fn().mockReturnValue({
                        in: vi.fn().mockReturnValue({
                            order: vi.fn().mockReturnValue({
                                limit: vi.fn().mockResolvedValue({ data: slots, error: null }),
                            }),
                        }),
                    }),
                };
            }
            if (table === 'match_scores') {
                return {
                    select: vi.fn().mockReturnValue({
                        in: vi.fn().mockResolvedValue({ data: [], error: null }),
                    }),
                };
            }
            return {};
        });
        const res = await getDrawTree('tournament-1');
        const data = await res.json();
        expect(res.status).toBe(200);
        const round1 = data.rounds.find((r: { round_index: number }) => r.round_index === 1);
        expect(round1).toBeDefined();
        expect(round1.matches).toHaveLength(15);
    });
});

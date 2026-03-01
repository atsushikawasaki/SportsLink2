import { describe, it, expect, vi, beforeEach } from 'vitest';
import { submitOrder } from '../submitOrder';

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

describe('submitOrder', () => {
    const validBody = {
        slot_number: 1 as const,
        team_id: '550e8400-e29b-41d4-a716-446655440000',
        player_1_id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        player_2_id: '6ba7b811-9dad-11d1-80b4-00c04fd430c8',
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetUser.mockResolvedValue({ data: { user: { id: 'manager-user' } }, error: null });
    });

    it('should return 401 when not authenticated', async () => {
        mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });
        const req = new Request('http://localhost', {
            method: 'POST',
            body: JSON.stringify(validBody),
        });
        const res = await submitOrder('match-1', req);
        const data = await res.json();
        expect(res.status).toBe(401);
        expect(data.code).toBe('E-AUTH-001');
    });

    it('should return 400 when body is invalid', async () => {
        const req = new Request('http://localhost', {
            method: 'POST',
            body: JSON.stringify({ slot_number: 1 }),
        });
        const res = await submitOrder('match-1', req);
        const data = await res.json();
        expect(res.status).toBe(400);
        expect(data.code).toBe('E-VER-003');
    });

    it('should return 404 when match not found', async () => {
        mockFrom.mockImplementation((table: string) => {
            if (table === 'matches') {
                return {
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
                        }),
                    }),
                };
            }
            return {};
        });
        const req = new Request('http://localhost', { method: 'POST', body: JSON.stringify(validBody) });
        const res = await submitOrder('match-1', req);
        const data = await res.json();
        expect(res.status).toBe(404);
        expect(data.code).toBe('E-NOT-FOUND');
    });

    it('should return 403 when user is not team manager for the slot', async () => {
        mockFrom.mockImplementation((table: string) => {
            if (table === 'matches') {
                return {
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            single: vi.fn().mockResolvedValue({
                                data: { id: 'match-1', order_submitted_slot_1_at: null, order_submitted_slot_2_at: null, parent_match_id: null },
                                error: null,
                            }),
                        }),
                    }),
                };
            }
            if (table === 'match_slots') {
                return {
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            order: vi.fn().mockResolvedValue({
                                data: [{ slot_number: 1, entry_id: 'entry-1' }],
                                error: null,
                            }),
                        }),
                    }),
                };
            }
            if (table === 'tournament_entries') {
                return {
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            single: vi.fn().mockResolvedValue({
                                data: { team_id: validBody.team_id },
                                error: null,
                            }),
                        }),
                    }),
                };
            }
            if (table === 'teams') {
                return {
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            single: vi.fn().mockResolvedValue({
                                data: { team_manager_user_id: 'other-user' },
                                error: null,
                            }),
                        }),
                    }),
                };
            }
            return {};
        });
        const req = new Request('http://localhost', { method: 'POST', body: JSON.stringify(validBody) });
        const res = await submitOrder('match-1', req);
        const data = await res.json();
        expect(res.status).toBe(403);
        expect(data.code).toBe('E-AUTH-002');
    });
});

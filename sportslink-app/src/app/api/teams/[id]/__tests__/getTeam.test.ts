import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTeam } from '../getTeam';

const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockOrder = vi.fn();
const mockOrder2 = vi.fn().mockResolvedValue({ data: [], error: null });

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
  })),
}));

describe('getTeam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrder2.mockResolvedValue({ data: [], error: null });
    mockOrder.mockReturnValue({ order: mockOrder2 });

    const tpEq = vi.fn().mockReturnValue({ order: mockOrder });
    const tpSelect = vi.fn().mockReturnValue({ eq: tpEq });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'teams') {
        return { select: mockSelect, eq: mockEq, single: mockSingle };
      }
      if (table === 'tournament_players') {
        return { select: tpSelect, eq: tpEq, order: mockOrder };
      }
      return {};
    });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ single: mockSingle });
  });

  it('should return 404 when team not found', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });

    const response = await getTeam('team-123');
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain('チームが見つかりません');
    expect(data.code).toBe('E-NOT-FOUND');
  });

  it('should return team with tournament_players', async () => {
    const mockTeam = {
      id: 'team-123',
      name: 'Test Team',
      team_manager_user_id: 'user-456',
      created_at: '2024-01-01T00:00:00Z',
    };
    const mockPlayers = [
      { id: 'p1', player_name: '山田', player_type: '前衛', sort_order: 1, created_at: '2024-01-01T00:00:00Z' },
    ];

    mockSingle.mockResolvedValueOnce({ data: mockTeam, error: null });
    mockOrder2.mockResolvedValueOnce({ data: mockPlayers, error: null });

    const response = await getTeam('team-123');
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe('team-123');
    expect(data.name).toBe('Test Team');
    expect(data.tournament_players).toEqual(mockPlayers);
  });

  it('should return 500 on server error', async () => {
    mockFrom.mockImplementation(() => {
      throw new Error('Server error');
    });

    const response = await getTeam('team-123');
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('チームの取得に失敗しました');
    expect(data.code).toBe('E-SERVER-001');
  });
});

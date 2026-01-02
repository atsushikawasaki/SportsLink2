import { describe, it, expect, vi, beforeEach } from 'vitest';
import { assignMatch } from '../assign/assignMatch';

// Supabaseクライアントをモック
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
  })),
}));

describe('assignMatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    const mockUpdateChain = {
      eq: mockEq,
    };
    
    mockFrom.mockReturnValue({
      update: mockUpdate,
    });
    
    mockUpdate.mockReturnValue(mockUpdateChain);
    mockEq.mockReturnValue({
      select: mockSelect,
    });
    mockSelect.mockReturnValue({
      single: mockSingle,
    });
  });

  it('should assign umpire to match', async () => {
    const mockMatch = {
      id: 'match-123',
      umpire_id: 'umpire-456',
      court_number: null,
    };

    mockSingle.mockResolvedValue({
      data: mockMatch,
      error: null,
    });

    const request = new Request('http://localhost/api/matches/match-123/assign', {
      method: 'PUT',
      body: JSON.stringify({
        umpire_id: 'umpire-456',
      }),
    });

    const response = await assignMatch('match-123', request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.umpire_id).toBe('umpire-456');
    expect(mockUpdate).toHaveBeenCalledWith({
      umpire_id: 'umpire-456',
    });
  });

  it('should assign court number to match', async () => {
    const mockMatch = {
      id: 'match-123',
      umpire_id: null,
      court_number: 1,
    };

    mockSingle.mockResolvedValue({
      data: mockMatch,
      error: null,
    });

    const request = new Request('http://localhost/api/matches/match-123/assign', {
      method: 'PUT',
      body: JSON.stringify({
        court_number: 1,
      }),
    });

    const response = await assignMatch('match-123', request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.court_number).toBe(1);
    expect(mockUpdate).toHaveBeenCalledWith({
      court_number: 1,
    });
  });

  it('should assign both umpire and court number', async () => {
    const mockMatch = {
      id: 'match-123',
      umpire_id: 'umpire-456',
      court_number: 2,
    };

    mockSingle.mockResolvedValue({
      data: mockMatch,
      error: null,
    });

    const request = new Request('http://localhost/api/matches/match-123/assign', {
      method: 'PUT',
      body: JSON.stringify({
        umpire_id: 'umpire-456',
        court_number: 2,
      }),
    });

    const response = await assignMatch('match-123', request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.umpire_id).toBe('umpire-456');
    expect(data.court_number).toBe(2);
    expect(mockUpdate).toHaveBeenCalledWith({
      umpire_id: 'umpire-456',
      court_number: 2,
    });
  });

  it('should handle empty body', async () => {
    const mockMatch = {
      id: 'match-123',
      umpire_id: null,
      court_number: null,
    };

    mockSingle.mockResolvedValue({
      data: mockMatch,
      error: null,
    });

    const request = new Request('http://localhost/api/matches/match-123/assign', {
      method: 'PUT',
      body: JSON.stringify({}),
    });

    const response = await assignMatch('match-123', request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toBeDefined();
  });

  it('should handle null values', async () => {
    const mockMatch = {
      id: 'match-123',
      umpire_id: null,
      court_number: null,
    };

    mockSingle.mockResolvedValue({
      data: mockMatch,
      error: null,
    });

    const request = new Request('http://localhost/api/matches/match-123/assign', {
      method: 'PUT',
      body: JSON.stringify({
        umpire_id: null,
        court_number: null,
      }),
    });

    const response = await assignMatch('match-123', request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.umpire_id).toBeNull();
    expect(data.court_number).toBeNull();
  });

  it('should return 500 on database error', async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: 'Database error' },
    });

    const request = new Request('http://localhost/api/matches/match-123/assign', {
      method: 'PUT',
      body: JSON.stringify({
        umpire_id: 'umpire-456',
      }),
    });

    const response = await assignMatch('match-123', request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
    expect(data.code).toBe('E-DB-001');
  });

  it('should return 500 on server error', async () => {
    mockFrom.mockImplementation(() => {
      throw new Error('Server error');
    });

    const request = new Request('http://localhost/api/matches/match-123/assign', {
      method: 'PUT',
      body: JSON.stringify({
        umpire_id: 'umpire-456',
      }),
    });

    const response = await assignMatch('match-123', request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('試合の割当に失敗しました');
    expect(data.code).toBe('E-SERVER-001');
  });
});


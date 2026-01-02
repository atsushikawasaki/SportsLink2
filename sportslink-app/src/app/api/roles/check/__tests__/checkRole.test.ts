import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkRole } from '../checkRole';
import { checkPermission } from '@/lib/permissions';

// checkPermissionをモック
vi.mock('@/lib/permissions', async () => {
  const actual = await vi.importActual('@/lib/permissions');
  return {
    ...actual,
    checkPermission: vi.fn(),
    RoleType: {
      admin: 'admin',
      tournament_admin: 'tournament_admin',
      team_admin: 'team_admin',
      umpire: 'umpire',
    },
  };
});

const mockCheckPermission = vi.mocked(checkPermission);

describe('checkRole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 when user_id is missing', async () => {
    const request = new Request('http://localhost/api/roles/check', {
      method: 'POST',
      body: JSON.stringify({
        role: 'admin',
      }),
    });

    const response = await checkRole(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('ユーザーIDとロールは必須です');
    expect(data.code).toBe('E-VER-003');
  });

  it('should return 400 when role is missing', async () => {
    const request = new Request('http://localhost/api/roles/check', {
      method: 'POST',
      body: JSON.stringify({
        user_id: 'user-123',
      }),
    });

    const response = await checkRole(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('ユーザーIDとロールは必須です');
    expect(data.code).toBe('E-VER-003');
  });

  it('should return 400 when role is invalid', async () => {
    const request = new Request('http://localhost/api/roles/check', {
      method: 'POST',
      body: JSON.stringify({
        user_id: 'user-123',
        role: 'invalid_role',
      }),
    });

    const response = await checkRole(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('有効なロールを指定してください');
    expect(data.code).toBe('E-VER-003');
  });

  it('should map scorer role to umpire', async () => {
    mockCheckPermission.mockResolvedValue(true);

    const request = new Request('http://localhost/api/roles/check', {
      method: 'POST',
      body: JSON.stringify({
        user_id: 'user-123',
        role: 'scorer',
      }),
    });

    await checkRole(request);

    expect(mockCheckPermission).toHaveBeenCalledWith('user-123', 'umpire', undefined);
  });

  it('should check permission with tournament scope', async () => {
    mockCheckPermission.mockResolvedValue(true);

    const request = new Request('http://localhost/api/roles/check', {
      method: 'POST',
      body: JSON.stringify({
        user_id: 'user-123',
        role: 'tournament_admin',
        tournament_id: 'tournament-456',
      }),
    });

    const response = await checkRole(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.has_permission).toBe(true);
    expect(mockCheckPermission).toHaveBeenCalledWith('user-123', 'tournament_admin', {
      tournament_id: 'tournament-456',
    });
  });

  it('should check permission with team scope', async () => {
    mockCheckPermission.mockResolvedValue(true);

    const request = new Request('http://localhost/api/roles/check', {
      method: 'POST',
      body: JSON.stringify({
        user_id: 'user-123',
        role: 'team_admin',
        team_id: 'team-789',
      }),
    });

    const response = await checkRole(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.has_permission).toBe(true);
    expect(mockCheckPermission).toHaveBeenCalledWith('user-123', 'team_admin', {
      team_id: 'team-789',
    });
  });

  it('should check permission with match scope', async () => {
    mockCheckPermission.mockResolvedValue(true);

    const request = new Request('http://localhost/api/roles/check', {
      method: 'POST',
      body: JSON.stringify({
        user_id: 'user-123',
        role: 'umpire',
        match_id: 'match-101',
      }),
    });

    const response = await checkRole(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.has_permission).toBe(true);
    expect(mockCheckPermission).toHaveBeenCalledWith('user-123', 'umpire', {
      match_id: 'match-101',
    });
  });

  it('should check permission with combined scope', async () => {
    mockCheckPermission.mockResolvedValue(true);

    const request = new Request('http://localhost/api/roles/check', {
      method: 'POST',
      body: JSON.stringify({
        user_id: 'user-123',
        role: 'tournament_admin',
        tournament_id: 'tournament-456',
        team_id: 'team-789',
        match_id: 'match-101',
      }),
    });

    const response = await checkRole(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.has_permission).toBe(true);
    expect(mockCheckPermission).toHaveBeenCalledWith('user-123', 'tournament_admin', {
      tournament_id: 'tournament-456',
      team_id: 'team-789',
      match_id: 'match-101',
    });
  });

  it('should handle null scope values', async () => {
    mockCheckPermission.mockResolvedValue(false);

    const request = new Request('http://localhost/api/roles/check', {
      method: 'POST',
      body: JSON.stringify({
        user_id: 'user-123',
        role: 'admin',
        tournament_id: null,
        team_id: null,
      }),
    });

    const response = await checkRole(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.has_permission).toBe(false);
    expect(mockCheckPermission).toHaveBeenCalledWith('user-123', 'admin', {
      tournament_id: null,
      team_id: null,
    });
  });

  it('should return false when permission is denied', async () => {
    mockCheckPermission.mockResolvedValue(false);

    const request = new Request('http://localhost/api/roles/check', {
      method: 'POST',
      body: JSON.stringify({
        user_id: 'user-123',
        role: 'tournament_admin',
        tournament_id: 'tournament-456',
      }),
    });

    const response = await checkRole(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.has_permission).toBe(false);
  });

  it('should return 500 on server error', async () => {
    mockCheckPermission.mockRejectedValue(new Error('Database error'));

    const request = new Request('http://localhost/api/roles/check', {
      method: 'POST',
      body: JSON.stringify({
        user_id: 'user-123',
        role: 'admin',
      }),
    });

    const response = await checkRole(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('権限チェックに失敗しました');
    expect(data.code).toBe('E-SERVER-001');
  });

  it('should handle all valid role types', async () => {
    mockCheckPermission.mockResolvedValue(true);

    const roles = ['admin', 'tournament_admin', 'team_admin', 'umpire', 'scorer'];

    for (const role of roles) {
      const request = new Request('http://localhost/api/roles/check', {
        method: 'POST',
        body: JSON.stringify({
          user_id: 'user-123',
          role,
        }),
      });

      const response = await checkRole(request);
      expect(response.status).toBe(200);
    }
  });
});


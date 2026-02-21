import { describe, it, expect, vi, beforeEach } from 'vitest';
import { removeRole } from '../removeRole';

// Supabaseクライアントをモック
const mockDelete = vi.fn();
const mockEq = vi.fn();
const mockIs = vi.fn();
const mockFrom = vi.fn();
const mockGetUser = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

vi.mock('@/lib/permissions', () => ({
  isAdmin: vi.fn().mockResolvedValue(true),
}));

// チェーン可能なモックオブジェクトを作成するヘルパー関数
const createChain = (result: { data: null; error: null | { message: string } } = { data: null, error: null }) => {
  const chain: {
    eq: ReturnType<typeof vi.fn>;
    is: ReturnType<typeof vi.fn>;
    then?: (resolve: (value: { data: null; error: null | { message: string } }) => void) => Promise<{ data: null; error: null | { message: string } }>;
    catch?: ReturnType<typeof vi.fn>;
  } = {
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
  };
  // thenメソッドを追加してPromiseとして扱えるようにする
  chain.then = vi.fn((resolve) => {
    resolve(result);
    return Promise.resolve(result);
  }) as unknown as (resolve: (value: { data: null; error: null | { message: string } }) => void) => Promise<{ data: null; error: null | { message: string } }>;
  chain.catch = vi.fn();
  return chain;
};

describe('removeRole', () => {
  let defaultChain: ReturnType<typeof createChain>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'admin-user-id' } },
      error: null,
    });
    defaultChain = createChain({ data: null, error: null });
    mockFrom.mockImplementation(() => ({
      delete: mockDelete,
    }));
    mockDelete.mockReturnValue(defaultChain);
    mockEq.mockReturnThis();
    mockIs.mockReturnThis();
  });

  it('should return 400 when user_id is missing', async () => {
    const request = new Request('http://localhost/api/roles/remove?role=tournament_admin');

    const response = await removeRole(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('ユーザーIDとロールは必須です');
    expect(data.code).toBe('E-VER-003');
  });

  it('should return 400 when role is missing', async () => {
    const request = new Request('http://localhost/api/roles/remove?user_id=user-123');

    const response = await removeRole(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('ユーザーIDとロールは必須です');
  });

  it('should return 400 when role is invalid', async () => {
    const request = new Request('http://localhost/api/roles/remove?user_id=user-123&role=invalid_role');

    const response = await removeRole(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('有効なロールを指定してください');
  });

  it('should remove global role successfully', async () => {
    const successChain = createChain({ data: null, error: null });
    mockDelete.mockReturnValue(successChain);
    mockEq.mockImplementation(function(this: unknown) {
      return this || successChain;
    });
    mockIs.mockImplementation(function(this: unknown) {
      return this || successChain;
    });

    const request = new Request('http://localhost/api/roles/remove?user_id=user-123&role=admin');

    const response = await removeRole(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toContain('権限を削除しました');
  });

  it('should remove tournament-specific role', async () => {
    const successChain = createChain({ data: null, error: null });
    mockDelete.mockReturnValue(successChain);
    mockEq.mockImplementation(function(this: unknown) {
      return this || successChain;
    });

    const request = new Request('http://localhost/api/roles/remove?user_id=user-123&role=tournament_admin&tournament_id=tournament-456');

    const response = await removeRole(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toContain('権限を削除しました');
  });

  it('should remove team-specific role', async () => {
    const successChain = createChain({ data: null, error: null });
    mockDelete.mockReturnValue(successChain);
    mockEq.mockImplementation(function(this: unknown) {
      return this || successChain;
    });

    const request = new Request('http://localhost/api/roles/remove?user_id=user-123&role=team_admin&team_id=team-789');

    const response = await removeRole(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toContain('権限を削除しました');
  });

  it('should remove match-specific role', async () => {
    const successChain = createChain({ data: null, error: null });
    mockDelete.mockReturnValue(successChain);
    mockEq.mockImplementation(function(this: unknown) {
      return this || successChain;
    });

    const request = new Request('http://localhost/api/roles/remove?user_id=user-123&role=umpire&match_id=match-101');

    const response = await removeRole(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toContain('権限を削除しました');
  });

  it('should map old role names correctly', async () => {
    const successChain = createChain({ data: null, error: null });
    mockDelete.mockReturnValue(successChain);
    mockEq.mockImplementation(function(this: unknown) {
      return this || successChain;
    });
    mockIs.mockImplementation(function(this: unknown) {
      return this || successChain;
    });

    const request = new Request('http://localhost/api/roles/remove?user_id=user-123&role=scorer');

    const response = await removeRole(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toContain('権限を削除しました');
  });

  it('should return 500 on database error', async () => {
    const errorChain = createChain({ data: null, error: { message: 'Database error' } });
    mockDelete.mockReturnValue(errorChain);
    mockEq.mockImplementation(function(this: unknown) {
      return this || errorChain;
    });
    mockIs.mockImplementation(function(this: unknown) {
      return this || errorChain;
    });

    const request = new Request('http://localhost/api/roles/remove?user_id=user-123&role=admin');

    const response = await removeRole(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
    expect(data.code).toBe('E-DB-001');
  });

  it('should return 500 on server error', async () => {
    mockFrom.mockImplementation(() => {
      throw new Error('Server error');
    });

    const request = new Request('http://localhost/api/roles/remove?user_id=user-123&role=admin');

    const response = await removeRole(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('権限の削除に失敗しました');
    expect(data.code).toBe('E-SERVER-001');
  });
});


import { describe, it, expect } from 'vitest';
import { getPermissions } from '../getPermissions';

describe('getPermissions', () => {
  it('should return list of permissions', async () => {
    const response = await getPermissions();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toBeDefined();
    expect(Array.isArray(data.data)).toBe(true);
  });

  it('should include tournament_admin role', async () => {
    const response = await getPermissions();
    const data = await response.json();

    const tournamentAdmin = data.data.find((p: any) => p.role === 'tournament_admin');
    expect(tournamentAdmin).toBeDefined();
    expect(tournamentAdmin.name).toBe('大会運営者');
  });

  it('should include scorer role', async () => {
    const response = await getPermissions();
    const data = await response.json();

    const scorer = data.data.find((p: any) => p.role === 'scorer');
    expect(scorer).toBeDefined();
    expect(scorer.name).toBe('審判');
  });

  it('should include team_manager role', async () => {
    const response = await getPermissions();
    const data = await response.json();

    const teamManager = data.data.find((p: any) => p.role === 'team_manager');
    expect(teamManager).toBeDefined();
    expect(teamManager.name).toBe('チーム管理者');
  });

  it('should include master role', async () => {
    const response = await getPermissions();
    const data = await response.json();

    const master = data.data.find((p: any) => p.role === 'master');
    expect(master).toBeDefined();
    expect(master.name).toBe('マスタ');
  });

  it('should include master_manager role', async () => {
    const response = await getPermissions();
    const data = await response.json();

    const masterManager = data.data.find((p: any) => p.role === 'master_manager');
    expect(masterManager).toBeDefined();
    expect(masterManager.name).toBe('マスタ管理者');
  });

  it('should have description for each role', async () => {
    const response = await getPermissions();
    const data = await response.json();

    data.data.forEach((permission: any) => {
      expect(permission.description).toBeDefined();
      expect(typeof permission.description).toBe('string');
    });
  });
});


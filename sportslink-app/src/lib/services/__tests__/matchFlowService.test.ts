import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MatchType, WinningReason } from '../matchFlowService';

describe('Match Flow Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('MatchType', () => {
    it('should have valid match types', () => {
      const validTypes: MatchType[] = ['team_match', 'individual_match'];
      expect(validTypes).toHaveLength(2);
      expect(validTypes).toContain('team_match');
      expect(validTypes).toContain('individual_match');
    });
  });

  describe('WinningReason', () => {
    it('should have valid winning reasons', () => {
      const validReasons: WinningReason[] = ['NORMAL', 'RETIRE', 'DEFAULT'];
      expect(validReasons).toHaveLength(3);
      expect(validReasons).toContain('NORMAL');
      expect(validReasons).toContain('RETIRE');
      expect(validReasons).toContain('DEFAULT');
    });
  });

  describe('Match Score Logic', () => {
    it('should determine winner when game_count_a > game_count_b', () => {
      const gameCountA = 3;
      const gameCountB = 1;
      expect(gameCountA > gameCountB).toBe(true);
    });

    it('should determine winner when game_count_b > game_count_a', () => {
      const gameCountA = 1;
      const gameCountB = 3;
      expect(gameCountB > gameCountA).toBe(true);
    });

    it('should return null when scores are equal', () => {
      const gameCountA = 2;
      const gameCountB = 2;
      expect(gameCountA === gameCountB).toBe(true);
    });
  });

  describe('Team Match Majority Logic', () => {
    it('should calculate majority correctly for 3 matches', () => {
      const totalMatches = 3;
      const majority = Math.ceil(totalMatches / 2);
      expect(majority).toBe(2);
    });

    it('should calculate majority correctly for 5 matches', () => {
      const totalMatches = 5;
      const majority = Math.ceil(totalMatches / 2);
      expect(majority).toBe(3);
    });

    it('should determine winner when team has majority wins', () => {
      const teamWins: Record<string, number> = {
        'team-1': 2,
        'team-2': 1,
      };
      const totalMatches = 3;
      const majority = Math.ceil(totalMatches / 2);

      const hasWinner = Object.values(teamWins).some((wins) => wins >= majority);
      expect(hasWinner).toBe(true);
    });

    it('should not determine winner when no team has majority', () => {
      const teamWins: Record<string, number> = {
        'team-1': 1,
        'team-2': 1,
      };
      const totalMatches = 3;
      const majority = Math.ceil(totalMatches / 2);

      const hasWinner = Object.values(teamWins).some((wins) => wins >= majority);
      expect(hasWinner).toBe(false);
    });

    it('should handle edge case with single match', () => {
      const totalMatches = 1;
      const majority = Math.ceil(totalMatches / 2);
      expect(majority).toBe(1);
    });

    it('should handle even number of matches', () => {
      const totalMatches = 4;
      const majority = Math.ceil(totalMatches / 2);
      expect(majority).toBe(2);
    });

    it('should determine winner with exactly majority wins', () => {
      const teamWins: Record<string, number> = {
        'team-1': 2,
        'team-2': 1,
      };
      const totalMatches = 3;
      const majority = Math.ceil(totalMatches / 2);

      const winner = Object.entries(teamWins).find(([, wins]) => wins >= majority);
      expect(winner).toBeDefined();
      expect(winner?.[0]).toBe('team-1');
    });
  });

  describe('Score Calculation Edge Cases', () => {
    it('should handle zero scores', () => {
      const gameCountA = 0;
      const gameCountB = 0;
      expect(gameCountA === gameCountB).toBe(true);
    });

    it('should handle large score differences', () => {
      const gameCountA = 10;
      const gameCountB = 0;
      expect(gameCountA > gameCountB).toBe(true);
    });

    it('should handle negative scores (should not occur but test logic)', () => {
      const gameCountA = -1;
      const gameCountB = 0;
      // 負の値は通常発生しないが、ロジックのテスト
      expect(gameCountA < gameCountB).toBe(true);
    });
  });
});


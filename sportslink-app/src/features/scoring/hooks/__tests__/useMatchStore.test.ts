import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMatchStore } from '../useMatchStore';

describe('useMatchStore', () => {
  beforeEach(() => {
    // ストアをリセット
    useMatchStore.setState({
      matchId: null,
      umpireId: null,
      matchStatus: 'pending',
      serverVersion: 1,
      localQueue: [],
      gameCountA: 0,
      gameCountB: 0,
      currentScoreA: '0',
      currentScoreB: '0',
      isSyncing: false,
      hasConflict: false,
      connectionState: 'DISCONNECTED',
    });
  });

  it('should have initial state', () => {
    const { result } = renderHook(() => useMatchStore());

    expect(result.current.matchId).toBeNull();
    expect(result.current.umpireId).toBeNull();
    expect(result.current.matchStatus).toBe('pending');
    expect(result.current.serverVersion).toBe(1);
    expect(result.current.localQueue).toEqual([]);
    expect(result.current.gameCountA).toBe(0);
    expect(result.current.gameCountB).toBe(0);
    expect(result.current.currentScoreA).toBe('0');
    expect(result.current.currentScoreB).toBe('0');
    expect(result.current.isSyncing).toBe(false);
    expect(result.current.hasConflict).toBe(false);
    expect(result.current.connectionState).toBe('DISCONNECTED');
  });

  it('should set match state', () => {
    const { result } = renderHook(() => useMatchStore());

    act(() => {
      result.current.setMatchState({
        matchId: 'match-123',
        umpireId: 'umpire-456',
        matchStatus: 'inprogress',
      });
    });

    expect(result.current.matchId).toBe('match-123');
    expect(result.current.umpireId).toBe('umpire-456');
    expect(result.current.matchStatus).toBe('inprogress');
  });

  it('should update score', () => {
    const { result } = renderHook(() => useMatchStore());

    act(() => {
      result.current.updateScore(2, 1, '40', '30');
    });

    expect(result.current.gameCountA).toBe(2);
    expect(result.current.gameCountB).toBe(1);
    expect(result.current.currentScoreA).toBe('40');
    expect(result.current.currentScoreB).toBe('30');
  });

  it('should add point to queue', () => {
    const { result } = renderHook(() => useMatchStore());

    const point = {
      id: 'point-1',
      matchId: 'match-123',
      pointType: 'A_score' as const,
      clientUuid: 'client-uuid-1',
      createdAt: new Date().toISOString(),
    };

    act(() => {
      result.current.addPointToQueue(point);
    });

    expect(result.current.localQueue).toHaveLength(1);
    expect(result.current.localQueue[0]).toEqual(point);
  });

  it('should add multiple points to queue', () => {
    const { result } = renderHook(() => useMatchStore());

    const point1 = {
      id: 'point-1',
      matchId: 'match-123',
      pointType: 'A_score' as const,
      clientUuid: 'client-uuid-1',
      createdAt: new Date().toISOString(),
    };

    const point2 = {
      id: 'point-2',
      matchId: 'match-123',
      pointType: 'B_score' as const,
      clientUuid: 'client-uuid-2',
      createdAt: new Date().toISOString(),
    };

    act(() => {
      result.current.addPointToQueue(point1);
      result.current.addPointToQueue(point2);
    });

    expect(result.current.localQueue).toHaveLength(2);
    expect(result.current.localQueue[0]).toEqual(point1);
    expect(result.current.localQueue[1]).toEqual(point2);
  });

  it('should remove point from queue', () => {
    const { result } = renderHook(() => useMatchStore());

    const point1 = {
      id: 'point-1',
      matchId: 'match-123',
      pointType: 'A_score' as const,
      clientUuid: 'client-uuid-1',
      createdAt: new Date().toISOString(),
    };

    const point2 = {
      id: 'point-2',
      matchId: 'match-123',
      pointType: 'B_score' as const,
      clientUuid: 'client-uuid-2',
      createdAt: new Date().toISOString(),
    };

    act(() => {
      result.current.addPointToQueue(point1);
      result.current.addPointToQueue(point2);
      result.current.removePointFromQueue('point-1');
    });

    expect(result.current.localQueue).toHaveLength(1);
    expect(result.current.localQueue[0]).toEqual(point2);
  });

  it('should clear queue', () => {
    const { result } = renderHook(() => useMatchStore());

    const point = {
      id: 'point-1',
      matchId: 'match-123',
      pointType: 'A_score' as const,
      clientUuid: 'client-uuid-1',
      createdAt: new Date().toISOString(),
    };

    act(() => {
      result.current.addPointToQueue(point);
      result.current.clearQueue();
    });

    expect(result.current.localQueue).toHaveLength(0);
  });

  it('should set connection state', () => {
    const { result } = renderHook(() => useMatchStore());

    act(() => {
      result.current.setConnectionState('CONNECTED');
    });

    expect(result.current.connectionState).toBe('CONNECTED');

    act(() => {
      result.current.setConnectionState('RECONNECTING');
    });

    expect(result.current.connectionState).toBe('RECONNECTING');
  });

  it('should set syncing state', () => {
    const { result } = renderHook(() => useMatchStore());

    act(() => {
      result.current.setSyncing(true);
    });

    expect(result.current.isSyncing).toBe(true);

    act(() => {
      result.current.setSyncing(false);
    });

    expect(result.current.isSyncing).toBe(false);
  });

  it('should set conflict state', () => {
    const { result } = renderHook(() => useMatchStore());

    act(() => {
      result.current.setConflict(true);
    });

    expect(result.current.hasConflict).toBe(true);

    act(() => {
      result.current.setConflict(false);
    });

    expect(result.current.hasConflict).toBe(false);
  });

  it('should reset match to initial state', () => {
    const { result } = renderHook(() => useMatchStore());

    act(() => {
      result.current.setMatchState({
        matchId: 'match-123',
        umpireId: 'umpire-456',
        matchStatus: 'inprogress',
        serverVersion: 5,
      });
      result.current.updateScore(3, 2, '40', '30');
      result.current.addPointToQueue({
        id: 'point-1',
        matchId: 'match-123',
        pointType: 'A_score',
        clientUuid: 'client-uuid-1',
        createdAt: new Date().toISOString(),
      });
      result.current.resetMatch();
    });

    expect(result.current.matchId).toBeNull();
    expect(result.current.umpireId).toBeNull();
    expect(result.current.matchStatus).toBe('pending');
    expect(result.current.serverVersion).toBe(1);
    expect(result.current.localQueue).toEqual([]);
    expect(result.current.gameCountA).toBe(0);
    expect(result.current.gameCountB).toBe(0);
  });
});


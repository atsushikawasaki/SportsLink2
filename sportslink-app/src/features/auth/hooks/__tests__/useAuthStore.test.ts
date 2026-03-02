import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAuthStore } from '../useAuthStore';
import type { Tables } from '@/types/database.types';

type User = Tables<'users'>;

describe('useAuthStore', () => {
  beforeEach(() => {
    // ストアをリセット
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      accessToken: null,
    });
  });

  it('should have initial state', () => {
    const { result } = renderHook(() => useAuthStore());

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.accessToken).toBeNull();
  });

  it('should set user and update isAuthenticated', () => {
    const { result } = renderHook(() => useAuthStore());

    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      display_name: 'Test User',
      created_at: new Date().toISOString(),
    } as unknown as User;

    act(() => {
      result.current.setUser(mockUser);
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('should set user to null and update isAuthenticated to false', () => {
    const { result } = renderHook(() => useAuthStore());

    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
    } as unknown as User;

    act(() => {
      result.current.setUser(mockUser);
      result.current.setUser(null);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('should set access token', () => {
    const { result } = renderHook(() => useAuthStore());

    const token = 'test-access-token-123';

    act(() => {
      result.current.setAccessToken(token);
    });

    expect(result.current.accessToken).toBe(token);
  });

  it('should set access token to null', () => {
    const { result } = renderHook(() => useAuthStore());

    act(() => {
      result.current.setAccessToken('token-123');
      result.current.setAccessToken(null);
    });

    expect(result.current.accessToken).toBeNull();
  });

  it('should set loading state', () => {
    const { result } = renderHook(() => useAuthStore());

    act(() => {
      result.current.setLoading(false);
    });

    expect(result.current.isLoading).toBe(false);

    act(() => {
      result.current.setLoading(true);
    });

    expect(result.current.isLoading).toBe(true);
  });

  it('should logout and reset state', async () => {
    const { result } = renderHook(() => useAuthStore());

    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
    } as unknown as User;

    act(() => {
      result.current.setUser(mockUser);
      result.current.setAccessToken('token-123');
    });

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.accessToken).toBeNull();
  });

  it('should handle multiple state updates', () => {
    const { result } = renderHook(() => useAuthStore());

    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
    } as unknown as User;

    act(() => {
      result.current.setUser(mockUser);
      result.current.setAccessToken('token-123');
      result.current.setLoading(false);
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.accessToken).toBe('token-123');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isAuthenticated).toBe(true);
  });
});


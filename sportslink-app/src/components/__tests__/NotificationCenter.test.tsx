import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NotificationCenter from '../NotificationCenter';

// モック
const mockMarkAsRead = vi.fn();
const mockMarkAllAsRead = vi.fn();
const mockDeleteNotification = vi.fn();
const mockDeleteAllNotifications = vi.fn();
const mockGetUnreadCount = vi.fn(() => 0);
const mockPush = vi.fn();

vi.mock('@/features/notifications/hooks/useNotificationStore', () => ({
  useNotificationStore: () => ({
    notifications: [],
    markAsRead: mockMarkAsRead,
    markAllAsRead: mockMarkAllAsRead,
    deleteNotification: mockDeleteNotification,
    deleteAllNotifications: mockDeleteAllNotifications,
    getUnreadCount: mockGetUnreadCount,
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// lucide-reactアイコンをモック
vi.mock('lucide-react', () => ({
  Bell: () => <span data-testid="bell-icon">🔔</span>,
  X: () => <span data-testid="x-icon">✕</span>,
  Check: () => <span data-testid="check-icon">✓</span>,
  Trash2: () => <span data-testid="trash-icon">🗑</span>,
}));

describe('NotificationCenter Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUnreadCount.mockReturnValue(0);
  });

  it('should render notification button', () => {
    render(<NotificationCenter />);
    expect(screen.getByTestId('bell-icon')).toBeDefined();
  });

  it('should show unread count badge when there are unread notifications', () => {
    mockGetUnreadCount.mockReturnValue(5);
    render(<NotificationCenter />);

    expect(screen.getByText('5')).toBeDefined();
  });

  it('should show 9+ when unread count exceeds 9', () => {
    mockGetUnreadCount.mockReturnValue(15);
    render(<NotificationCenter />);

    expect(screen.getByText('9+')).toBeDefined();
  });

  it('should toggle dropdown when button is clicked', async () => {
    render(<NotificationCenter />);

    const button = screen.getByLabelText('通知');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('通知')).toBeDefined();
    });
  });

  it('should display empty state when no notifications', async () => {
    render(<NotificationCenter />);

    const button = screen.getByLabelText('通知');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('通知はありません')).toBeDefined();
    });
  });

  it('should close dropdown when clicking outside', async () => {
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <NotificationCenter />
      </div>
    );

    const button = screen.getByLabelText('通知');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('通知')).toBeDefined();
    });

    const outside = screen.getByTestId('outside');
    fireEvent.mouseDown(outside);

    await waitFor(() => {
      expect(screen.queryByText('通知')).not.toBeInTheDocument();
    });
  });
});


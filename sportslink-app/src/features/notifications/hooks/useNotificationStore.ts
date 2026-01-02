import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type NotificationType = 'auth_key' | 'umpire_assignment' | 'match_waiting' | 'system';

export interface Notification {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    data?: {
        day_token?: string;
        match_id?: string;
        tournament_id?: string;
        [key: string]: any;
    };
    read: boolean;
    createdAt: string;
}

interface NotificationState {
    notifications: Notification[];
    addNotification: (notification: Omit<Notification, 'id' | 'read' | 'createdAt'>) => void;
    markAsRead: (id: string) => void;
    markAllAsRead: () => void;
    deleteNotification: (id: string) => void;
    deleteAllNotifications: () => void;
    getUnreadCount: () => number;
    getAuthKey: (tournamentId?: string) => string | null;
}

export const useNotificationStore = create<NotificationState>()(
    persist(
        (set, get) => ({
            notifications: [],
            addNotification: (notification) => {
                const newNotification: Notification = {
                    ...notification,
                    id: crypto.randomUUID(),
                    read: false,
                    createdAt: new Date().toISOString(),
                };
                set((state) => ({
                    notifications: [newNotification, ...state.notifications],
                }));
            },
            markAsRead: (id) => {
                set((state) => ({
                    notifications: state.notifications.map((n) =>
                        n.id === id ? { ...n, read: true } : n
                    ),
                }));
            },
            markAllAsRead: () => {
                set((state) => ({
                    notifications: state.notifications.map((n) => ({ ...n, read: true })),
                }));
            },
            deleteNotification: (id) => {
                set((state) => ({
                    notifications: state.notifications.filter((n) => n.id !== id),
                }));
            },
            deleteAllNotifications: () => {
                set({ notifications: [] });
            },
            getUnreadCount: () => {
                return get().notifications.filter((n) => !n.read).length;
            },
            getAuthKey: (tournamentId) => {
                const notification = get().notifications.find(
                    (n) => n.type === 'auth_key' && (!tournamentId || n.data?.tournament_id === tournamentId)
                );
                return notification?.data?.day_token || null;
            },
        }),
        {
            name: 'notification-storage',
        }
    )
);


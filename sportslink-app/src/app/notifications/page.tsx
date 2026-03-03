'use client';

import { useState } from 'react';
import { confirmAsync } from '@/lib/toast';
import AppShell from '@/components/AppShell';
import { useNotificationStore, type Notification } from '@/features/notifications/hooks/useNotificationStore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, Trash2, Bell, Search } from 'lucide-react';
import AuthKeyDisplay from '@/components/AuthKeyDisplay';

export default function NotificationsPage() {
    const router = useRouter();
    const { notifications, markAsRead, markAllAsRead, deleteNotification, deleteAllNotifications, getUnreadCount } =
        useNotificationStore();
    const [filter, setFilter] = useState<'all' | 'unread'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const unreadCount = getUnreadCount();

    const filteredNotifications = notifications
        .filter((n) => filter === 'unread' ? !n.read : true)
        .filter((n) => !searchQuery.trim() ||
            n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            n.message.toLowerCase().includes(searchQuery.toLowerCase())
        );

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const handleNotificationClick = (notification: Notification) => {
        markAsRead(notification.id);

        if (notification.type === 'umpire_assignment' && notification.data?.match_id) {
            router.push(`/scoring/${notification.data.match_id}`);
        } else if (notification.type === 'match_waiting' && notification.data?.match_id) {
            router.push(`/matches/${notification.data.match_id}`);
        }
    };

    return (
        <AppShell>
            <div className="py-12">
            <div className="max-w-4xl mx-auto px-4">
                <div className="bg-[var(--color-bg-surface)] rounded-2xl shadow-2xl border border-[var(--color-border-base)] p-8">
                    {/* Header */}
                    <div className="mb-8">
                        <div className="flex items-center justify-end mb-4">
                            <div className="flex items-center gap-2">
                                {unreadCount > 0 && (
                                    <button
                                        onClick={() => markAllAsRead()}
                                        className="flex items-center gap-2 px-4 py-3 min-h-[48px] bg-[var(--color-bg-surface-2)] text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-bg-surface-2)] transition-colors focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-[var(--color-bg-surface)]"
                                        aria-label="すべて既読にする"
                                    >
                                        <Check className="w-4 h-4" />
                                        すべて既読
                                    </button>
                                )}
                                {notifications.length > 0 && (
                                    <button
                                        onClick={async () => {
                                            const ok = await confirmAsync({
                                                title: '確認',
                                                message: 'すべての通知を削除しますか？',
                                                confirmLabel: '削除',
                                            });
                                            if (ok) deleteAllNotifications();
                                        }}
                                        className="flex items-center gap-2 px-4 py-3 min-h-[48px] bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-[var(--color-bg-surface)]"
                                        aria-label="すべての通知を削除"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        すべて削除
                                    </button>
                                )}
                            </div>
                        </div>
                        <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">
                            通知
                        </h1>
                        <p className="text-[var(--color-text-muted)]">
                            {unreadCount > 0 ? `未読: ${unreadCount}件` : 'すべて既読'}
                        </p>
                    </div>

                    {/* Search */}
                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                        <input
                            type="text"
                            placeholder="通知を検索..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-[var(--color-bg-surface-2)] border border-[var(--color-border-base)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-brand"
                        />
                    </div>

                    {/* Filter */}
                    <div className="mb-6 flex gap-2">
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                filter === 'all'
                                    ? 'bg-brand text-white'
                                    : 'bg-[var(--color-bg-surface-2)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-2)]'
                            }`}
                        >
                            すべて ({notifications.length})
                        </button>
                        <button
                            onClick={() => setFilter('unread')}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                filter === 'unread'
                                    ? 'bg-brand text-white'
                                    : 'bg-[var(--color-bg-surface-2)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-2)]'
                            }`}
                        >
                            未読 ({unreadCount})
                        </button>
                    </div>

                    {/* Notifications List */}
                    {filteredNotifications.length === 0 ? (
                        <div className="text-center py-12">
                            <Bell className="w-16 h-16 text-[var(--color-text-muted)] mx-auto mb-4" />
                            <p className="text-[var(--color-text-muted)] text-lg mb-2">
                                {filter === 'unread' ? '未読の通知はありません' : '通知はありません'}
                            </p>
                            {filter === 'all' && (
                                <p className="text-[var(--color-text-muted)] text-sm mb-6">
                                    担当試合の割当や認証キーなど、新しい通知がここに表示されます
                                </p>
                            )}
                            {filter === 'all' && (
                                <Link
                                    href="/dashboard"
                                    className="inline-block px-6 py-3 bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors"
                                >
                                    ダッシュボードへ
                                </Link>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredNotifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    className={`p-6 bg-[var(--color-bg-surface-2)]/50 rounded-lg border border-[var(--color-border-base)] hover:border-[var(--color-border-strong)] transition-all cursor-pointer ${
                                        !notification.read ? 'bg-[var(--color-bg-surface-2)]' : ''
                                    }`}
                                    onClick={() => handleNotificationClick(notification)}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-2">
                                                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                                                    {notification.title}
                                                </h3>
                                                {!notification.read && (
                                                    <span className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full"></span>
                                                )}
                                            </div>
                                            <p className="text-[var(--color-text-secondary)] mb-3">{notification.message}</p>
                                            {notification.type === 'auth_key' && notification.data?.day_token && (
                                                <div className="mt-3 p-3 bg-blue-500/20 rounded border border-blue-500/30">
                                                    <p className="text-sm text-[var(--color-text-secondary)] mb-2">認証キー</p>
                                                    <AuthKeyDisplay token={notification.data.day_token} size="lg" />
                                                </div>
                                            )}
                                            <p className="text-sm text-[var(--color-text-muted)] mt-3">
                                                {formatDate(notification.createdAt)}
                                            </p>
                                            {(notification.type === 'umpire_assignment' || notification.type === 'match_waiting') && notification.data?.match_id && (
                                                <Link
                                                    href={notification.type === 'umpire_assignment' ? `/scoring/${notification.data.match_id}` : `/matches/${notification.data.match_id}`}
                                                    onClick={(e) => { e.stopPropagation(); markAsRead(notification.id); }}
                                                    className="text-sm text-brand hover:text-brand-hover mt-1 inline-block"
                                                >
                                                    詳細を見る →
                                                </Link>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            {!notification.read && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        markAsRead(notification.id);
                                                    }}
                                                    className="p-3 min-w-[48px] min-h-[48px] flex items-center justify-center text-[var(--color-text-muted)] hover:text-blue-400 transition-colors focus:outline-none focus:ring-2 focus:ring-brand focus:ring-inset"
                                                    title="既読にする"
                                                    aria-label="既読にする"
                                                >
                                                    <Check className="w-5 h-5" />
                                                </button>
                                            )}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteNotification(notification.id);
                                                }}
                                                className="p-3 min-w-[48px] min-h-[48px] flex items-center justify-center text-[var(--color-text-muted)] hover:text-red-400 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-inset"
                                                title="削除"
                                                aria-label="通知を削除"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            </div>
        </AppShell>
    );
}

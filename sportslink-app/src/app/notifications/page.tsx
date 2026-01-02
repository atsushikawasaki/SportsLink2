'use client';

import { useState } from 'react';
import { useNotificationStore, type Notification } from '@/features/notifications/hooks/useNotificationStore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Check, Trash2, Bell } from 'lucide-react';

export default function NotificationsPage() {
    const router = useRouter();
    const { notifications, markAsRead, markAllAsRead, deleteNotification, deleteAllNotifications, getUnreadCount } =
        useNotificationStore();
    const [filter, setFilter] = useState<'all' | 'unread'>('all');
    const unreadCount = getUnreadCount();

    const filteredNotifications =
        filter === 'unread' ? notifications.filter((n) => !n.read) : notifications;

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

        // Navigate based on notification type
        if (notification.type === 'umpire_assignment' && notification.data?.match_id) {
            router.push(`/scoring/${notification.data.match_id}`);
        } else if (notification.type === 'match_waiting' && notification.data?.match_id) {
            router.push(`/matches/${notification.data.match_id}`);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-12">
            <div className="max-w-4xl mx-auto px-4">
                <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 p-8">
                    {/* Header */}
                    <div className="mb-8">
                        <div className="flex items-center justify-between mb-4">
                            <Link
                                href="/dashboard"
                                className="flex items-center text-slate-400 hover:text-blue-400 transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5 mr-2" />
                                ダッシュボードに戻る
                            </Link>
                            <div className="flex items-center gap-2">
                                {unreadCount > 0 && (
                                    <button
                                        onClick={() => markAllAsRead()}
                                        className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
                                    >
                                        <Check className="w-4 h-4" />
                                        すべて既読
                                    </button>
                                )}
                                {notifications.length > 0 && (
                                    <button
                                        onClick={() => {
                                            if (confirm('すべての通知を削除しますか？')) {
                                                deleteAllNotifications();
                                            }
                                        }}
                                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        すべて削除
                                    </button>
                                )}
                            </div>
                        </div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-2">
                            通知
                        </h1>
                        <p className="text-slate-400">
                            {unreadCount > 0 ? `未読: ${unreadCount}件` : 'すべて既読'}
                        </p>
                    </div>

                    {/* Filter */}
                    <div className="mb-6 flex gap-2">
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                filter === 'all'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                        >
                            すべて ({notifications.length})
                        </button>
                        <button
                            onClick={() => setFilter('unread')}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                filter === 'unread'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                        >
                            未読 ({unreadCount})
                        </button>
                    </div>

                    {/* Notifications List */}
                    {filteredNotifications.length === 0 ? (
                        <div className="text-center py-12">
                            <Bell className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                            <p className="text-slate-400 text-lg mb-2">
                                {filter === 'unread' ? '未読の通知はありません' : '通知はありません'}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredNotifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    className={`p-6 bg-slate-700/30 rounded-lg border border-slate-600 hover:border-slate-500 transition-all cursor-pointer ${
                                        !notification.read ? 'bg-slate-700/50' : ''
                                    }`}
                                    onClick={() => handleNotificationClick(notification)}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-2">
                                                <h3 className="text-lg font-semibold text-white">
                                                    {notification.title}
                                                </h3>
                                                {!notification.read && (
                                                    <span className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full"></span>
                                                )}
                                            </div>
                                            <p className="text-slate-300 mb-3">{notification.message}</p>
                                            {notification.type === 'auth_key' && notification.data?.day_token && (
                                                <div className="mt-3 p-3 bg-blue-500/20 rounded border border-blue-500/30">
                                                    <p className="text-sm text-slate-300 mb-2">認証キー</p>
                                                    <p className="text-3xl font-bold text-blue-400 font-mono">
                                                        {notification.data.day_token}
                                                    </p>
                                                </div>
                                            )}
                                            <p className="text-sm text-slate-500 mt-3">
                                                {formatDate(notification.createdAt)}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            {!notification.read && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        markAsRead(notification.id);
                                                    }}
                                                    className="p-2 text-slate-400 hover:text-blue-400 transition-colors"
                                                    title="既読にする"
                                                >
                                                    <Check className="w-5 h-5" />
                                                </button>
                                            )}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteNotification(notification.id);
                                                }}
                                                className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                                                title="削除"
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
    );
}


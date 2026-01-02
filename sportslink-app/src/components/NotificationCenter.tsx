'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, X, Check, Trash2 } from 'lucide-react';
import { useNotificationStore, type Notification } from '@/features/notifications/hooks/useNotificationStore';
import { useRouter } from 'next/navigation';

export default function NotificationCenter() {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const { notifications, markAsRead, markAllAsRead, deleteNotification, deleteAllNotifications, getUnreadCount } =
        useNotificationStore();
    const router = useRouter();
    const unreadCount = getUnreadCount();

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleNotificationClick = (notification: Notification) => {
        markAsRead(notification.id);

        // Navigate based on notification type
        if (notification.type === 'umpire_assignment' && notification.data?.match_id) {
            router.push(`/scoring/${notification.data.match_id}`);
        } else if (notification.type === 'match_waiting' && notification.data?.match_id) {
            router.push(`/matches/${notification.data.match_id}`);
        }

        setIsOpen(false);
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'たった今';
        if (minutes < 60) return `${minutes}分前`;
        if (hours < 24) return `${hours}時間前`;
        if (days < 7) return `${days}日前`;
        return date.toLocaleDateString('ja-JP');
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-slate-400 hover:text-white transition-colors"
                aria-label="通知"
            >
                <Bell className="w-6 h-6" />
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-96 bg-slate-800 rounded-lg shadow-xl border border-slate-700 z-50 max-h-[600px] overflow-hidden flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-slate-700">
                        <h3 className="text-lg font-semibold text-white">通知</h3>
                        <div className="flex items-center gap-2">
                            {unreadCount > 0 && (
                                <button
                                    onClick={() => markAllAsRead()}
                                    className="p-1 text-slate-400 hover:text-white transition-colors"
                                    title="すべて既読にする"
                                >
                                    <Check className="w-4 h-4" />
                                </button>
                            )}
                            {notifications.length > 0 && (
                                <button
                                    onClick={() => {
                                        if (confirm('すべての通知を削除しますか？')) {
                                            deleteAllNotifications();
                                        }
                                    }}
                                    className="p-1 text-slate-400 hover:text-red-400 transition-colors"
                                    title="すべて削除"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1 text-slate-400 hover:text-white transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Notifications List */}
                    <div className="overflow-y-auto flex-1">
                        {notifications.length === 0 ? (
                            <div className="p-8 text-center">
                                <Bell className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                                <p className="text-slate-400">通知はありません</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-700">
                                {notifications.map((notification) => (
                                    <div
                                        key={notification.id}
                                        className={`p-4 hover:bg-slate-700/50 transition-colors cursor-pointer ${
                                            !notification.read ? 'bg-slate-700/30' : ''
                                        }`}
                                        onClick={() => handleNotificationClick(notification)}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h4 className="text-sm font-semibold text-white truncate">
                                                        {notification.title}
                                                    </h4>
                                                    {!notification.read && (
                                                        <span className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full"></span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-slate-400 mb-2">{notification.message}</p>
                                                {notification.type === 'auth_key' && notification.data?.day_token && (
                                                    <div className="mt-2 p-2 bg-blue-500/20 rounded border border-blue-500/30">
                                                        <p className="text-xs text-slate-300 mb-1">認証キー</p>
                                                        <p className="text-2xl font-bold text-blue-400 font-mono">
                                                            {notification.data.day_token}
                                                        </p>
                                                    </div>
                                                )}
                                                <p className="text-xs text-slate-500 mt-2">
                                                    {formatDate(notification.createdAt)}
                                                </p>
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteNotification(notification.id);
                                                }}
                                                className="flex-shrink-0 p-1 text-slate-500 hover:text-red-400 transition-colors"
                                                title="削除"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {notifications.length > 0 && (
                        <div className="p-2 border-t border-slate-700">
                            <button
                                onClick={() => router.push('/notifications')}
                                className="w-full py-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                            >
                                すべての通知を見る
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}


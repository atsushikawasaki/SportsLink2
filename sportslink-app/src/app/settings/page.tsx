'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/features/auth/hooks/useAuthStore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AppHeader from '@/components/AppHeader';

const profileSchema = z.object({
    displayName: z.string().min(1, '表示名を入力してください'),
});

const passwordSchema = z.object({
    currentPassword: z.string().min(1, '現在のパスワードを入力してください'),
    newPassword: z.string().min(8, '新しいパスワードは8文字以上で入力してください'),
    confirmPassword: z.string().min(8, 'パスワード（確認）は8文字以上で入力してください'),
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: 'パスワードが一致しません',
    path: ['confirmPassword'],
});

const deleteAccountSchema = z.object({
    password: z.string().min(1, 'パスワードを入力してください'),
});

type ProfileInput = z.infer<typeof profileSchema>;
type PasswordInput = z.infer<typeof passwordSchema>;
type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'app' | 'security'>('profile');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const { user, setUser, logout } = useAuthStore();
    const router = useRouter();

    const profileForm = useForm<ProfileInput>({
        resolver: zodResolver(profileSchema),
        defaultValues: {
            displayName: user?.display_name || '',
        },
    });

    const passwordForm = useForm<PasswordInput>({
        resolver: zodResolver(passwordSchema),
    });

    const deleteAccountForm = useForm<DeleteAccountInput>({
        resolver: zodResolver(deleteAccountSchema),
    });

    const onProfileSubmit = async (data: ProfileInput) => {
        setError(null);
        setSuccess(null);
        setIsLoading(true);

        try {
            const response = await fetch('/api/auth/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            const result = await response.json();

            if (!response.ok) {
                setError(result.error || '更新に失敗しました');
                return;
            }

            setUser(result.user);
            setSuccess('プロフィールを更新しました');
        } catch {
            setError('更新に失敗しました');
        } finally {
            setIsLoading(false);
        }
    };

    const onPasswordSubmit = async (data: PasswordInput) => {
        setError(null);
        setSuccess(null);
        setIsLoading(true);

        try {
            const response = await fetch('/api/auth/password', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    currentPassword: data.currentPassword,
                    newPassword: data.newPassword,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                setError(result.error || 'パスワードの変更に失敗しました');
                return;
            }

            setSuccess('パスワードを変更しました');
            passwordForm.reset();
        } catch {
            setError('パスワードの変更に失敗しました');
        } finally {
            setIsLoading(false);
        }
    };

    const onDeleteAccount = async (data: DeleteAccountInput) => {
        setError(null);
        setIsLoading(true);

        try {
            const response = await fetch('/api/auth/account', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            const result = await response.json();

            if (!response.ok) {
                setError(result.error || 'アカウントの削除に失敗しました');
                return;
            }

            logout();
            router.push('/');
        } catch {
            setError('アカウントの削除に失敗しました');
        } finally {
            setIsLoading(false);
        }
    };

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
                <div className="text-center">
                    <p className="text-slate-400 mb-4">ログインが必要です</p>
                    <Link
                        href="/login"
                        className="inline-block py-3 px-6 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold rounded-lg shadow-lg hover:from-blue-600 hover:to-cyan-600 transition-all duration-200"
                    >
                        ログイン
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            <AppHeader />
            <div className="max-w-4xl mx-auto px-4 py-8">
                <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 p-8">
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-2">
                            設定
                        </h1>
                    </div>

                    {/* Tabs */}
                    <div className="flex space-x-4 mb-8 border-b border-slate-700 overflow-x-auto">
                        <button
                            onClick={() => setActiveTab('profile')}
                            className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${
                                activeTab === 'profile'
                                    ? 'text-blue-400 border-b-2 border-blue-400'
                                    : 'text-slate-400 hover:text-slate-300'
                            }`}
                        >
                            プロフィール
                        </button>
                        <button
                            onClick={() => setActiveTab('notifications')}
                            className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${
                                activeTab === 'notifications'
                                    ? 'text-blue-400 border-b-2 border-blue-400'
                                    : 'text-slate-400 hover:text-slate-300'
                            }`}
                        >
                            通知設定
                        </button>
                        <button
                            onClick={() => setActiveTab('app')}
                            className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${
                                activeTab === 'app'
                                    ? 'text-blue-400 border-b-2 border-blue-400'
                                    : 'text-slate-400 hover:text-slate-300'
                            }`}
                        >
                            アプリ設定
                        </button>
                        <button
                            onClick={() => setActiveTab('security')}
                            className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${
                                activeTab === 'security'
                                    ? 'text-blue-400 border-b-2 border-blue-400'
                                    : 'text-slate-400 hover:text-slate-300'
                            }`}
                        >
                            セキュリティ
                        </button>
                    </div>

                    {/* Error/Success Messages */}
                    {error && (
                        <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                            <p className="text-sm text-red-400">{error}</p>
                        </div>
                    )}
                    {success && (
                        <div className="mb-6 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                            <p className="text-sm text-green-400">{success}</p>
                        </div>
                    )}

                    {/* Profile Tab */}
                    {activeTab === 'profile' && (
                        <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-6">
                            <div>
                                <label htmlFor="displayName" className="block text-sm font-medium text-slate-300 mb-2">
                                    表示名
                                </label>
                                <input
                                    {...profileForm.register('displayName')}
                                    type="text"
                                    id="displayName"
                                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    placeholder="表示名を入力"
                                />
                                {profileForm.formState.errors.displayName && (
                                    <p className="mt-1 text-sm text-red-400">
                                        {profileForm.formState.errors.displayName.message}
                                    </p>
                                )}
                            </div>

                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                                    メールアドレス
                                </label>
                                <input
                                    type="email"
                                    id="email"
                                    value={user.email || ''}
                                    disabled
                                    className="w-full px-4 py-3 bg-slate-700/30 border border-slate-600 rounded-lg text-slate-400 cursor-not-allowed"
                                />
                                <p className="mt-1 text-sm text-slate-500">メールアドレスは変更できません</p>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold rounded-lg shadow-lg hover:from-blue-600 hover:to-cyan-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                            >
                                {isLoading ? '保存中...' : '保存'}
                            </button>
                        </form>
                    )}

                    {/* Notifications Tab */}
                    {activeTab === 'notifications' && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-semibold text-white mb-4">通知設定</h2>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg">
                                    <div>
                                        <h3 className="text-white font-medium">メール通知</h3>
                                        <p className="text-sm text-slate-400">メールでの通知を受け取る</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" defaultChecked />
                                        <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>

                                <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg">
                                    <div>
                                        <h3 className="text-white font-medium">プッシュ通知</h3>
                                        <p className="text-sm text-slate-400">ブラウザからのプッシュ通知を受け取る</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" defaultChecked />
                                        <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>

                                <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg">
                                    <div>
                                        <h3 className="text-white font-medium">試合更新通知</h3>
                                        <p className="text-sm text-slate-400">担当試合の更新通知を受け取る</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" defaultChecked />
                                        <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>

                                <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg">
                                    <div>
                                        <h3 className="text-white font-medium">大会更新通知</h3>
                                        <p className="text-sm text-slate-400">参加大会の更新通知を受け取る</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" defaultChecked />
                                        <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>
                            </div>
                            <p className="text-sm text-slate-400 mt-4">
                                注: 通知設定は現在開発中です。設定は保存されません。
                            </p>
                        </div>
                    )}

                    {/* App Settings Tab */}
                    {activeTab === 'app' && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-semibold text-white mb-4">アプリ設定</h2>
                            <div className="space-y-4">
                                <div className="p-4 bg-slate-700/30 rounded-lg">
                                    <h3 className="text-white font-medium mb-2">テーマ</h3>
                                    <p className="text-sm text-slate-400 mb-3">アプリの表示テーマを選択</p>
                                    <div className="flex space-x-4">
                                        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium">
                                            ダーク
                                        </button>
                                        <button className="px-4 py-2 bg-slate-600 text-white rounded-lg font-medium hover:bg-slate-700">
                                            ライト
                                        </button>
                                    </div>
                                </div>

                                <div className="p-4 bg-slate-700/30 rounded-lg">
                                    <h3 className="text-white font-medium mb-2">言語</h3>
                                    <p className="text-sm text-slate-400 mb-3">表示言語を選択</p>
                                    <select className="w-full px-4 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white">
                                        <option value="ja">日本語</option>
                                        <option value="en">English</option>
                                    </select>
                                </div>

                                <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg">
                                    <div>
                                        <h3 className="text-white font-medium">自動同期</h3>
                                        <p className="text-sm text-slate-400">オフライン時のデータを自動的に同期</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" defaultChecked />
                                        <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>

                                <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg">
                                    <div>
                                        <h3 className="text-white font-medium">オフラインモード</h3>
                                        <p className="text-sm text-slate-400">オフライン時の機能を有効化</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" defaultChecked />
                                        <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>
                            </div>
                            <p className="text-sm text-slate-400 mt-4">
                                注: アプリ設定は現在開発中です。設定は保存されません。
                            </p>
                        </div>
                    )}

                    {/* Security Tab */}
                    {activeTab === 'security' && (
                        <div className="space-y-8">
                            {/* Password Change */}
                            <div>
                                <h2 className="text-xl font-semibold text-white mb-4">パスワード変更</h2>
                                <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-6">
                                    <div>
                                        <label htmlFor="currentPassword" className="block text-sm font-medium text-slate-300 mb-2">
                                            現在のパスワード
                                        </label>
                                        <input
                                            {...passwordForm.register('currentPassword')}
                                            type="password"
                                            id="currentPassword"
                                            className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                            placeholder="現在のパスワード"
                                        />
                                        {passwordForm.formState.errors.currentPassword && (
                                            <p className="mt-1 text-sm text-red-400">
                                                {passwordForm.formState.errors.currentPassword.message}
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <label htmlFor="newPassword" className="block text-sm font-medium text-slate-300 mb-2">
                                            新しいパスワード
                                        </label>
                                        <input
                                            {...passwordForm.register('newPassword')}
                                            type="password"
                                            id="newPassword"
                                            className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                            placeholder="6文字以上"
                                        />
                                        {passwordForm.formState.errors.newPassword && (
                                            <p className="mt-1 text-sm text-red-400">
                                                {passwordForm.formState.errors.newPassword.message}
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-300 mb-2">
                                            パスワード（確認）
                                        </label>
                                        <input
                                            {...passwordForm.register('confirmPassword')}
                                            type="password"
                                            id="confirmPassword"
                                            className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                            placeholder="パスワードを再入力"
                                        />
                                        {passwordForm.formState.errors.confirmPassword && (
                                            <p className="mt-1 text-sm text-red-400">
                                                {passwordForm.formState.errors.confirmPassword.message}
                                            </p>
                                        )}
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isLoading}
                                        className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold rounded-lg shadow-lg hover:from-blue-600 hover:to-cyan-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                                    >
                                        {isLoading ? '変更中...' : 'パスワードを変更'}
                                    </button>
                                </form>
                            </div>

                            {/* Account Deletion */}
                            <div className="border-t border-slate-700 pt-8">
                                <h2 className="text-xl font-semibold text-white mb-4">アカウント削除</h2>
                                <p className="text-slate-400 mb-4">
                                    アカウントを削除すると、すべてのデータが削除され、この操作は取り消せません。
                                </p>

                                {!showDeleteConfirm ? (
                                    <button
                                        onClick={() => setShowDeleteConfirm(true)}
                                        className="px-6 py-3 bg-red-600 text-white font-semibold rounded-lg shadow-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-slate-800 transition-all duration-200"
                                    >
                                        アカウントを削除
                                    </button>
                                ) : (
                                    <form onSubmit={deleteAccountForm.handleSubmit(onDeleteAccount)} className="space-y-6">
                                        <div>
                                            <label htmlFor="deletePassword" className="block text-sm font-medium text-slate-300 mb-2">
                                                パスワードを再入力してください
                                            </label>
                                            <input
                                                {...deleteAccountForm.register('password')}
                                                type="password"
                                                id="deletePassword"
                                                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                                                placeholder="パスワード"
                                            />
                                            {deleteAccountForm.formState.errors.password && (
                                                <p className="mt-1 text-sm text-red-400">
                                                    {deleteAccountForm.formState.errors.password.message}
                                                </p>
                                            )}
                                        </div>

                                        <div className="flex space-x-4">
                                            <button
                                                type="submit"
                                                disabled={isLoading}
                                                className="px-6 py-3 bg-red-600 text-white font-semibold rounded-lg shadow-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                                            >
                                                {isLoading ? '削除中...' : 'アカウントを削除'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setShowDeleteConfirm(false);
                                                    deleteAccountForm.reset();
                                                }}
                                                className="px-6 py-3 bg-slate-600 text-white font-semibold rounded-lg shadow-lg hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-800 transition-all duration-200"
                                            >
                                                キャンセル
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </div>

                            {/* Logout */}
                            <div className="border-t border-slate-700 pt-8">
                                <button
                                    onClick={async () => {
                                        await logout();
                                        router.push('/');
                                    }}
                                    className="px-6 py-3 bg-slate-600 text-white font-semibold rounded-lg shadow-lg hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-800 transition-all duration-200"
                                >
                                    ログアウト
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="mt-8 pt-8 border-t border-slate-700">
                        <Link
                            href="/dashboard"
                            className="text-sm text-slate-400 hover:text-blue-400 transition-colors"
                        >
                            ダッシュボードに戻る
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}


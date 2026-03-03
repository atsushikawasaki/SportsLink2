'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useParams } from 'next/navigation';
import { Save } from 'lucide-react';
import AppShell from '@/components/AppShell';
import Breadcrumbs from '@/components/Breadcrumbs';
import TournamentSubNav from '@/components/TournamentSubNav';

interface User {
    id: string;
    email: string;
    display_name: string;
}

interface Role {
    user_id: string;
    tournament_id: string;
    role: 'tournament_admin' | 'scorer';
    users?: User;
}

interface Tournament {
    id: string;
    name: string;
}

export default function RolesPage() {
    const params = useParams();
    const tournamentId = params.id as string;

    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    const [roleAssignments, setRoleAssignments] = useState<Record<string, { tournament_admin: boolean; scorer: boolean }>>({});
    const [isSaving, setIsSaving] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);

            const tournamentRes = await fetch(`/api/tournaments/${tournamentId}`);
            const tournamentData = await tournamentRes.json();
            if (tournamentRes.ok) {
                setTournament(tournamentData);
            }

            const usersRes = await fetch('/api/auth/users');
            const usersData = await usersRes.json();
            if (usersRes.ok) {
                setUsers(usersData.data || []);
            }

            const rolesRes = await fetch(`/api/roles/tournaments/${tournamentId}`);
            const rolesData = await rolesRes.json();
            if (rolesRes.ok) {
                setRoles(rolesData.data || []);
                const initialAssignments: Record<string, { tournament_admin: boolean; scorer: boolean }> = {};
                usersData.data?.forEach((user: User) => {
                    initialAssignments[user.id] = {
                        tournament_admin: false,
                        scorer: false,
                    };
                });
                rolesData.data?.forEach((role: Role) => {
                    if (initialAssignments[role.user_id]) {
                        initialAssignments[role.user_id][role.role] = true;
                    }
                });
                setRoleAssignments(initialAssignments);
            }
        } catch (err) {
            console.error('Failed to fetch data:', err);
        } finally {
            setLoading(false);
        }
    }, [tournamentId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleRoleChange = (userId: string, role: 'tournament_admin' | 'scorer', checked: boolean) => {
        setRoleAssignments((prev) => ({
            ...prev,
            [userId]: {
                ...prev[userId],
                [role]: checked,
            },
        }));
    };

    const handleSave = async () => {
        try {
            setIsSaving(true);

            // 変更を検出してAPI呼び出し
            const promises: Promise<Response>[] = [];

            users.forEach((user) => {
                const current = roleAssignments[user.id];
                const existing = roles.find((r) => r.user_id === user.id);

                const currentTournamentAdmin = current?.tournament_admin || false;
                const currentScorer = current?.scorer || false;
                const existingTournamentAdmin = existing?.role === 'tournament_admin';
                const existingScorer = existing?.role === 'scorer';

                // tournament_adminの変更
                if (currentTournamentAdmin && !existingTournamentAdmin) {
                    promises.push(
                        fetch('/api/roles/assign', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                user_id: user.id,
                                tournament_id: tournamentId,
                                role: 'tournament_admin',
                            }),
                        })
                    );
                } else if (!currentTournamentAdmin && existingTournamentAdmin) {
                    promises.push(
                        fetch(`/api/roles/remove?user_id=${user.id}&tournament_id=${tournamentId}&role=tournament_admin`, {
                            method: 'DELETE',
                        })
                    );
                }

                // scorerの変更
                if (currentScorer && !existingScorer) {
                    promises.push(
                        fetch('/api/roles/assign', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                user_id: user.id,
                                tournament_id: tournamentId,
                                role: 'scorer',
                            }),
                        })
                    );
                } else if (!currentScorer && existingScorer) {
                    promises.push(
                        fetch(`/api/roles/remove?user_id=${user.id}&tournament_id=${tournamentId}&role=scorer`, {
                            method: 'DELETE',
                        })
                    );
                }
            });

            await Promise.all(promises);
            toast.success('権限を保存しました');
            fetchData();
        } catch {
            toast.error('権限の保存に失敗しました');
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="bg-[var(--color-bg-primary)] flex items-center justify-center min-h-screen">
                <LoadingSpinner />
            </div>
        );
    }

    return (
        <AppShell>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Page Header */}
                <div className="mb-8">
                    <Breadcrumbs
                        items={[
                            { label: '大会一覧', href: '/tournaments' },
                            { label: tournament?.name || '大会詳細', href: `/tournaments/${tournamentId}` },
                            { label: '権限管理' },
                        ]}
                    />
                    <div className="flex items-center justify-between mt-4">
                        <div>
                            <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">
                                権限管理
                            </h1>
                            {tournament && <p className="text-[var(--color-text-muted)] mt-2">{tournament.name}</p>}
                            <div className="mt-3 flex flex-wrap gap-6 text-sm text-[var(--color-text-muted)]">
                                <span>
                                    <strong className="text-[var(--color-text-secondary)]">大会運営者:</strong> エントリー・ドロー・試合割当などの大会運営全般を編集できます
                                </span>
                                <span>
                                    <strong className="text-[var(--color-text-secondary)]">審判:</strong> 担当試合のスコア入力・ペア提出ができます
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-semibold rounded-lg shadow-lg hover:from-yellow-600 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                        >
                            <Save className="w-4 h-4" />
                            {isSaving ? '保存中...' : '保存'}
                        </button>
                    </div>
                </div>

                <TournamentSubNav tournamentId={tournamentId} />

                {/* Users List */}
                <div className="space-y-4">
                    {users.map((user) => {
                        const assignments = roleAssignments[user.id] || { tournament_admin: false, scorer: false };

                        return (
                            <div
                                key={user.id}
                                className="p-6 bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-base)]"
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-[var(--color-text-primary)] font-medium">{user.display_name || user.email}</p>
                                        <p className="text-[var(--color-text-muted)] text-sm">{user.email}</p>
                                    </div>
                                    <div className="flex gap-6">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={assignments.tournament_admin}
                                                onChange={(e) =>
                                                    handleRoleChange(user.id, 'tournament_admin', e.target.checked)
                                                }
                                                className="h-4 w-4 rounded border-[var(--color-border-base)] bg-[var(--color-bg-surface-2)] text-yellow-500 focus:ring-yellow-500"
                                            />
                                            <span className="text-[var(--color-text-secondary)]">大会運営者</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={assignments.scorer}
                                                onChange={(e) => handleRoleChange(user.id, 'scorer', e.target.checked)}
                                                className="h-4 w-4 rounded border-[var(--color-border-base)] bg-[var(--color-bg-surface-2)] text-yellow-500 focus:ring-yellow-500"
                                            />
                                            <span className="text-[var(--color-text-secondary)]">審判</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {users.length === 0 && (
                    <div className="text-center py-12">
                        <p className="text-[var(--color-text-muted)]">ユーザーがありません</p>
                    </div>
                )}
            </div>
        </AppShell>
    );
}


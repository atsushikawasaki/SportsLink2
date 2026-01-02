import { NextResponse } from 'next/server';

// GET /api/roles/permissions - 権限一覧取得
export async function getPermissions() {
    // 権限の定義を返す
    const permissions = [
        {
            role: 'tournament_admin',
            name: '大会運営者',
            description: '大会の作成・管理、ドロー生成、試合管理が可能',
        },
        {
            role: 'scorer',
            name: '審判',
            description: 'リアルタイムスコア入力が可能',
        },
        {
            role: 'team_manager',
            name: 'チーム管理者',
            description: 'チーム・選手管理が可能',
        },
        {
            role: 'master',
            name: 'マスタ',
            description: '全権限',
        },
        {
            role: 'master_manager',
            name: 'マスタ管理者',
            description: 'システム管理権限',
        },
    ];

    return NextResponse.json({ data: permissions });
}


# 500エラー分析レポート

## エラー概要

ブラウザコンソールで以下のエラーが発生：
```
Failed to load resource: the server responded with a status of 500 (Internal Server Error)
```

## 根本原因

### 1. `match_pairs`テーブルのRLSポリシーで無限再帰エラー

**エラーコード**: `42P17`  
**エラーメッセージ**: `infinite recursion detected in policy for relation "match_pairs"`

**発生箇所**:
- `/api/matches/umpire/[umpireId]` - `getUmpireMatches`
- `/api/tournaments/[id]/matches` - `getTournamentMatches`
- その他、`match_pairs`をSELECTするすべてのエンドポイント

**原因**:
- `match_pairs`のRLSポリシーが`matches`テーブルを参照
- `matches`のRLSポリシーが`user_permissions`テーブルを参照
- `user_permissions`のRLSポリシー評価中に再度`match_pairs`を参照しようとして循環参照が発生

**影響を受けるクエリ**:
```typescript
// 以下のようなクエリでエラーが発生
.select(`
    *,
    match_pairs(
        *,
        teams:team_id (...)
    )
`)
```

## 解決策

### 即座の対応（推奨）

マイグレーション014をデータベースに適用してください：

```bash
cd sportslink-app
npx supabase db push
```

または、Supabaseダッシュボードから直接SQLを実行：

```sql
-- マイグレーション014の内容を実行
-- ファイル: supabase/migrations/014_fix_match_pairs_rls_recursion.sql
```

### マイグレーション014の内容

1. **`check_match_access`関数の作成**
   - `SECURITY DEFINER`を使用してRLSをバイパス
   - `matches`テーブルへの直接参照を回避

2. **`match_pairs`ポリシーの更新**
   - 新しい関数を使用するように変更

3. **関連テーブルの修正**
   - `match_slots`、`match_scores`、`points`も同様に修正

## 一時的な回避策（マイグレーション適用前）

マイグレーションを適用できない場合、以下のいずれかの方法で回避できます：

### 方法1: Admin Clientを使用（推奨）

```typescript
import { createAdminClient } from '@/lib/supabase/admin';

const adminClient = createAdminClient();
// Admin ClientはRLSをバイパスするため、無限再帰が発生しない
const { data, error } = await adminClient
    .from('matches')
    .select(`
        *,
        match_pairs(...)
    `);
```

### 方法2: `match_pairs`のSELECTを分離

```typescript
// まずmatchesを取得
const { data: matches } = await supabase
    .from('matches')
    .select('*');

// その後、各matchのmatch_pairsを個別に取得
const matchesWithPairs = await Promise.all(
    matches.map(async (match) => {
        const { data: pairs } = await supabase
            .from('match_pairs')
            .select('*')
            .eq('match_id', match.id);
        return { ...match, match_pairs: pairs };
    })
);
```

## エラー発生パターン

### パターン1: 審判の担当試合一覧取得
- **エンドポイント**: `GET /api/matches/umpire/[umpireId]`
- **関数**: `getUmpireMatches`
- **エラー**: `infinite recursion detected in policy for relation "match_pairs"`

### パターン2: 大会の試合一覧取得
- **エンドポイント**: `GET /api/tournaments/[id]/matches`
- **関数**: `getTournamentMatches`
- **エラー**: `infinite recursion detected in policy for relation "match_pairs"`

### パターン3: ドロー取得
- **エンドポイント**: `GET /api/tournaments/[id]/draw`
- **関数**: `getDraw`
- **エラー**: `match_pairs`を含むSELECTで発生する可能性

## 確認方法

マイグレーションが適用されているか確認：

```sql
-- check_match_access関数が存在するか確認
SELECT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'check_match_access'
);

-- match_pairsのポリシーを確認
SELECT * FROM pg_policies 
WHERE tablename = 'match_pairs';
```

## 推奨アクション

1. **即座に実行**: マイグレーション014を適用
2. **確認**: エラーが解消されたか確認
3. **監視**: 他のエンドポイントでも同様のエラーが発生していないか確認

## 関連ファイル

- マイグレーション: `supabase/migrations/014_fix_match_pairs_rls_recursion.sql`
- 影響を受けるAPI:
  - `src/app/api/matches/umpire/[umpireId]/getUmpireMatches.ts`
  - `src/app/api/tournaments/[id]/matches/getTournamentMatches.ts`
  - `src/app/api/tournaments/[id]/draw/getDraw.ts`
  - `src/app/api/matches/[id]/getMatch.ts`


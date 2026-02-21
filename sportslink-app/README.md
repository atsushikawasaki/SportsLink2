This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Testing

このプロジェクトでは、自動テスト環境が設定されています。

### テストコマンド

```bash
# テストを実行（一度だけ）
npm run test

# ウォッチモードでテストを実行
npm run test:watch

# テストUIを開く
npm run test:ui

# カバレッジレポートを生成
npm run test:coverage

# リントエラーを自動修正してからテストを実行
npm run test:fix
```

### 結合テスト（Supabase 接続）をスキップさせずに実行する

`npm run test` 実行時に、Vitest は `.env.local` と `.env.test` を読み込みます（`.env.test` が後なので上書きされます）。  
結合テスト（`connection.integration.test.ts`）をスキップさせずに実行するには、次のいずれかを行ってください。

- **`.env.test` を用意する**  
  `.env.test.example` をコピーして `.env.test` を作成し、Supabase の URL と anon キーを設定する。  
  `cp .env.test.example .env.test` のあと、値を編集。
- **既存の `.env.local` を使う**  
  `.env.local` に `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` が設定されていれば、そのまま `npm run test` で結合テストも実行されます（`.env.test` が無い場合は `.env.local` の値が使われます）。

`.env.test` は `.gitignore` に含まれており、リポジトリにはコミットされません。

### 自動テストフロー

GitHub Actionsで以下の自動テストフローが設定されています：

1. **テスト実行**: 初回テストを実行
2. **エラー確認**: テストとリントのエラーを確認
3. **自動修正**: リントエラーを自動修正
4. **再テスト**: 自動修正後の再テストを実行
5. **レポート生成**: テスト結果とカバレッジレポートを生成

ワークフローは以下のタイミングで実行されます：
- `main`または`develop`ブランチへのプッシュ
- プルリクエスト作成時
- 手動実行（workflow_dispatch）

### テストファイルの場所

- 単体テスト: `src/**/__tests__/*.test.ts` または `src/**/__tests__/*.test.tsx`
- テスト設定: `vitest.config.ts`
- テストセットアップ: `src/test/setup.ts`

### テストの書き方

```typescript
import { describe, it, expect } from 'vitest';

describe('機能名', () => {
  it('should do something', () => {
    expect(true).toBe(true);
  });
});
```

## 審判用ゲストアカウント（ドロー生成）

マイグレーション `024_umpire_nullable_and_guest_umpire.sql` で以下を実施します。

- **matches.umpire_id** を NULL 許可にし、「未割り当て」を選択可能にします。
- **審判用ゲストアカウント**を 1 件登録します（`auth.users` / `public.users` / `auth.identities`）。
  - 固定 UUID: `11111111-1111-1111-1111-111111111111`
  - メール: `guest-umpire@sportslink.local`
  - 表示名: ゲスト審判
  - 初期パスワード: `GuestUmpire1!`（本番では変更を推奨）

ドロー生成で「ゲスト審判」を選ぶには、環境変数にゲスト審判のユーザー ID を設定してください。

```env
GUEST_UMPIRE_USER_ID=11111111-1111-1111-1111-111111111111
```

Supabase のホスト環境によっては `auth.users` への直接 INSERT が制限されている場合があります。その場合は Supabase ダッシュボードで同じメール・UUID でユーザーを作成し、`GUEST_UMPIRE_USER_ID` にその ID を設定してください。

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

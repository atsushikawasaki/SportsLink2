# 規約文管理ガイド

## 概要

利用規約とプライバシーポリシーは、Markdownファイルで管理されています。これにより、Git履歴で変更履歴を追跡でき、コードレビューで変更内容を確認できます。

## ファイル構造

```
src/content/
  ├── terms/
  │   ├── 1.0.0.md          # 初版
  │   ├── 1.1.0.md          # 更新版（例）
  │   └── latest.md         # 最新版へのシンボリックリンク
  └── privacy/
      ├── 1.0.0.md
      ├── 1.1.0.md
      └── latest.md
```

## 規約を更新する手順

### 1. 新しいバージョンのMarkdownファイルを作成

```bash
# 例: 利用規約を1.1.0に更新する場合
cp src/content/terms/1.0.0.md src/content/terms/1.1.0.md
```

### 2. Markdownファイルを編集

`src/content/terms/1.1.0.md` を編集し、以下を更新：
- **最終更新日**: 実際の更新日を記載
- **バージョン**: 新しいバージョン番号を記載
- 規約内容を必要に応じて修正

### 3. latest.mdを更新

```bash
cp src/content/terms/1.1.0.md src/content/terms/latest.md
```

### 4. 環境変数を更新

`.env` ファイルまたは環境変数で、最新バージョンを指定：

```env
NEXT_PUBLIC_TERMS_VERSION=1.1.0
NEXT_PUBLIC_PRIVACY_VERSION=1.1.0
```

### 5. 変更をコミット

```bash
git add src/content/terms/1.1.0.md src/content/terms/latest.md
git commit -m "Update terms to version 1.1.0"
```

## Markdown形式

規約文は標準的なMarkdown形式で記述します：

```markdown
# タイトル

**最終更新日**: 2024年1月1日  
**バージョン**: 1.0.0

---

## セクション1

本文...

## セクション2

- リスト項目1
- リスト項目2
```

## APIエンドポイント

- `GET /api/terms/latest` - 最新版の利用規約を取得
- `GET /api/terms/1.0.0` - 特定バージョンの利用規約を取得
- `GET /api/privacy/latest` - 最新版のプライバシーポリシーを取得
- `GET /api/privacy/1.0.0` - 特定バージョンのプライバシーポリシーを取得

## バージョン管理のベストプラクティス

1. **セマンティックバージョニング**: `MAJOR.MINOR.PATCH` 形式を使用
   - MAJOR: 大きな変更（再同意が必要）
   - MINOR: 小さな変更（再同意不要の場合もある）
   - PATCH: 誤字脱字の修正

2. **変更履歴の記録**: Gitコミットメッセージに変更内容を明記

3. **再同意の判断**: バージョンのMAJOR番号が変わった場合は再同意を要求

4. **バックアップ**: 古いバージョンは削除せず、履歴として保持

## トラブルシューティング

### 規約が表示されない

1. Markdownファイルが正しい場所にあるか確認
2. ファイル名が正しいか確認（`latest.md` またはバージョン番号）
3. 環境変数が正しく設定されているか確認

### バージョンが一致しない

1. 環境変数 `NEXT_PUBLIC_TERMS_VERSION` を確認
2. Markdownファイル内のバージョン番号を確認
3. `src/lib/consent-versions.ts` の設定を確認


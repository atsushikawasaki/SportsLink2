# 実装計画書 (Implementation Plan)

## 1. プロジェクトおよびゴール
**SportsLink2**
完全要件定義書に基づき、ソフトテニス大会運営支援システム「Sport Link」の商用版を構築します。
**要件定義書の全仕様（機能・API・DB）を100%遵守**し、Next.js App Routerを用いたモダンな構成で実装します。

## 2. ユーザーレビュー要求事項
- **API実装方式**: 元の要件定義書（第4章）を正とし、**REST API endpoints** を厳密に実装します。
    - 実装技術: Next.js Route Handlers (`app/api/...`)
    - Server Actionsはフォーム投稿などの限定的な用途、またはAPI内部ロジックの共有に留めます。
- **全機能の網羅**: 漏れ・齟齬のないよう、要件定義書の機能を全て計画に含めます。

## 3. 詳細実装計画

### 3.1 アーキテクチャ構成 (Feature-based)
- **Frontend**: Next.js 14 (App Router) + React Client Components
- **Backend API**: Next.js Route Handlers (`src/app/api/**`)
    - URL構造は要件定義書に完全準拠 (例: `/api/tournaments/:id/matches`)
- **Database**: Supabase PostgreSQL
- **Auth**: Supabase Auth (JWT)

### 3.2 データベース設計 (Schema & Security)
要件定義書 3.1 に基づき、全テーブル・カラム・制約を実装します。

#### Tables (完全準拠)
- **Users**: `id`, `email`, `display_name`, `password_hash`, `master_flag`, `umpire_flag`...
- **Tournaments**: `id`, `name`, `status`, `umpire_mode` ('LOSER'|'ASSIGNED'|'FREE')...
- **Teams**: `id`, `tournament_id`, `name`, `school_name`...
- **Tournament_Players**: `id`, `player_name`, `player_type`...
- **Tournament_Pairs**: `id`, `pair_number`... (個人/団体, ダブルス/シングルス対応)
- **Tournament_Entries**: `id`, `entry_type`, `day_token` (4桁認証キー), `is_checked_in`...
- **Matches**: `id`, `round_name`, `umpire_id`, `status`, `version` (楽観ロック), `winner_next_match_id`...
- **Match_Phrases / Groups / Slots**: ドロー構造用テーブル群
- **Points**: `id`, `match_id`, `point_type`, `is_undone`...
- **Audit_Logs**: `operation_type`, `old_data`, `new_data`...

### 3.3 API実装計画 (Endpoints)
要件定義書 第4章 の全エンドポイントを実装します。

#### A. 認証 (`/api/auth`)
- `POST /login`, `/signup`: JWT発行
- `POST /forgot-password`, `/reset-password`: リカバリフロー
- `DELETE /account`: 退会処理
- `GET /umpires`, `/users`: ユーザー一覧取得

#### B. 大会管理 (`/api/tournaments`)
- `POST /`, `GET /`, `GET /:id`, `PUT /:id`, `DELETE /:id`: 基本CRUD
- **関連リソース管理**:
    - `/teams`, `/players`, `/pairs`: CRUD実装
    - `/entries`: 一覧取得
    - `POST /entries/import`, `GET /entries/export`: CSV処理
    - `POST /entries/:entryId/checkin`: **当日受付 & 認証キー発行**
    - `GET /entries/:entryId/token`: 認証キー参照
- **ドロー管理**:
    - `GET /draw`, `PUT /draw`: 取得・更新
    - `POST /draw/generate`: **ドロー自動生成** (シード/所属考慮)
- **ステータス制御**:
    - `POST /publish`: 公開
    - `POST /finish`: 終了

#### C. 試合管理 (`/api/matches`)
- `POST /`, `GET /`, `GET /:id`, `PUT /:id`, `DELETE /:id`: 基本CRUD
- **進行管理**:
    - `PUT /:id/assign`: 審判・コート割当
    - `PUT /:id/status`: ステータス更新
    - `POST /:id/pairs`: **オーダー(ペア)提出**
- **トラブルシューティング (管理者用)**:
    - `DELETE /:id/umpire`, `PUT /:id/umpire`: **審判強制解除・変更**
    - `POST /:id/revert`: **試合差し戻し** (finished -> inprogress)

#### D. スコアリング (`/api/scoring`)
- `POST /points`: ポイント入力 (キューイング対応)
- `POST /undo`: Undo操作
- `GET /matches/:id/score`: 現在スコア取得
- `PUT /matches/:id/score`: **スコア直接修正** (管理者用)
- `POST /matches/:id/start`, `/pause`, `/resume`, `/finish`: 試合制御
- `POST /matches/:id/verify-token`: **審判認証キー検証**
- `GET /live`: ライブスコア取得

#### E. その他 (`/api/teams`, `/api/roles`, `/api/support`)
- チーム管理: CRUD, 選手管理
- 権限管理: `POST /assign`, `DELETE /remove`, `GET /check`
- サポート: `POST /contact`

### 3.4 機能実装詳細

#### 1. ドロー生成エンジン (`DrawEngineService`)
- シングルエリミネーション方式
- シード順位、同所属回避、BYE配置ロジックの実装

#### 2. スコア計算エンジン (`ScoreEngine`)
- 通常ゲーム (0-3, Game)
- デュース (Advantage)
- タイブレーク/ファイナルゲーム (7pt先取)
- `gamesToWin` 設定に基づく動的判定

#### 3. オフライン・同期機能
- **Dexie.js (IndexedDB)**: `Points`, `MatchActions` をローカル保存
- **SyncQueue**: オンライン復帰時にAPIへ送信
- **競合解決**: `E-CONFL-001` (409) エラーハンドリング → 最新スコア再取得

#### 4. UI/UX
- **審判用スコアボード**: モバイル最適化、大ボタン、屋外視認性
- **通知センター**: 認証キー(`day_token`)の永続化・表示

## 4. 検証計画

### 自動テスト
- **Unit Test**: API Route Handlers, Service Logic (Draw, Score)
- **E2E Test**: API経由でのシナリオテスト

### シナリオ検証 (Browser Tool)
要件定義書の「現場トラブル対応」を含む以下のフローを検証します。
1. **大会運営**: 作成 -> CSVインポート -> ドロー生成 -> 公開
2. **審判/試合**: チェックイン(キー発行) -> ログイン -> 認証 -> スコア入力 -> 試合終了
3. **トラブル対応**: 誤操作 -> 試合差し戻し -> スコア修正 -> 審判強制変更

## 5. 技術スタック
- **Framework**: `next` (App Router)
- **API**: `Next.js Route Handlers`
- **DB**: `supabase-js` (PostgreSQL)

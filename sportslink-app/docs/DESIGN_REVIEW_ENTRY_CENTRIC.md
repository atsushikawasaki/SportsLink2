# エントリー中心スキーマ移行後の設計レビュー報告

**対象**: 023 マイグレーション（teams 永続化・entry-centric）適用後のコードベース  
**目的**: 潜在的な不整合・破損している API・ドキュメントのずれを整理し、修正候補を報告する。

---

## 1. 破損している API（要修正）

以下の API は **旧スキーマ（tournament_id / team_id  on teams, tournament_players, tournament_pairs）を前提**としており、現行スキーマでは動作しません。

### 1.1 チーム関連

| ファイル | 問題 | 推奨対応 |
|----------|------|----------|
| **`api/teams/createTeam.ts`** | `teams` に `tournament_id` を insert しているが、023 で `teams.tournament_id` は削除済み。 | insert から `tournament_id` を削除する。`name`, `team_manager_user_id` のみで作成。 |
| **`api/teams/[id]/getTeam.ts`** | `teams` にネストで `tournament_players` を select。旧は `teams.id = tournament_players.team_id`。新は `tournament_players.actual_team_id = teams.id`。 | Supabase のリレーションが `actual_team_id` で逆参照になっていればそのまま動く可能性あり。未定義なら `tournament_players!actual_team_id` などで明示するか、別クエリで `actual_team_id = id` の選手を取得。 |
| **`api/teams/[id]/players/getTeamPlayers.ts`** | `teams.tournament_id` を参照しているが、teams から tournament_id は削除済み。`tournament_players` を `team_id` / `tournament_id` で絞っているが、現行は `entry_id` / `actual_team_id` のみ。 | チームの選手＝「そのチームを actual_team_id に持つ tournament_players」と再定義。`tournament_players` を `actual_team_id = id` で取得。`teams` の select から `tournament_id` をやめる。 |
| **`api/teams/[id]/players/addTeamPlayer.ts`** | `teams.tournament_id` を取得し、`tournament_players` に `tournament_id` / `team_id` で insert。両カラムは削除済み。 | 新モデルでは「選手」は必ず「エントリー」に属する。選択肢: (A) この API を「エントリー作成＋選手1人＋ペア作成」のオーケストレーションに変更（entry_type=singles, team_id=このチーム）、(B) 一旦非推奨とし、選手登録は CSV インポート／エントリー画面に一本化。 |

### 1.2 大会・選手・ペア関連

| ファイル | 問題 | 推奨対応 |
|----------|------|----------|
| **`api/tournaments/[id]/players/getTournamentPlayers.ts`** | `tournament_players` を `tournament_id` で絞り、`teams:team_id` で join。現行は `tournament_id` / `team_id` なし。 | 大会の選手＝「その大会の tournament_entries に紐づく tournament_players」として取得。`tournament_entries` を `tournament_id = id` で取得 → `entry_id` のリストで `tournament_players` を `entry_id in (...)` で取得。必要なら `actual_team_id` で teams を join。 |
| **`api/tournaments/[id]/players/addTournamentPlayer.ts`** | `tournament_players` に `tournament_id` / `team_id` で insert。両カラムは削除済み。 | 新モデルでは選手は必ず entry に属する。getTournamentPlayers と同様、(A) エントリー＋選手＋ペアを一括作成する API に変更するか、(B) 非推奨とし CSV／エントリー UI に一本化。 |
| **`api/tournaments/[id]/pairs/getTournamentPairs.ts`** | `tournament_pairs` を `tournament_id` で絞り、`teams:team_id` を select。現行は `tournament_pairs` に `tournament_id` / `team_id` なし。 | 大会のペア＝「その大会の entries に紐づく pairs」。`tournament_entries` で `tournament_id = id` かつ `pair_id is not null` の entry を取得 → その `pair_id` で `tournament_pairs` を取得。チーム名は `tournament_entries.team_id` → teams で取得。 |

---

## 2. ドキュメント・型のずれ

| 対象 | 問題 | 推奨対応 |
|------|------|----------|
| **`docs/schema.md`** | 旧スキーマのまま。`teams.tournament_id`, `tournament_entries.entry_type='pair'`, `affiliation_key`, `tournament_players.tournament_id/team_id`, `tournament_pairs.tournament_id/team_id`, `tournament_teams` が記載されている。 | 023 適用後のスキーマに合わせて更新するか、ファイル冒頭に「023 以前の参考用。実スキーマは migrations を参照」と明記。 |
| **`src/types/database.types.ts`** | 他テーブルで `user_permissions.tournament_id/team_id` 等は正しい。`tournament_players` / `tournament_pairs` / `tournament_entries` は既に更新済みの想定。 | 上記 API 修正時に、参照している型が database.types と一致しているか確認。 |

---

## 3. ロジック上の注意点（要確認・改善）

| ファイル | 内容 | 推奨対応 |
|----------|------|----------|
| **`api/scoring/matches/[matchId]/finish/finishMatch.ts`** | 敗者エントリーを `tournament_entries` から `team_id = loserPair.teams?.id` かつ `tournament_id` かつ `is_checked_in = true` で `.single()` 取得。同一チームで複数エントリーがあると `.single()` が複数行でエラーになる。 | 敗者「チーム」の代表エントリーが 1 つとは限らないため、`.maybeSingle()` または `.limit(1)` に変更し、0 件の場合は審判委譲をスキップする。 |
| **`api/tournaments/[id]/draw/generate/generateDraw.ts`** | エントリーを取得して試合数・ラウンド数を決め、空の matches を作成している。**match_slots に entry_id を割り当てる処理がこのファイルには含まれていない**。 | ドロー「枠」にエントリーを割り当てるのは別 API（例: slots 更新や別ステップ）か確認。含まれていなければ、初回ドロー生成時に slot と entry の対応をどう決めるか（手動／シード順など）を設計する。 |
| **`api/teams/getTeams.ts`** | `tournament_id` 指定時は `tournament_entries` から team_id を集めて teams を返す実装になっており、新スキーマと一致している。 | 特になし。 |
| **`api/tournaments/[id]/teams/getTournamentTeams.ts`** | 同様に `tournament_entries` 経由で team_id を取得しており、新スキーマと一致。 | 特になし。 |

---

## 4. テスト・モックのずれ

| ファイル | 内容 | 推奨対応 |
|----------|------|----------|
| **`api/teams/__tests__/createTeam.test.ts`** | 作成レスポンスに `tournament_id` を期待している。 | teams から tournament_id を削除したので、テストの期待値から `tournament_id` を削除する。 |
| その他 **matches / roles / tournaments の __tests__** | モックで `tournament_id` / `team_id` を使っているが、これらは **matches / user_permissions 等の他テーブル**用であり、023 で変更した teams / tournament_players / tournament_pairs とは別。 | 他テーブルのテストは現状のままでよい。teams / tournament_players / tournament_pairs を直接モックしているテストがあれば、entry_id / actual_team_id 等に合わせて修正。 |

---

## 5. 優先度まとめ

- **高（API が現状でエラーになる）**  
  - `createTeam.ts`（tournament_id 削除）  
  - `getTournamentPlayers.ts`（tournament_id 廃止に合わせた取得方法へ変更）  
  - `getTournamentPairs.ts`（tournament_id / team_id 廃止に合わせた取得方法へ変更）  
  - `getTeamPlayers.ts`（actual_team_id ベースの取得へ変更）  
  - `addTeamPlayer.ts` と `addTournamentPlayer.ts`（新スキーマに合わせた作成フローへ変更するか、役割を CSV/エントリーに集約）

- **中（挙動がおかしい・将来エラーになりうる）**  
  - `finishMatch.ts` の敗者エントリー取得（.single() → .maybeSingle() 等）  
  - `getTeam.ts` の tournament_players リレーション（actual_team_id 逆参照の確認）

- **低（ドキュメント・テストの整理）**  
  - `docs/schema.md` の更新  
  - `createTeam.test.ts` の期待値修正  

上記を順に修正すると、エントリー中心スキーマとアプリケーションの一貫性が取りやすくなります。

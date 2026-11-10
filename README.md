# Z (nextz)

Next.js 16 + React 19 + Tailwind v4 + shadcn/ui (base-ui) で作った、実際に動くSNSです。
DB は Postgres（Neon）、画像は Vercel Blob（ローカル開発時はディスク保存）で動きます。

## 機能

- **アカウント**: 新規登録 / ログイン / ログアウト / パスワード変更（scrypt ハッシュ + HttpOnly セッション Cookie）
- **ポスト**: 280文字、画像4枚まで（ペースト対応）、絵文字、返信、リポスト、引用、削除
- **リアクション**: いいね / ブックマーク（楽観的UI更新）
- **カスタム絵文字**: 画像を `:ショートコード:` で登録し、ポスト本文・リアクション・名前横のバッジに使える（詳細は下記）
- **ホーム**: 検索窓 / 機能一覧 / アクティブユーザー一覧（直近5分以内にアプリを開いた人）。スマホの下部ナビは4つ（ホーム・通知・メッセージ・プロフィール）で、そのほかは機能一覧から開く
- **タイムライン**（`/timeline`、ホームの機能一覧から開く）: おすすめ / フォロー中、無限スクロール、60秒ごとの自動更新
- **チャンネル**: Discord のように好きなことを語れるコミュニティ。ユーザーが作成・削除でき、チャンネルごとに独自のタイムラインを持つ（詳細は下記）
- **プロフィール**: ポスト・返信・メディア・いいね（本人のみ）、編集（名前・自己紹介・場所・URL・アイコン・ヘッダー）
- **フォロー**: フォロー/解除、フォロワー・フォロー中一覧、おすすめユーザー
- **通知**: いいね・リポスト・引用・返信・メンション・フォロー、未読バッジ、既読化
- **DM**: 1対1メッセージ、未読表示、4秒ポーリング、日本語IME対応
- **検索・トレンド**: キーワード / `#ハッシュタグ` / ユーザー検索、7日間のトレンド
- **開発者**: ボットアカウントの作成と API トークン管理（設定 → 開発者。詳細は下記）
- **利用規約・アカウント凍結**: サインアップ時に利用規約を最後まで読ませて同意を記録し、違反したアカウントは管理者が凍結（BAN）できる（詳細は下記）
- **その他**: `#タグ` `@メンション` URL の自動リンク、ダークモード、レスポンシブ（モバイル下部ナビ）

## カスタム絵文字

**設定 → カスタム絵文字** から、画像（PNG / GIF / WebP / JPEG、512KB 以下）とショートコード（英数字と `_`、2〜32文字）を登録します。
登録は誰でもでき、削除できるのは登録した本人だけです。

| 使い方 | 操作 |
| --- | --- |
| **ポスト本文で使う** | `:ショートコード:` と書く、または投稿フォームの 😊 ボタン →「カスタム絵文字」から選ぶ。未登録・削除済みのコードは文字のまま表示されます |
| **ポストにリアクション** | ポストの 😊+ ボタンから選ぶ。ポスト下のチップをクリックで付け外し。1人が1ポストに付けられるのは10種類まで。ポスト主に通知が届きます |
| **バッジにする** | **設定 → バッジ** で最大 5 個まで選ぶと、タイムライン・ポスト詳細・プロフィール・ユーザー一覧の名前の横に、選んだ順に表示されます |

絵文字を削除すると、その絵文字のリアクション・通知・バッジも一緒に消えます。

**アイコンデコレーション**: アイコンに重ねる**フレーム画像**です。**設定 → アイコンデコレーション** で、登録済みのフレームから選ぶか、自分で追加できます（誰でも追加可・削除は登録者のみ。削除すると使っている人のアイコンからも外れます）。画像は正方形の透過 PNG / GIF / WebP（1MB 以下）で、アイコンの 1.2 倍の大きさ（`lib/decorations.ts` の `DECORATION_SCALE`）で中央に重ねて表示します。既存のバッジ（1 個）は初回アクセス時に `user_badges` へ自動で移行されます。

API: `GET/POST /api/emojis`、`DELETE /api/emojis/:id`、`GET/POST /api/decorations`、`DELETE /api/decorations/:id`、`PUT/DELETE /api/posts/:id/reactions/:emojiId`、`PATCH /api/me`（`badgeEmojiIds`: 絵文字 ID の配列・最大 5 個・表示順 / `avatarDecorationId`: デコレーション ID または `null`。旧形式の `badgeEmojiId` も可）。
テーブル（`custom_emojis` / `post_reactions` / `user_badges` / `avatar_decorations` と、`users.avatar_decoration_id` / `notifications.emoji_id` 列）は、既存の DB にも初回アクセス時に自動で追加されます。

## チャンネル

ホーム → **チャンネル**（`/channels`）から使います。

| 操作 | 誰ができるか |
| --- | --- |
| チャンネルの閲覧・検索 | ログイン中の全員 |
| 作成（名前・説明・アイコン絵文字） | 誰でも。1人10個まで、作成者が**管理者**になり自動で参加する |
| 参加 / 退出 | 誰でも（管理者は退出不可。不要なら削除する） |
| 投稿（500文字・画像4枚まで） | メンバーのみ。チャンネルの投稿は全体のタイムラインには流れない |
| 投稿の削除 | 投稿した本人、またはチャンネルの管理者 |
| メンバーのキック | 管理者のみ。キックされた人は**再参加できない**。管理者がメンバー一覧の「キックしたユーザー」から解除できる |
| チャンネルの削除 | 管理者のみ。投稿・メンバー情報も一緒に消える |

API: `GET/POST /api/channels`、`GET/DELETE /api/channels/:id`、`GET/POST/DELETE /api/channels/:id/members`（一覧 / 参加 / 退出）、
`DELETE /api/channels/:id/members/:userId`（キック）、`DELETE /api/channels/:id/bans/:userId`（キック解除）、
`GET/POST /api/channels/:id/posts`、`DELETE /api/channels/:id/posts/:postId`、`GET /api/users/active`。
テーブル（`channels` / `channel_members` / `channel_bans` / `channel_posts` と `users.last_seen_at` 列）は、既存の DB にも初回アクセス時に自動で追加されます。

チャンネル内の投稿は `posts` テーブル（`channel_id` 列つき）に保存され、グローバルのポストと同じ仕組みで返信・リポスト・引用・いいね・リアクション・ブックマーク・通知が使えます。旧 `channel_posts` の既存データは初回アクセス時に自動で `posts` へ移行されます。

## 利用規約とアカウント凍結（BAN）

### 利用規約

- 本文は `lib/terms.ts`（`TERMS`）にあります。**内容を変えたら `TERMS_VERSION` も更新してください。**
- 新規登録では「利用規約を読んで同意する」を押すとダイアログが開き、**最後までスクロールしないと「同意する」を押せません**。同意しないと「アカウントを作成」は押せません。
- サーバー側（`POST /api/auth/signup`）でも `agreeTerms: true` と現在の `termsVersion` を必須にしているので、API を直接叩いても同意なしでは作成できません。
- 同意したバージョンと日時は `users.terms_version` / `users.terms_agreed_at` に保存されます（この機能より前に作られたアカウントは NULL）。
- `/terms` はログインしていなくても読めます。設定画面からもリンクしています。

### 管理者の指定

環境変数 `ADMIN_USERNAMES` にカンマ区切りでユーザー名を指定します（大文字小文字は区別しません）。

```
ADMIN_USERNAMES=alice,bob
```

ユーザー名は先着順で登録されるため、**管理者にするアカウントは公開前に自分で作成しておいてください**。ボットのトークンでは管理者の操作はできません。

### 凍結（BAN）の仕組み

| 操作 | 場所 |
| --- | --- |
| 凍結（理由は必須・500文字まで） | `/admin`（サイドバーのメニュー / ホームの機能一覧）、または相手のプロフィールの「凍結」ボタン |
| 凍結の解除 | 同上（「解除」「凍結を解除」） |
| 凍結中のユーザーの確認 | `/admin` の「凍結中」タブ。理由・凍結した管理者・日時が見られます |

凍結すると次のようになります。

- そのユーザーの**全セッションが即座に無効**になり、ログインできません（ログイン時に、パスワードが合っていた本人にだけ凍結の理由が表示されます）。
- そのユーザーが所有する**ボットの API トークンも無効**になります。ボット自身を凍結した場合も同様です。
- おすすめユーザー・アクティブユーザー・ユーザー検索に表示されなくなります。プロフィールには「凍結されています」と出ます。過去の投稿は残ります。
- 解除すれば、パスワード・ボットのトークンはそのまま使えるようになります。
- 管理者は、自分自身と他の管理者を凍結できません。

凍結・解除の履歴（誰が・いつ・なぜ）は `moderation_logs` テーブルに残ります。

API（管理者のみ・それ以外は 403）: `GET /api/admin/users`（`?q=` 検索、`?filter=banned`）、`POST /api/admin/users/:username/ban`（`{ "reason": "…" }`）、`DELETE /api/admin/users/:username/ban`（解除）。
テーブル・列（`users.terms_version` / `terms_agreed_at` / `banned_at` / `ban_reason` / `banned_by` と `moderation_logs`）は、既存の DB にも初回アクセス時に自動で追加されます。

## 開発者（ボット API）

**設定 → 開発者** から、ボット用のアカウントと API トークンを作成できます（1人5個まで）。

- ボットは名前の横に **BOT** バッジが付く専用アカウントです。パスワードは無く、API トークンでのみ操作できます。
- トークン（`nzb_…`）は**作成・再発行したときの一度しか表示されません**。DB には SHA-256 ハッシュしか保存しません。
- 再発行すると古いトークンはすぐ無効になります。ボットを削除すると、そのボットの投稿・フォロー・DM なども一緒に消えます。
- 既存の API がそのままボットから使えます。リクエストに `Authorization: Bearer <トークン>` を付けるだけです（Cookie 不要）。
- トークンが付いているのに無効な場合は 401 になります（Cookie にはフォールバックしません）。
- 1 ボットあたり 1 分間に 120 リクエストまで（超えると 429）。
- パスワード変更・ボットの作成/削除/トークン再発行など、アカウント自体に関わる API はボットからは呼べません（403）。

```bash
curl -X POST https://your-site.example/api/posts \
  -H "Authorization: Bearer nzb_xxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"content":"Hello from my bot!"}'
```

| メソッド | パス | 内容 |
| --- | --- | --- |
| GET / PATCH | `/api/me` | ボット自身の情報 / プロフィール更新 |
| GET / POST | `/api/posts` | タイムライン取得 / 投稿（`content`, `images`, `parentId`, `quoteOf`） |
| DELETE | `/api/posts/:id` | ポスト削除 |
| POST / DELETE | `/api/posts/:id/(like\|repost\|bookmark)` | いいね・リポスト・ブックマーク |
| PUT / DELETE | `/api/posts/:id/reactions/:emojiId` | 絵文字リアクション |
| GET | `/api/notifications` | 通知（メンション・返信など。ボットを動かすときのポーリング用） |
| POST / DELETE | `/api/users/:username/follow` | フォロー / 解除 |
| POST | `/api/dm`、`/api/dm/:id` | DM スレッド取得・作成 / メッセージ送信 |
| POST | `/api/channels/:id/posts` | チャンネルへ投稿（メンバーのみ） |
| POST | `/api/upload` | 画像アップロード（multipart の `file`）→ `url` |

ボット管理 API（人間のアカウントのみ）: `GET/POST /api/bots`、`PATCH/DELETE /api/bots/:id`、`POST /api/bots/:id/token`（再発行）。
テーブル `bots` は、既存の DB にも初回アクセス時に自動で追加されます。

## 起動（ローカル）

```bash
cp .env.example .env.local     # DATABASE_URL を設定（Neon の dev ブランチ、またはローカルの Postgres）
npm install
npm run dev                    # http://localhost:3000
```

最初に「新規登録」でアカウントを作成してください。テーブルは初回アクセス時に自動作成されます。
`BLOB_READ_WRITE_TOKEN` を未設定のままにすると、画像は `./data/uploads` に保存されます。

```bash
npm run build && npm start     # 本番ビルド
```

## Vercel にデプロイする

Vercel のサーバーレス関数はファイルが永続化されないため、DB は Neon、画像は Vercel Blob に置きます。

1. GitHub に push → Vercel で **Import**（Framework は Next.js が自動検出されます）
2. Vercel プロジェクトの **Storage** タブで
   - **Neon (Postgres)** を作成して接続 → `DATABASE_URL` が自動で設定されます
   - **Blob** ストアを作成して接続 → `BLOB_READ_WRITE_TOKEN` が自動で設定されます
3. **Deploy**（環境変数を追加した後は再デプロイが必要です）

`vercel.json` で関数のリージョンを東京 (`hnd1`) にしています。Neon のリージョンは Vercel 連携の作成時に選べるので、
できるだけ近い場所（東京 / シンガポールなど）を選ぶと速くなります。

| 環境変数 | 用途 | 未設定時 |
| --- | --- | --- |
| `DATABASE_URL`（または `POSTGRES_URL`） | Neon の接続文字列（Pooled 推奨） | 起動エラー |
| `BLOB_READ_WRITE_TOKEN` | 画像ストレージ | `./data/uploads`（ローカル保存。Vercel では動かない） |
| `DATA_DIR` | ローカル画像の保存先（開発用） | `./data` |

> 画像のアップロード上限は 4MB です（Vercel 関数のリクエストボディ上限 4.5MB のため）。

## 構成

```
app/api/**        Route Handlers（認証・投稿・フォロー・通知・DM・検索・アップロード）
app/**/page.tsx   各画面（クライアントで React Query によりデータ取得）
lib/db.ts         Postgres 接続とスキーマ（初回アクセス時に自動作成）
lib/posts.ts      タイムライン / 検索 / 投稿ロジック
lib/auth.ts       パスワードハッシュとセッション
hooks/            React Query フック
components/       UI コンポーネント
```

## セキュリティ

- パスワードは scrypt + ソルト、セッショントークンは DB に SHA-256 ハッシュで保存
- Cookie は HttpOnly / SameSite=Lax、変更系 API は Origin 検証あり
- ログイン・登録・投稿・アップロード等にレート制限（DB ベースなのでサーバーレスでも有効）
- 画像は拡張子ではなくマジックナンバーで検証（SVG は不許可）、配信時に CSP sandbox 付与
- 本文は HTML として挿入せず React で描画（XSS 対策）

## 既知の制限

- メール認証・パスワードリセットなし（ユーザー名 + パスワードのみ）
- ブロック / ミュート / 通報 / 管理画面なし（チャンネルの管理者機能を除く）
- チャンネルは公開のみ（招待制・非公開は未対応）。チャンネルの投稿は 10 秒ごとのポーリング更新
- カスタム絵文字は DM・表示名・自己紹介では使えません（ポスト本文・リアクション・バッジのみ）
- DM はポーリング方式（リアルタイムが必要なら SSE / WebSocket に置き換え）
- 「おすすめ」は新着順（ランキングなし）

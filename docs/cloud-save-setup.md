# Cloudflare D1クラウドセーブ設定

## 結論

Cloudflare PagesプロジェクトへD1を`GAME_DB`名でバインドし、`migrations/0001_cloud_saves.sql`を適用すると、ゲーム内のID・パスワード式クラウド保存が有効になります。

## 設定手順

1. Cloudflare DashboardでD1データベースを作成する。
2. D1コンソールまたはWranglerで`migrations/0001_cloud_saves.sql`を実行する。
3. Pagesプロジェクトの「Settings > Bindings > D1 database bindings」を開く。
4. Variable nameを`GAME_DB`にし、作成したD1を選択する。
5. ProductionとPreviewの両環境へ同じバインディングを設定する。
6. Pagesを再デプロイする。

Wrangler CLIを使う場合の例です。

```bash
npx wrangler d1 create football-director-saves
npx wrangler d1 execute football-director-saves --remote --file=migrations/0001_cloud_saves.sql
```

## セキュリティ仕様

| 項目 | 仕様 |
|---|---|
| ID | 英数字・`_`・`-`、3～32文字、小文字へ正規化 |
| パスワード | 8文字以上、PBKDF2-SHA-256、120,000回 |
| セッション | ランダム32バイト、DBにはSHA-256ダイジェストのみ保存 |
| Cookie | HttpOnly、Secure、SameSite=Lax、30日 |
| ロック | 5回連続失敗で15分 |
| 保存枠 | 1アカウント1枠、上書き保存 |
| サイズ | UTF-8で4 MiB以下 |

## 動作確認

1. ゲームを開始する。
2. サイドバーまたはスマホメニューから「クラウドへ保存」を開く。
3. 初回は「新規登録して保存」を実行する。
4. 別ブラウザまたはシークレットウィンドウで「クラウドから読み込む」を実行する。
5. シーズン、週、クラブ、監督記録が一致することを確認する。

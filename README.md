# Football Director

ブラウザだけで遊べる、架空クラブを題材にしたサッカー監督・クラブ経営シミュレーションです。

戦術、先発編成、トレーニング、移籍、ユース育成、財務、施設投資、取締役会イベントを管理し、8クラブによるホーム＆アウェー方式のリーグを複数シーズン戦えます。

## 主な機能

| 分野 | 実装内容 |
|---|---|
| リーグ | 8クラブ、14節、全56試合、順位表、得失点差、フォーム |
| 試合 | シード固定型シミュレーション、xG、保持率、シュート、カード、負傷、自動交代、実況、選手評価、MOM |
| 戦術 | 5フォーメーション、メンタリティ、テンポ、パス、幅、プレス、守備ライン、攻撃重点、戦術理解度 |
| 選手管理 | 先発11人、控え7人、自動編成、主将、PK担当、負傷、出場停止、疲労、士気、フォーム |
| 育成 | 6種類の週間トレーニング、能力成長、回復、ユース昇格、4週ごとのユース新加入 |
| 移籍 | スカウト、能力幅表示、獲得、売却候補、売却交渉、契約解除、移籍金・給与予算チェック |
| 経営 | 現金、移籍予算、給与予算、入場料、スポンサー、賞金、財務台帳、4種類の施設強化 |
| イベント | 選手、医療、メディア、スポンサー、育成に関する選択式イベント |
| キャリア | シーズン表彰、次シーズン開始、年齢更新、シーズン履歴 |
| 保存 | localStorage自動保存、JSONエクスポート・インポート、リセット |
| UI | PCサイドバー、スマホ横スクロールメニュー、ダークスポーツUI、試合実況モーダル |

## 必要環境

- Node.js 22以上
- Chrome、Edge、Firefox、Safariの現行版

外部API、外部画像、データベース、ビルドツールは不要です。

## 起動方法

```bash
npm run dev
```

ブラウザで次を開きます。

```text
http://127.0.0.1:4173
```

ポートを変更する場合:

```bash
PORT=8080 npm run dev
```

Windows PowerShellの場合:

```powershell
$env:PORT=8080
npm run dev
```

## 検証コマンド

```bash
npm test
npm run check
npm run smoke
npm run verify
```

| コマンド | 内容 |
|---|---|
| `npm test` | ゲームロジック・UIレンダリング・統合テスト |
| `npm run check` | JavaScript構文、相対import、HTML必須要素、未完了表記を検査 |
| `npm run smoke` | ローカルサーバーを起動し、主要5ルートをHTTP確認 |
| `npm run verify` | 上記3種類をまとめて実行 |

## ディレクトリ構成

```text
football-director-sim/
├─ assets/                 # ファビコン
├─ docs/                   # 設計書、実装計画、レビュー、テスト報告
├─ scripts/                # 開発サーバー、品質検査、HTTPスモークテスト
├─ src/
│  ├─ core/                # 乱数、汎用関数
│  ├─ data/                # 架空クラブ、選手生成、戦術定義
│  ├─ game/                # 試合、日程、財務、育成、移籍、イベント、保存
│  └─ ui/                  # HTML生成、操作制御、画面スタイル
├─ tests/                  # Node.js標準テスト
├─ index.html
└─ package.json
```

## 設計上のポイント

- ゲームルールをDOMから分離し、同一シード・同一操作で同一結果を再現します。
- 状態変更は原則として複製後に行い、失敗時は元のゲーム状態を返します。
- 実在クラブ、実在選手、ライセンス画像を使わず、すべて架空データで構成しています。
- バックエンドなしで動作しますが、`src/game`は将来API化しやすい分割です。

## Gitへ登録する場合

```bash
git init
git add .
git commit -m "feat: add football director simulation"
```

GitHubへ新規登録する場合は、リポジトリ作成後に表示されるremote URLを使用してください。

```bash
git branch -M main
git remote add origin <YOUR_REPOSITORY_URL>
git push -u origin main
```

## 現バージョンの対象外

- 実在クラブ・選手・リーグ
- オンライン対戦、ログイン、クラウドセーブ
- 3Dまたは2Dのリアルタイム選手移動描画
- 複数部制、昇格・降格、カップ戦
- サーバー側の不正防止や共有ランキング

これらを追加する場合も、ゲームロジックとUIが分離されているため段階的に拡張できます。

## Cloudflare Pages 公開設定

GitHub連携で公開する場合は、Cloudflare Pages側で次を指定します。

| 設定 | 値 |
|---|---|
| Production branch | `main` |
| Framework preset | `None` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `/` |
| Node.js | `.node-version`により`22.16.0` |

ローカルで公開対象だけを生成する場合:

```bash
npm run build
```

生成物は`dist/`に出力され、ソーステストや設計書は公開対象に含まれません。

Wranglerで直接公開する場合:

```bash
npx wrangler login
npm run deploy
```

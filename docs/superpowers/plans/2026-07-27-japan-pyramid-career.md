# 日本3部制・長期キャリア Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 60クラブの日本3部制、全国杯、長期選手人生、財務再設計、記録、秘書、スカッドUI改善を実装する。

**Architecture:** 競技日程を`competitions.js`、選手人生と受賞を`career.js`、秘書集約を`secretary.js`へ分離する。ゲームエンジンは各モジュールを週進行とシーズン更新で統合し、UIは新しい状態を読み取り専用で表示する。

**Tech Stack:** Browser-native ES modules, Node.js built-in test runner, HTML/CSS, Cloudflare Pages static build.

## Global Constraints

- 実在クラブ名・選手名・大会名を使用しない。
- クラブ名と選手名は日本語表記にする。
- 各部20クラブ、合計60クラブとする。
- オリジナルクラブは3部から開始する。
- 旧セーブ互換は実装しない。
- ランタイム依存パッケージを追加しない。

---

### Task 1: 日本語60クラブと新規クラブ開始

**Files:** `src/data/catalog.js`, `src/data/japan-pyramid.js`, `tests/pyramid.test.js`, `src/ui/render.js`, `src/ui/controller.js`

- [ ] 60クラブ、各部20、全選手名日本語の失敗テストを追加する。
- [ ] オリジナルクラブが3部の1枠を置換する失敗テストを追加する。
- [ ] 日本語クラブテンプレートと選手名生成を実装する。
- [ ] 新規開始フォームの既存／オリジナル選択を実装する。
- [ ] 対象テストを成功させる。

### Task 2: 競技日程・全国杯・昇降格

**Files:** `src/game/competitions.js`, `src/game/fixtures.js`, `src/game/game-engine.js`, `tests/competitions.test.js`, `tests/game-engine.test.js`

- [ ] 38節、44週、6ラウンド全国杯の失敗テストを追加する。
- [ ] 3部門の日程と動的カップ組合せを実装する。
- [ ] 週進行でリーグまたはカップを処理する。
- [ ] 上位3・下位3の昇降格を実装する。
- [ ] 対象テストを成功させる。

### Task 3: 選手人生・AI競争力・契約

**Files:** `src/game/career.js`, `src/game/game-engine.js`, `src/game/transfers.js`, `tests/career.test.js`

- [ ] 加齢、衰え、引退、不満、移籍希望の失敗テストを追加する。
- [ ] シーズン成績の履歴化と通算成績を実装する。
- [ ] AIクラブのシーズン間育成・補強を実装する。
- [ ] 契約更新アクションを実装する。
- [ ] 対象テストを成功させる。

### Task 4: 財務再設計と継続投資

**Files:** `src/game/economy.js`, `src/game/game-engine.js`, `tests/management.test.js`

- [ ] 現金から移籍予算への配分テストを追加する。
- [ ] 理事会予備資金、売却益還元率、シーズン予算再査定を実装する。
- [ ] 最大施設後の5種類の継続投資と維持費を実装する。
- [ ] 対象テストを成功させる。

### Task 5: 個人成績・タイトル・秘書

**Files:** `src/game/career.js`, `src/game/secretary.js`, `src/ui/render.js`, `tests/career.test.js`, `tests/ui.test.js`

- [ ] 通算成績とシーズン受賞の失敗テストを追加する。
- [ ] 記録画面と秘書週間レポートを実装する。
- [ ] ナビゲーションへ記録と秘書を追加する。
- [ ] 対象テストを成功させる。

### Task 6: スカッドstickyと即時フォーメーション変更

**Files:** `src/ui/render.js`, `src/ui/controller.js`, `src/styles.css`, `tests/ui.test.js`

- [ ] stickyクラスと即時フォーメーション選択の失敗テストを追加する。
- [ ] PC sticky、モバイル上部選択、変更イベントを実装する。
- [ ] 対象テストを成功させる。

### Task 7: 検証と配布

**Files:** `README.md`, all tests and source

- [ ] `npm test`を実行する。
- [ ] `npm run check`を実行する。
- [ ] `npm run smoke`を実行する。
- [ ] `npm run build`を実行する。
- [ ] 差分レビュー後、GitHub PRを作成してmainへマージする。

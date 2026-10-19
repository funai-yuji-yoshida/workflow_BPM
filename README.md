# AI業務分解ナビ（Web版）

講座参加者が業務を工程に分解し、担当者別の業務フロー図（As-Is／To-Be）と改善候補・効果試算を整理するツール。
GAS版（`../Code.gs` `../Index.html`）を社外と共有するための静的Webアプリ版。

- 状態：v1.1 初版
- リポジトリ：https://github.com/funai-yuji-yoshida/workflow_BPM
- 公開URL：https://funai-yuji-yoshida.github.io/workflow_BPM/
- 仕様：`../設計書.md`、表記ルール：`../フロー図表記ルール・データ追加案.md`
- 構成：Vite + React + TypeScript。**サーバー・データベースなし**
- 公開先：GitHub Pages（`.github/workflows/deploy.yml` で main への push 時に自動ビルド・公開）
- 認証情報：なし（APIキー等は使っていない）

## データの扱い

- 入力内容は利用者のブラウザ（localStorage）にのみ保存し、外部へ送信しない
- 端末をまたぐ・講師へ提出する場合は「ファイルに保存（JSON）」→「ファイルを開く」（複数選択可）
- 講師は受講者のJSONをまとめて読み込むと「この端末に保存されている業務」で一覧できる
- 画面とフッターで、実在顧客の個人情報・機密情報を入力しないよう案内している

## 開発

```bash
npm install
npm run dev      # 開発サーバー
npm test         # 単体テスト（フロー解析・判定・試算・ファイル読込）
npm run build    # dist/ に出力（相対パスなのでどのサブパスでも動く）
```

## 構成

| パス | 内容 |
|---|---|
| `src/flow/engine.ts` | フロー図の描画エンジン（自前SVG。GAS版・プロトタイプと同じ表記ルール） |
| `src/domain/analysis.ts` | 改善方式のルール判定・To-Be・効果試算（GAS版と同じルールと仮定短縮率） |
| `src/domain/storage.ts` | ブラウザ保存・JSON書き出し／読み込み（不正値の補正） |
| `src/components/` | 画面（フロー図、工程表、集計・試算・To-Be） |
| `public/guide.html` | 使い方ページ（受講者・講師向け）。アプリ右上「使い方」から開く |
| `scripts/guide-svg.ts` | 使い方ページの図を再生成：`npx vite-node scripts/guide-svg.ts`（描画を変えたら実行） |

## GitHub Pages 公開手順

1. GitHub に新しいリポジトリを作る（無料プランでは Pages を使うためにリポジトリを公開にする必要がある。ソースに秘密情報は含まない）
2. この `web/` フォルダをリポジトリのルートとして push（ブランチ `main`）
3. リポジトリの Settings → Pages → Source を「GitHub Actions」にする
4. Actions の完了後、`https://<アカウント>.github.io/<リポジトリ名>/` で公開される

# baseline — 夜じたて UT run 2026-09-03-n4v8

開始前の状態。**推測で埋めた値はない**（取れなかったものは「未取得」と書く）。

## 実施環境

| | |
|---|---|
| origin | `http://127.0.0.1:<自動割当ポート>`（このリポジトリを `Content-Type: text/html; charset=utf-8` 付きで配信） |
| 本番 origin | `https://hirohgxx.github.io/yo-jitate/` — **触れない** |
| 配信物 | `index.html`（1バイトも改変せず読み込んだのみ。作業ツリーは着手前から `docs/ut/` と `ut.config.yaml` の新規追加のみ・`git status --short` で確認） |
| ブランチ / 直近コミット | `main` / `9d82fe0`（第6便その2） |

## 直前に確認した既存の機械検査

`NODE_PATH=../shikifuda-kasane/node_modules node scripts/check-layout.js` を UT 着手前に単独実行し、
**150項目すべて通った**（`通った。` / exit 0）。額の実寸（393×740で263.0px幅・SEで237.3px幅・393×852で263.0px幅）
も第6便その2の実測どおり。このファイル自体は書き換えていない（読んで実行しただけ）。
この run はこの検査が担保している受入項目を重複して見ない。見るのは「初見の理解・迷い・回復」。

## localStorage（UT origin・開始時点）

| キー | 中身 |
|---|---|
| `yo-jitate.pick` | 未設定（新しい browser context で開くため、開始時点で必ず空） |

`yo-jitate.pick` が空の状態が「初見」を意味する（御霊・深さとも既定＝コード上の先頭が選ばれる）。

## localStorage（本番 origin）

**未取得・未変更**（本番では実施しないため触れていない）。

## テストデータ

`ut.config.yaml` の `test_data.enabled: false`。理由は、このアプリが作るデータが localStorage の
1キー（`yo-jitate.pick`）だけで、UT はそれが空のローカル origin で行うため。接頭辞を付ける対象が存在しない。
片付けは「配信サーバー（browser context ごと）を閉じる」で済む。

## 未取得

- なし（上の項目はすべて実測・実行結果に基づく）

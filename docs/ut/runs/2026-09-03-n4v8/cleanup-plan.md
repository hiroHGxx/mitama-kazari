# 後片付け（dry-run と結果） — 夜じたて UT run 2026-09-03-n4v8

**dry-run（実行前に記録）。**オーナーの明示承認を要する操作は無い——このrunが作ったのは
ヘッドレスChromeの一時プロファイル内のlocalStorageと、配信用の一時サーバーだけで、
どちらもスクリプトの終了時に自動で消える。

## 対象一覧

| 対象 | 種類 | 場所 | 操作 | 復元可否 |
|---|---|---|---|---|
| `yo-jitate.pick` | localStorage | `http://127.0.0.1:<自動割当ポート>`（UT専用の各 browser context） | 作成・上書き | browser context を閉じた時点で消滅 |
| 配信用の一時HTTPサーバー（Node.js） | 実行中プロセス | ローカル | 起動→スクリプト終了時に自動停止 | 再起動可（再実行すれば同じ状態から始まる） |
| headless Chrome の一時プロファイル | 一時ファイル | OSの一時ディレクトリ | スクリプト終了時に自動破棄 | — |

## 触らなかったもの

- **本番 origin（`https://hirohgxx.github.io/yo-jitate/`）**: 一度も開いていない。オーナーの本物の控え
  （選んだ御霊・深さ）には触れていない。
- **リポジトリのファイル**: `index.html`・`scripts/`・`docs/SPEC.md`・`docs/DEVELOPMENT.md`・`README.md`・
  `docs/SHORTCUT.md` は1バイトも変更していない（読んで実行しただけ）。追加したのは `ut.config.yaml` と
  `docs/ut/` 配下のみ（このUTの成果物そのもの）。
- **わいわいタウン・外部サービスへの送信**: 無い（このアプリ自体が外部へ送信する経路を持たない。
  取りにいくのは素材蔵の画像とフォントのみ）。

## 実行順序

1. （実行済み）各観察スクリプトの `finally` ブロックで `browser.close()` → 配信サーバー `server.close()` を実施。
2. 追加の手作業は無い。

## baseline との比較

`baseline.md` に控えた開始前の状態（UT origin の `yo-jitate.pick` は未設定・本番origin未取得）と比較して、
UT origin 側は実行中に何度も書き換わったが、**すべて使い捨ての browser context の中**であり、
スクリプト終了と同時に消えている。本番 origin の状態は開始前から一度も変わっていない（一度も開いていない）。

## 残す成果物（片付けの対象ではない）

```
docs/ut/runs/2026-09-03-n4v8/
├── session.json
├── results.jsonl              13行
├── baseline.md
├── cleanup-plan.md            （このファイル）
├── UT結果ログ_2026-09-03.md
├── obs-all.json                観察の生データ（本実行）
├── obs-b4-recheck.json         B-4の追試（境界の切り分け）
├── obs-b7-recheck.json         B-7の追試（独立コンテキストでの計測）
└── screenshots/                19枚
```

## 承認欄

対象データが無い（本番・実データへの影響が一切無い）ため、承認は不要と判断した。
片付け自体は実行済み（browser context・サーバーとも既に閉じている）。

**cleanup_status: completed**

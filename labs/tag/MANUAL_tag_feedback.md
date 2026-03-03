# tag_feedback.py マニュアル

## 概要
タグ再付与の人手修正（追加・除外）を `outputs/feedback/corrections.jsonl` に記録します。次回以降の `tag_analyze.py` / `tag_assign.py` 実行時に反映されます。

## 使い方
### 修正を追加
```bash
python labs/tag/tag_feedback.py correct --article-id 12345 --remove タグa --add タグb
```

### 修正ログを確認
```bash
python labs/tag/tag_feedback.py list --article-id 12345
```

## サブコマンド
- `correct`
  - `--article-id <ID>`: 対象記事
  - `--add <タグ>`: 追加したいタグ（複数指定可）
  - `--remove <タグ>`: 外したいタグ（複数指定可）
  - `--note <文字列>`: 任意メモ
- `list`
  - `--article-id <ID>`: 指定時のみ絞り込み表示

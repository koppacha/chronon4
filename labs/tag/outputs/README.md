# outputs

- `tag_related_cloud.json`: タグ関連度の本出力（将来 `src/data` へコピー想定）
- `tag_clusters.json`: タグクラスタ出力
- `assigned_tags.jsonl`: 記事ごとの再付与タグ（`/blog` には未反映）
- `metadata/tag_attributes.json`: 外部知識メタデータ（platforms / series など）
- `metadata/needs_review.json`: 解析結果から見た入力不足候補
- `feedback/corrections.jsonl`: 人手修正ログ
- `cache/`, `debug/`, `reports/`: 中間・検証用出力（通常は Git 管理しない）

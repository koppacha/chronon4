# tag_assign.py マニュアル

## 概要
記事本文を解析して、既存タグ候補と新規キーワード候補を同一スコア系で評価し、`outputs/assigned_tags.jsonl` に保存します。現時点では `/blog` 本文を書き換えません。

## 使い方
```bash
python labs/tag/tag_assign.py --article-id 12345
```

## 主な引数
- `--article-id <ID>`: 対象記事ID（指定時は1件だけ実行）
- `--top-k <数値>`: 最終採用するタグ件数（既存+新規の統合上位）
- `--max-new-tags <数値>`: 新規タグとして採用する最大件数
- `--min-neighbor-score <数値>`: 類似記事として採用する最小類似度
- `--min-new-tag-score <数値>`: 新規キーワードをタグ採用する最小スコア（0〜1）
- `--dry-run`: `assigned_tags.jsonl` を更新せず、レポートのみ出力
- `--blog-dir <path>` / `--output-dir <path>`: 通常は変更不要
- `--tokenizer <auto|mecab|janome|regex>`: 単語分割エンジン（既定は `auto`）

## スコアリング仕様（初期版）
### 既存タグ
- `semantic_fit`: 対象記事ベクトルとタグプロファイルの意味類似
- `neighbor_vote`: 類似記事が持つタグの重み付き投票
- `tag_cloud_hint`: `tag_related_cloud.json` の関連タグ補正
- `rarity_adjust`: 出現頻度の高すぎるタグを抑える補正

合成:
- `0.50*semantic_fit + 0.30*neighbor_vote + 0.15*tag_cloud_hint + 0.05*rarity_adjust`

### 新規タグ（既存タグに存在しないキーワード）
- `keyword_salience`: 対象記事内でのキーワード重要度（TF系）
- `specificity`: コーパス内での特異性（IDF）
- `neighbor_support`: 類似記事群でも同語が出現する度合い

合成:
- `0.55*keyword_salience + 0.30*specificity + 0.15*neighbor_support`
- しきい値 `--min-new-tag-score` 以上のみ採用対象

## 出力ファイル
- `labs/tag/outputs/assigned_tags.jsonl`
  - `tags`: 最終採用タグ一覧
  - `tag_details`: 各タグの `score` / `is_new_tag` / `candidate_type`
- `labs/tag/outputs/reports/tag_assign_*.json`
  - 既存候補・新規候補・近傍記事・各種スコア内訳

## 補足
- `tag_analyze.py` 実行時は、この `assigned_tags.jsonl` のタグも既存タグとして扱います。
- `outputs/feedback/corrections.jsonl` の人手修正は再付与時に加点/減点として反映されます。


## 新規タグ品質
- 新規タグ候補は名詞優先ルールで抽出します。
- 接続語・文末語（例: 「つまり」「だからこそ」「番でした」）は除外対象です。


## 形態素解析の導入
- MeCab系を使う場合は `pip install -r labs/tag/requirements-tag.txt` を実行してください。
- `--tokenizer mecab` 指定時は `mecab-ipadic-neologd` を必須利用します（未導入ならエラー終了）。
- 辞書パスが自動検出できない場合は `MECAB_NEOLOGD_DICDIR` に辞書ディレクトリを設定してください。
- `--tokenizer auto` は `mecab-ipadic-neologd` が使えるときのみ MeCab を選択し、使えなければ Janome/regex にフォールバックします。


## metadata ディレクトリ
`labs/tag/metadata/` はタグ品質管理の設定・学習データを置く場所です。

- `token_quality_rules.json`
  - 新規タグ候補フィルタの設定
  - 既存の人力タグには除外ルールを適用しない (`manual_tag_exempt`)
- `token_abstractness_labels.jsonl`
  - 抽象名詞判定の一次ソース兼、学習教師データ
  - `label=1` は抽象語として直接除外判定に使われます
- `token_abstractness_model.pkl`
  - 学習済みモデル（任意）。存在しない場合はヒューリスティックのみで判定
- `token_abstractness_observations.jsonl`
  - 自動判定の集計ログ（同一tokenを1行に集約）
- `tag_attributes.json`
  - 既存タグ属性（`tag_analyze.py` 側で使用）
- `needs_review.json`
  - タグ属性未整備の候補（`tag_analyze.py` 出力）

### 抽象名詞判定の反映方式
- `token_abstractness_labels.jsonl` は手動確定ラベルの一次ソースです。
- `source` を `manual|human|seed`（または `manual: true`）にした行のみが即時判定に使われます。
- 自動判定結果は `token_abstractness_observations.jsonl` に集約されます。
- 同一tokenは1行に集約され、`a/c/u/n`（抽象票/具体票/不確実票/観測回数）が更新されます。
- `--dry-run`、単独記事実行、単独タグ実行でも observations は更新されます。

### 自動観測の容量制御
`token_quality_rules.json` の `auto_observation` で制御できます。

- `max_entries`: 自動観測の最大件数
- `min_confidence`: 低信頼判定の保存抑制

補足:
- 上限超過時は観測回数と累積信頼度の高い語を優先保持します。

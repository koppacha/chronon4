# tag_analyze.py マニュアル

## 概要
既存タグ + `outputs/assigned_tags.jsonl` + `outputs/feedback/corrections.jsonl` を統合し、タグ同士の関連度とタグクラスタを生成します。

## 使い方
```bash
python labs/tag/tag_analyze.py
```

## 主な引数
- `--tag <タグ名>`: 指定タグ1件だけを解析（テスト用）。結果は `outputs/debug/` に出力
- `--top-n <数値>`: 各タグについて出力する関連タグ件数（デフォルト: `20`）
- `--single-tag-candidate-limit <数値>`: `--tag` 実行時に比較するタグの上限（デフォルト: `180`）
- `--single-tag-max-articles <数値>`: `--tag` 実行時に本文解析する記事数上限（デフォルト: `1800`）
- `--write-full`: `--tag` 指定時でも `tag_related_cloud.json` 等の本出力を更新する
- `--blog-dir <path>`: ブログ本文ディレクトリ（通常は変更不要）
- `--output-dir <path>`: 出力先（通常は変更不要）
- `--tokenizer <auto|mecab|janome|regex>`: 単語分割エンジン（既定は `auto`）

## 出力ファイル
- `labs/tag/outputs/tag_related_cloud.json`
- `labs/tag/outputs/tag_clusters.json`
- `labs/tag/metadata/needs_review.json`
- `labs/tag/outputs/debug/tag_analysis_*.json`（単発テスト時）

## スコアリング
### top_terms
- 各タグについて `最大24件` を出力
- 本文が短い場合は24件未満
- 名詞優先のトークン抽出ルールを適用（接続語・文末語は除外）

### related
- `token`（本文意味類似）
- `cooccurrence`（タグ共起）
- `attribute`（外部属性）
- `top_terms_overlap`（top_terms の重なり）
- 関連タグ選出では、対象タグ以外のタグの `top_terms` も必ず参照してスコア化します。

## 補足
- 実運用では `tag_related_cloud.json` を `src/data` へコピーして API から読み込む想定です。


## 形態素解析の導入
- MeCab系を使う場合は `pip install -r labs/tag/requirements-tag.txt` を実行してください。
- `--tokenizer mecab` 指定時は `mecab-ipadic-neologd` を必須利用します（未導入ならエラー終了）。
- 辞書パスが自動検出できない場合は `MECAB_NEOLOGD_DICDIR` に辞書ディレクトリを設定してください。
- `--tokenizer auto` は `mecab-ipadic-neologd` が使えるときのみ MeCab を選択し、使えなければ Janome/regex にフォールバックします。


## `--tag` 高速経路
- `--tag` かつ `--write-full` なしの場合は高速経路を使用します。
- 全タグ・全記事を無条件に解析せず、候補タグと対象記事を上限付きで絞り込みます。
- デバッグ出力の `fast_path` に実際の絞り込み件数を記録します。


## metadata ディレクトリ
`labs/tag/metadata/` は、タグ解析・タグ付与で共有するメタデータ置き場です。

- `tag_attributes.json`
  - タグ属性辞書（group/series/platforms など）
  - `tag_analyze.py` の `attribute` 類似度で参照
- `needs_review.json`
  - `tag_analyze.py` が出力する「属性不足タグ」のレビュー候補
- `token_quality_rules.json`
  - 新規タグ候補/top_terms のノイズ除外ルール（数値+助数詞、block/allow list、抽象度しきい値）
  - 抽象語そのものの語彙リストは持たず、抽象語は `token_abstractness_labels.jsonl` を一次ソースとします
- `token_abstractness_labels.jsonl`
  - 抽象名詞判定の一次ソース兼、モデル学習用ラベル
  - `label=1` は抽象語として直接除外判定に使われます
- `token_abstractness_model.pkl`
  - 抽象名詞推定モデル（任意。存在時のみ読み込み）
- `token_abstractness_observations.jsonl`
  - 自動判定の集計ログ（同一tokenを1行に集約）

互換性:
- 旧 `labs/tag/outputs/metadata/` の `tag_attributes.json` / `needs_review.json` は、`metadata/` 側が未作成なら初回実行時に自動移行されます。


### 抽象名詞判定の反映方式
- `token_abstractness_labels.jsonl` は手動確定ラベルの一次ソースです。
- 自動判定結果は `token_abstractness_observations.jsonl` に集約されます。
- `--tag` の単発高速経路でも observations は更新されます。

### 自動観測の更新方式
- 判定結果は `token_abstractness_observations.jsonl` に集約されます。
- `a/c/u/n`（抽象票/具体票/不確実票/観測回数）を累積します。
- `token_abstractness_labels.jsonl` は手動確定ラベルのみを保持し、即時判定の一次ソースになります。
- 単発実行（`--tag`）でも observations は更新されます。

# labs/tag AGENTS.md

## 目的
`labs/tag/` は、ブログ本文の解析に基づいて
- タグ間関連度（tag cloud）を生成する
- 記事へのタグ再付与（既存タグ + 新規タグ候補）を行う
ためのローカル実験スクリプト群。

対象スクリプト:
- `tag_analyze.py`（タグ解析）
- `tag_assign.py`（記事タグ付与）
- `tag_feedback.py`（人手修正ログ）
- `common.py`（共通処理）

---

## 現在の実装概要

### 1. tag_analyze.py
- `full` 実行時:
  - タグ間関連度を計算し `outputs/tag_related_cloud.json` を更新
  - クラスタを `outputs/tag_clusters.json` に出力
  - 入力不足候補を `metadata/needs_review.json` に出力
- `--tag` 実行時:
  - デバッグ出力 `outputs/debug/tag_analysis_<tag>.json`
  - `--write-full` なしなら **高速経路** を使用

#### 高速経路（single tag fast path）
- 旧実装の問題: `--tag` でも全記事・全タグ前処理を実施していた
- 現在:
  - 候補タグを予備スコア（共起+属性）で絞る
  - 本文解析対象記事数を上限で絞る
  - 関連度計算は対象タグ + 候補タグのみ
- 主な引数:
  - `--single-tag-candidate-limit`（既定: 180）
  - `--single-tag-max-articles`（既定: 1800）

### 2. tag_assign.py
- 記事単位でタグ候補をスコアリング
- 既存タグ候補 + 新規キーワード候補を統合
- 結果は `/blog` を更新せず `outputs/assigned_tags.jsonl` と `outputs/reports/` に保存

#### スコア（概略）
- 既存タグ: semantic_fit / neighbor_vote / tag_cloud_hint / rarity_adjust
- 新規タグ: keyword_salience / specificity(IDF) / neighbor_support
- 人手修正 (`feedback/corrections.jsonl`) を加点減点で反映

### 3. トークナイザ（common.py）
- `--tokenizer` は `auto|mecab|janome|regex`
- 仕様:
  - `mecab` 指定時は `mecab-ipadic-neologd` 必須
  - `auto` は neologd付きMeCabが使えるときのみ `mecab` を選択
  - 使えない場合 `janome` → `regex` の順にフォールバック

#### 重要修正済み事項
- `auto+regex` で `tokenize_ja` 呼び出し毎にバックエンド再検出していた性能劣化を解消
- `fugashi.Tagger` が neologd(ipadic) で失敗するケースに対し `GenericTagger` フォールバックを追加

---

## 出力・永続データ

- `outputs/tag_related_cloud.json`（API連携対象。実運用では `src/data` へコピー想定）
- `outputs/tag_clusters.json`
- `outputs/assigned_tags.jsonl`
- `outputs/feedback/corrections.jsonl`
- `metadata/tag_attributes.json`
- `metadata/needs_review.json`

---

## 今後の改修方針（推奨順）

1. `tag_assign.py` の単独記事高速経路を追加
- 現状は `--article-id` 指定でも全記事前処理（全記事ベクトル/IDF/タグプロファイル）
- `tag_analyze` と同様に、候補タグ・参照記事を上限付きで絞る

2. キャッシュ導入
- 記事トークンキャッシュ（tokenizer/dicdir/file mtime キー）
- タグプロファイルキャッシュ
- 反復実行時間の安定化

3. top-n 計算の軽量化
- 全候補ソートではなくヒープ等で上位のみ保持

4. 品質改善
- 新規タグの語形正規化（大文字小文字、全角半角、表記ゆれ）
- 固有名詞辞書（platform/series）との統合加点

---

## 今後の改修で必ず気をつけること

1. `/blog` 本文を更新しない
- 現仕様では解析・再付与結果は `labs/tag/outputs/` のみ

2. 単発モードで全件処理を混入させない
- `--tag` / `--article-id` は探索範囲を限定する
- ループ前の全件前処理がないか常に確認

3. tokenizer の実行環境差異に注意
- `python3` と `venv/bin/python` のパッケージ差を常に確認
- `mecab` 利用時は `dicdir` をログに出す

4. MeCab+NEologd の前提を壊さない
- `mecab` 指定時は neologd 必須のまま維持
- `Tagger` 失敗時 `GenericTagger` フォールバックを保持

5. 日本語の意味品質を優先
- 接続語・文末語・ひらがな偏重語のノイズ抑制を維持
- 単語分割変更時は固有名詞結合（例: Xperia GX）の回帰確認を行う

6. 性能検証は必ず実測
- 変更時は最低でも
  - `tag_analyze --tag ...`
  - `tag_assign --article-id ... --dry-run`
  の所要時間と出力件数を確認

---

## 参考実行コマンド

```bash
# タグ単発解析（高速経路）
python labs/tag/tag_analyze.py --tag ブログ運営 --tokenizer auto

# 単発解析の探索上限を調整
python labs/tag/tag_analyze.py --tag ブログ運営 --single-tag-candidate-limit 120 --single-tag-max-articles 1200

# 記事単発タグ付与（現状は全件前処理あり）
python labs/tag/tag_assign.py --article-id 293 --dry-run --tokenizer auto

# MeCabを明示利用
python labs/tag/tag_analyze.py --tag 携帯 --tokenizer mecab
```

必要環境（MeCab使用時）:
- `fugashi` インストール済み
- `mecab-ipadic-neologd` 導入済み
- 必要なら `MECAB_NEOLOGD_DICDIR` 設定

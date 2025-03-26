import re
import os
import csv
import MeCab
from sklearn.feature_extraction.text import TfidfVectorizer

# 除外する単語リスト（ストップワード）
stop_words = {"これ", "こと", "ため", "わけ", "それ", "ここ", "そう", "よう", "場合", "いま", "本心"}

# 半角数字と全角数字をストップワードに追加
stop_words.update({str(i) for i in range(10)})  # "0"〜"9"
stop_words.update({chr(0xFF10 + i) for i in range(10)})  # "０"〜"９"


def is_numeric(word):
    return bool(re.fullmatch(r"\d+.", word))  # 数字＋１文字は除外


# MeCabを使ってテキストを形態素解析（名詞のみ抽出）
def extract_nouns(text):
    mecab = MeCab.Tagger("-Ochasen -r /opt/homebrew/etc/mecabrc -d /opt/homebrew/lib/mecab/dic/mecab-ipadic-neologd")
    words = []
    for line in mecab.parse(text).split("\n"):
        parts = line.split("\t")
        if len(parts) > 3 and "名詞" in parts[3]:  # 名詞のみを対象
            word = parts[0]
            if word not in stop_words and not is_numeric(word):  # ストップワードを除外
                words.append(word)

    # 100文字につき1個の単語を抽出（最低1単語）
    word_limit = max(1, len(text) // 100)
    return " ".join(sorted(set(words), key=lambda w: words.count(w), reverse=True)[:word_limit])


# 指定フォルダ内の.mdファイルをすべて取得（サブフォルダ含む）
def get_markdown_files(directory):
    md_files = []
    for root, _, files in os.walk(directory):  # 再帰的にフォルダを探索
        for file in files:
            if file.endswith(".md"):
                md_files.append(os.path.join(root, file))
    return md_files


# 指定フォルダを設定
input_folder = "../blog"  # 解析対象のフォルダ
output_csv = "outputs/tfidf_results.csv"

# ファイル読み込み＆前処理
file_paths = get_markdown_files(input_folder)
texts = []
file_names = []
for path in file_paths:
    with open(path, "r", encoding="utf-8") as f:
        texts.append(extract_nouns(f.read()))  # 形態素解析して名詞リストを取得
        file_names.append(os.path.splitext(os.path.basename(path))[0])  # ファイル名（拡張子なし）

# 形態素解析後の単語リストをTF-IDFで処理
vectorizer = TfidfVectorizer()
tfidf_matrix = vectorizer.fit_transform(texts)
feature_names = vectorizer.get_feature_names_out()

# 各記事ごとに上位20単語とスコアを取得
top_keywords = []
for i, text in enumerate(texts):
    tfidf_scores = tfidf_matrix.toarray()[i]
    keywords = sorted(zip(feature_names, tfidf_scores), key=lambda x: x[1], reverse=True)[:20]  # 上位20単語
    top_keywords.append(keywords)

# CSVに書き出し
with open(output_csv, "w", encoding="utf-8", newline="") as f:
    writer = csv.writer(f)

    # ヘッダー作成
    header = ["ファイル名"] + [f"単語{i + 1}" for i in range(20)] + [f"スコア{i + 1}" for i in range(20)]
    writer.writerow(header)

    # 各記事のデータを行ごとに書き出し
    for i, keywords in enumerate(top_keywords):
        row = [file_names[i]]  # ファイル名
        row += [word if score > 0 else "" for word, score in keywords]  # スコア0.000の単語は空文字に置換
        row += [f"{score:.4f}" if score > 0 else "" for word, score in keywords]  # スコア0.000のスコアも空文字に置換
        writer.writerow(row)

print(f"CSVファイル '{output_csv}' に出力しました。")

import os
import csv
import yaml
import re


# 指定フォルダ内の.mdファイルをすべて取得（サブフォルダ含む）
def get_markdown_files(directory):
    md_files = []
    for root, _, files in os.walk(directory):  # 再帰的にフォルダを探索
        for file in files:
            if file.endswith(".md"):
                md_files.append(os.path.join(root, file))
    return md_files


# YAMLメタデータを解析してタグを取得
def extract_tags(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # YAMLメタデータを抽出
    match = re.match(r"^---\n(.*?)\n---", content, re.DOTALL)
    if not match:
        return []  # メタデータが見つからなければ空リストを返す

    metadata = match.group(1)

    # YAMLとして解析
    try:
        parsed_yaml = yaml.safe_load(metadata)
        tags = parsed_yaml.get("tags", [])
        if isinstance(tags, list):
            return [tag.strip('"') for tag in tags]  # ダブルクォートを削除
    except yaml.YAMLError:
        return []  # YAML解析エラー時は空リスト

    return []


# 指定フォルダを設定
input_folder = "../blog"  # 解析対象のフォルダ
output_csv = "outputs/exported_tags.csv"

# ファイル読み込み＆タグ抽出
file_paths = get_markdown_files(input_folder)
tag_data = []

for path in file_paths:
    file_name = os.path.splitext(os.path.basename(path))[0]  # 拡張子を除いたファイル名
    tags = extract_tags(path)
    tag_data.append([file_name] + tags)

# CSVに書き出し
with open(output_csv, "w", encoding="utf-8", newline="") as f:
    writer = csv.writer(f)

    # ヘッダー作成
    writer.writerow(["ファイル名"] + [f"タグ{i + 1}" for i in range(max(len(row) - 1 for row in tag_data))])

    # データ書き込み
    writer.writerows(tag_data)

print(f"CSVファイル '{output_csv}' に出力しました。")

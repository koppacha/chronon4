import os
import re
from datetime import datetime, timedelta


def extract_date_from_filename(filename):
    # 正規表現を使用してm-dの形式から日付を抽出
    match = re.search(r'(\d{1,2})-(\d{1,2})', filename)
    if match:
        month, day = map(int, match.groups())
        return datetime(2023, month, day)
    else:
        return None


def process_md_files(folder_path):
    # 初期設定
    current_date = datetime(2023, 12, 1)
    current_article_number = 7288

    # 対象フォルダ内のMarkdownファイルを取得
    md_files = [f for f in os.listdir(folder_path) if f.endswith('.md')]

    # ファイルを日付順にソート
    md_files = sorted(md_files, key=lambda x: extract_date_from_filename(x))

    # ファイルを処理
    for md_file in sorted(md_files):
        # ファイルのパス
        file_path = os.path.join(folder_path, md_file)

        # 新しいファイル名を生成
        new_filename = current_date.strftime("%Y-%m-%d") + f"-{current_article_number:05d}.md"

        # メタ情報の作成
        meta_info = f"""---
title: ""
date: "{current_date.strftime("%Y-%m-%d")}"
categories: 
  - "今日の出来事"
tags: 
  - ""
---
"""

        # ファイルの中身を読み込み
        with open(file_path, 'r', encoding='utf-8') as file:
            content = file.readlines()

        # 1行目と2行目を削除
        content = content[2:]

        # ファイルの先頭にメタ情報を挿入
        content.insert(0, meta_info)

        # ファイルに書き込み
        with open(os.path.join(folder_path, new_filename), 'w', encoding='utf-8') as new_file:
            new_file.writelines(content)

        # カウンターを更新
        current_date += timedelta(days=1)
        current_article_number += 1

        # 元のファイルを削除
        os.remove(file_path)


if __name__ == "__main__":
    folder_path = "../_sandbox"  # フォルダのパスを指定
    process_md_files(folder_path)

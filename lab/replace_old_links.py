import os
import re

# 正規表現のパターン
pattern = re.compile(
    r'\[#(\d{3,4})[『「](.*?)[」』](\d{4})年(\d{2})月(\d{2})日]\(https?://chr\.mn/glyph/(\d{5}).*?\)',
    re.UNICODE
)

def replace_text_in_file(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # 置換処理
    new_content = pattern.sub(r"[\3-\4-\5-\6]", content)

    # 変更があればファイルを上書き保存
    if new_content != content:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(new_content)
        print(f"Updated: {file_path}")


def process_markdown_files(directory):
    for root, _, files in os.walk(directory):
        for file in files:
            if file.endswith(".md"):
                replace_text_in_file(os.path.join(root, file))


# 解析対象フォルダ（適宜変更）
target_folder = "../blog"
process_markdown_files(target_folder)
print("置換処理が完了しました。")

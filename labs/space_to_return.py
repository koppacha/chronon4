import os
import re


def replace_multibyte_space(folder_path):
    # 対象フォルダ内のMarkdownファイルを取得
    md_files = [f for f in os.listdir(folder_path) if f.endswith('.md')]

    # サブフォルダも含めて走査
    for root, dirs, files in os.walk(folder_path):
        for file in files:
            if file.endswith('.md'):
                md_file_path = os.path.join(root, file)

                # １行の合計文字数が40文字を超える場合に処理を行う
                with open(md_file_path, 'r', encoding='utf-8') as file:
                    lines = file.readlines()

                modified = False
                for i, line in enumerate(lines):
                    # １行の合計文字数が40文字を超え、マルチバイトに挟まれた半角スペースがある場合
                    if len(line) > 40 and re.search(
                            r'[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]+\s+[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]+',
                            line):
                        # マルチバイトに挟まれた半角スペースを改行に置換
                        lines[i] = re.sub(
                            r'([\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]+)\s+([\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]+)',
                            r'\1\n\2', line)
                        modified = True

                # ファイルが変更された場合、上書き保存
                if modified:
                    with open(md_file_path, 'w', encoding='utf-8') as file:
                        file.writelines(lines)


if __name__ == "__main__":
    folder_path = "../"  # フォルダのパスを指定
    replace_multibyte_space(folder_path)

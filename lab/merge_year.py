import re
from collections import defaultdict
from pathlib import Path

# 入力と出力ディレクトリ
INPUT_DIR = Path("../blog")
OUTPUT_DIR = Path("outputs")
OUTPUT_DIR.mkdir(exist_ok=True)

# 対象ファイルの命名規則にマッチする正規表現
filename_re = re.compile(r"^(\d{4})-(\d{2})-(\d{2})-(\d{5})\.md$")

# 年ごとの記事を集める
yearly_articles = defaultdict(list)

# ファイル探索と整形
for md_path in INPUT_DIR.rglob("*.md"):
    match = filename_re.match(md_path.name)
    if not match:
        continue  # 命名規則に従っていないファイルはスキップ

    year, month, day, article_no = match.groups()
    with md_path.open(encoding="utf-8") as f:
        content = f.read()

    # title: の直前に no: [[記事番号]] を挿入
    def insert_article_no(match):
        return f"no: {article_no}\n{match.group(0)}"

    updated_content = re.sub(r"^title:\s", insert_article_no, content, flags=re.MULTILINE, count=1)

    # GPT認識用セパレータで囲む
    full_entry = f"=== ENTRY START ===\n{updated_content.strip()}\n=== ENTRY END ===\n"
    yearly_articles[year].append((md_path.name, full_entry))

# 出力ファイル作成
for year in sorted(yearly_articles.keys()):
    output_path = OUTPUT_DIR / f"blog_{year}.md"
    with output_path.open("w", encoding="utf-8") as out_file:
        for filename, entry in sorted(yearly_articles[year]):
            out_file.write(entry + "\n")

print("✅ 年ごとのマージファイルを output フォルダに出力しました。")
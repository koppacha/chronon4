import os
from pathlib import Path
from transformers import T5Tokenizer, T5ForConditionalGeneration
import re

# モデルとトークナイザーの準備（日本語T5）
tokenizer = T5Tokenizer.from_pretrained("sonoisa/t5-base-japanese", legacy=False)
model = T5ForConditionalGeneration.from_pretrained("sonoisa/t5-base-japanese")


def summarize_text(text: str, max_length: int = 256) -> str:
    input_text = "要約: " + text.replace("\n", " ")
    tokens = tokenizer.encode(input_text, return_tensors="pt", max_length=512, truncation=True)
    summary_ids = model.generate(
        tokens,
        max_length=max_length,
        min_length=40,
        no_repeat_ngram_size=2,
        length_penalty=1.0,
        num_beams=4,
        early_stopping=True
    )
    summary = tokenizer.decode(summary_ids[0], skip_special_tokens=True)
    return summary


def process_file(input_path: Path, output_path: Path):
    with input_path.open("r", encoding="utf-8") as f:
        original_text = f.read()

    # メタデータ（YAML front matter）除去
    def remove_front_matter(text):
        return re.sub(r"(?s)^---.*?---\s*", "", text)

    original_text = remove_front_matter(original_text)

    def summarize_text_by_paragraphs(text: str) -> str:
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
        summarized = []

        for i, para in enumerate(paragraphs):
            if len(para) < 30:
                continue  # 短すぎる段落はスキップ
            try:
                s = summarize_text(para)
                summarized.append(f"{s}")
            except Exception as e:
                summarized.append(f"【P{i+1}】要約エラー: {e}")
        return "\n".join(summarized)

    summary = summarize_text_by_paragraphs(original_text)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as f:
        f.write(summary)

    print(f"✅ Processed: {input_path}")


def process_directory(input_dir: str, output_dir: str):
    input_dir = Path(input_dir)
    output_dir = Path(output_dir)

    for file_path in input_dir.rglob("*.md"):
        relative_path = file_path.relative_to(input_dir)
        output_path = output_dir / relative_path
        process_file(file_path, output_path)


if __name__ == "__main__":
    # 固定パスの指定（必要に応じて変更してください）
    input_dir = "./tests"
    output_dir = "./outputs"

    process_directory(input_dir, output_dir)

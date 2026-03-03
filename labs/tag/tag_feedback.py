#!/usr/bin/env python3
from __future__ import annotations

import argparse

from common import CORRECTIONS_FILE, ensure_dirs, now_iso, read_jsonl, write_jsonl


def cmd_correct(args: argparse.Namespace) -> None:
    rows = read_jsonl(CORRECTIONS_FILE)
    row = {
        "article_id": args.article_id,
        "add": args.add or [],
        "remove": args.remove or [],
        "note": args.note or "",
        "source": "tag_feedback",
        "updated_at": now_iso(),
    }
    rows.append(row)
    write_jsonl(CORRECTIONS_FILE, rows)
    print(f"[tag_feedback] correction appended: article_id={args.article_id}")
    print(f"[tag_feedback] file: {CORRECTIONS_FILE}")


def cmd_list(args: argparse.Namespace) -> None:
    rows = read_jsonl(CORRECTIONS_FILE)
    if args.article_id is not None:
        filtered = []
        for row in rows:
            try:
                article_id = int(row.get("article_id", -1))
            except Exception:
                continue
            if article_id == args.article_id:
                filtered.append(row)
        rows = filtered
    for row in rows:
        print(row)
    if not rows:
        print("[tag_feedback] corrections not found")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="タグ再付与の人手修正ログを管理する補助スクリプト")
    sub = parser.add_subparsers(dest="command", required=True)

    p_correct = sub.add_parser("correct", help="記事単位の add/remove 修正を記録")
    p_correct.add_argument("--article-id", type=int, required=True)
    p_correct.add_argument("--add", action="append", default=[], help="追加したいタグ（複数指定可）")
    p_correct.add_argument("--remove", action="append", default=[], help="除外したいタグ（複数指定可）")
    p_correct.add_argument("--note", help="メモ")
    p_correct.set_defaults(func=cmd_correct)

    p_list = sub.add_parser("list", help="修正ログ表示")
    p_list.add_argument("--article-id", type=int, help="記事IDで絞り込み")
    p_list.set_defaults(func=cmd_list)
    return parser


def main() -> None:
    ensure_dirs()
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict, List, Tuple

from common import TOKEN_ABSTRACTNESS_MODEL_FILE, TOKEN_ABSTRACTNESS_OBSERVATIONS_FILE


def load_rows(path: Path) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    if not path.exists():
        return rows
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(row, dict):
            rows.append(row)
    return rows


def build_dataset(rows: List[Dict[str, Any]], include_auto: bool = False) -> Tuple[List[str], List[int]]:
    x: List[str] = []
    y: List[int] = []
    for row in rows:
        token = str(row.get("token", "")).strip()
        label = row.get("label")
        source = str(row.get("source", "")).strip().lower()
        auto = bool(row.get("auto_generated", False))
        manual = bool(row.get("manual", False))
        if not include_auto and not (manual or source in {"manual", "human", "seed"}):
            continue
        if not include_auto and (auto or source in {"auto", "migrated_rule", "auto_legacy"}):
            continue
        if not token:
            continue
        if label in (1, "1", True, "abstract"):
            x.append(token)
            y.append(1)
        elif label in (0, "0", False, "concrete"):
            x.append(token)
            y.append(0)
    return x, y



def build_dataset_from_observations(rows: List[Dict[str, Any]], min_votes: int = 3, min_margin: float = 0.34) -> Tuple[List[str], List[int]]:
    x: List[str] = []
    y: List[int] = []
    for row in rows:
        token = str(row.get("t", row.get("token", ""))).strip()
        if not token:
            continue
        a = int(row.get("a", 0))
        c = int(row.get("c", 0))
        n = int(row.get("n", a + c + int(row.get("u", 0))))
        if n < min_votes:
            continue
        decisive = a + c
        if decisive <= 0:
            continue
        ratio_a = a / decisive
        margin = abs(ratio_a - 0.5) * 2.0
        if margin < min_margin:
            continue
        label = 1 if ratio_a >= 0.5 else 0
        x.append(token)
        y.append(label)
    return x, y

def main() -> None:
    parser = argparse.ArgumentParser(description="抽象名詞推定モデルの学習")
    parser.add_argument(
        "--labels",
        default="labs/tag/metadata/token_abstractness_labels.jsonl",
        help="学習ラベル(jsonl)。1行ごとに {'token': str, 'label': 0|1}",
    )
    parser.add_argument("--model", default=str(TOKEN_ABSTRACTNESS_MODEL_FILE), help="保存先モデルファイル(.pkl)")
    parser.add_argument("--include-auto", action="store_true", help="labels 内の auto 系行も学習に含める（通常は不要）")
    parser.add_argument("--observations", default=str(TOKEN_ABSTRACTNESS_OBSERVATIONS_FILE), help="自動観測ログ(jsonl)")
    parser.add_argument("--include-observations", action="store_true", help="observations から高信頼サンプルを追加で学習に使う")
    parser.add_argument("--obs-min-votes", type=int, default=3, help="observations採用の最小観測回数")
    parser.add_argument("--obs-min-margin", type=float, default=0.34, help="observations採用の最小判定マージン")
    args = parser.parse_args()

    try:
        import joblib  # type: ignore
        from sklearn.feature_extraction.text import TfidfVectorizer  # type: ignore
        from sklearn.linear_model import LogisticRegression  # type: ignore
        from sklearn.metrics import classification_report  # type: ignore
        from sklearn.model_selection import train_test_split  # type: ignore
        from sklearn.pipeline import Pipeline  # type: ignore
    except Exception:
        raise SystemExit("scikit-learn/joblib が必要です。`pip install scikit-learn joblib` を実行してください。")

    rows = load_rows(Path(args.labels))
    x, y = build_dataset(rows, include_auto=bool(args.include_auto))

    if args.include_observations:
        obs_rows = load_rows(Path(args.observations))
        ox, oy = build_dataset_from_observations(
            obs_rows,
            min_votes=max(1, int(args.obs_min_votes)),
            min_margin=max(0.0, min(1.0, float(args.obs_min_margin))),
        )
        x.extend(ox)
        y.extend(oy)

    if len(x) < 20:
        raise SystemExit("学習データが不足しています。少なくとも20件以上のラベルを用意してください。")

    pipeline = Pipeline(
        [
            ("tfidf", TfidfVectorizer(analyzer="char", ngram_range=(1, 3), min_df=1)),
            ("clf", LogisticRegression(max_iter=1200, class_weight="balanced")),
        ]
    )

    test_size = 0.2 if len(x) >= 50 else 0.25
    x_train, x_test, y_train, y_test = train_test_split(x, y, test_size=test_size, random_state=42, stratify=y)
    pipeline.fit(x_train, y_train)

    pred = pipeline.predict(x_test)
    print("[train_token_abstractness] validation report")
    print(classification_report(y_test, pred, digits=4))

    model_path = Path(args.model)
    model_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipeline, model_path)
    print(f"[train_token_abstractness] model saved: {model_path}")


if __name__ == "__main__":
    main()

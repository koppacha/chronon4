#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path

from common import TOKEN_ABSTRACTNESS_MODEL_FILE


def main() -> None:
    parser = argparse.ArgumentParser(description="抽象名詞推定モデルで語を推論")
    parser.add_argument("tokens", nargs="*", help="推論対象トークン")
    parser.add_argument("--model", default=str(TOKEN_ABSTRACTNESS_MODEL_FILE), help="モデルファイル(.pkl)")
    args = parser.parse_args()

    if not args.tokens:
        raise SystemExit("推論対象トークンを1つ以上指定してください。")

    try:
        import joblib  # type: ignore
    except Exception:
        raise SystemExit("joblib が必要です。`pip install joblib` を実行してください。")

    model_path = Path(args.model)
    if not model_path.exists():
        raise SystemExit(f"モデルが見つかりません: {model_path}")

    model = joblib.load(model_path)
    if not hasattr(model, "predict_proba"):
        raise SystemExit("predict_proba に対応したモデルが必要です。")

    probs = model.predict_proba(args.tokens)
    for token, prob in zip(args.tokens, probs):
        score = float(prob[1]) if len(prob) >= 2 else 0.0
        print(f"{token}\tabstract_score={score:.6f}")


if __name__ == "__main__":
    main()

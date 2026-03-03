#!/usr/bin/env python3
from __future__ import annotations

import argparse
import math
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, Set, Tuple

from common import (
    ASSIGNED_TAGS_FILE,
    TAG_RELATED_CLOUD_FILE,
    apply_tag_overlays,
    article_token_weights,
    build_article_index,
    cosine_sparse,
    ensure_dirs,
    load_assigned_tag_overrides,
    load_corrections,
    load_json,
    load_posts,
    now_iso,
    parse_args_common,
    read_jsonl,
    sanitize_filename,
    tokenize_ja,
    is_noun_like_token,
    configure_tokenizer,
    active_mecab_dicdir,
    TokenQualityJudge,
    write_json,
    write_jsonl,
)


def build_token_df(article_vectors: Dict[int, Dict[str, float]]) -> Dict[str, int]:
    df: Dict[str, int] = defaultdict(int)
    for vec in article_vectors.values():
        for token in vec.keys():
            df[token] += 1
    return dict(df)


def build_idf(article_vectors: Dict[int, Dict[str, float]]) -> Dict[str, float]:
    n = max(1, len(article_vectors))
    df = build_token_df(article_vectors)
    return {token: math.log((1 + n) / (1 + freq)) + 1.0 for token, freq in df.items()}


def weighted_vector_with_idf(vec: Dict[str, float], idf: Dict[str, float]) -> Dict[str, float]:
    return {k: v * idf.get(k, 1.0) for k, v in vec.items()}



def build_tag_profiles(
    merged_tags_map: Dict[int, List[str]],
    article_vectors: Dict[int, Dict[str, float]],
    idf: Dict[str, float],
) -> Tuple[Dict[str, Dict[str, float]], Dict[str, int]]:
    tag_articles: Dict[str, List[int]] = defaultdict(list)
    for article_id, tags in merged_tags_map.items():
        for tag in tags:
            tag_articles[tag].append(article_id)

    profiles: Dict[str, Dict[str, float]] = {}
    tag_counts: Dict[str, int] = {}
    for tag, article_ids in tag_articles.items():
        merged: Dict[str, float] = defaultdict(float)
        valid = 0
        for article_id in article_ids:
            vec = article_vectors.get(article_id, {})
            if not vec:
                continue
            valid += 1
            for token, score in vec.items():
                merged[token] += score * idf.get(token, 1.0)
        if valid > 0:
            profiles[tag] = {k: v / valid for k, v in merged.items()}
            tag_counts[tag] = valid
    return profiles, tag_counts


def build_neighbors(
    target_id: int,
    article_vectors: Dict[int, Dict[str, float]],
    min_score: float,
) -> Tuple[List[Tuple[int, float]], float]:
    target_vec = article_vectors.get(target_id, {})
    if not target_vec:
        return [], 0.0

    raw: List[Tuple[int, float]] = []
    for article_id, vec in article_vectors.items():
        if article_id == target_id:
            continue
        sim = cosine_sparse(target_vec, vec)
        if sim >= min_score:
            raw.append((article_id, sim))

    raw.sort(key=lambda x: (-x[1], x[0]))
    total_sim = sum(score for _, score in raw)
    return raw, total_sim


def get_cloud_hint_scores(current_tags: List[str]) -> Dict[str, float]:
    cloud = load_json(TAG_RELATED_CLOUD_FILE, {})
    tags_obj = cloud.get("tags", {}) if isinstance(cloud, dict) else {}
    if not isinstance(tags_obj, dict):
        return {}

    hint: Dict[str, float] = defaultdict(float)
    current_set = set(current_tags)
    for tag in current_tags:
        entry = tags_obj.get(tag)
        if not isinstance(entry, dict):
            continue
        related = entry.get("related", [])
        if not isinstance(related, list):
            continue
        for row in related[:20]:
            if not isinstance(row, dict):
                continue
            rel_tag = row.get("tag")
            rel_score = float(row.get("score", 0.0))
            if not isinstance(rel_tag, str) or not rel_tag or rel_tag in current_set:
                continue
            hint[rel_tag] += rel_score
    return dict(hint)


def build_existing_tag_candidates(
    target_id: int,
    merged_tags_map: Dict[int, List[str]],
    article_vectors: Dict[int, Dict[str, float]],
    tag_profiles: Dict[str, Dict[str, float]],
    tag_counts: Dict[str, int],
    neighbors: List[Tuple[int, float]],
    total_neighbor_sim: float,
    cloud_hint_scores: Dict[str, float],
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    target_vec = article_vectors.get(target_id, {})
    current_tags = set(merged_tags_map.get(target_id, []))
    all_tags = sorted(tag_profiles.keys())

    neighbor_vote_raw: Dict[str, float] = defaultdict(float)
    for article_id, sim in neighbors:
        for tag in merged_tags_map.get(article_id, []):
            neighbor_vote_raw[tag] += sim

    neighbor_rows: List[Dict[str, Any]] = [
        {
            "article_id": article_id,
            "score": round(sim, 6),
            "tags": merged_tags_map.get(article_id, []),
        }
        for article_id, sim in neighbors[:30]
    ]

    semantic_raw: Dict[str, float] = {}
    neighbor_vote_ratio: Dict[str, float] = {}
    cloud_raw: Dict[str, float] = {}
    rarity_raw: Dict[str, float] = {}

    for tag in all_tags:
        if tag in current_tags:
            continue
        semantic_raw[tag] = cosine_sparse(target_vec, tag_profiles.get(tag, {}))
        neighbor_vote_ratio[tag] = neighbor_vote_raw.get(tag, 0.0) / total_neighbor_sim if total_neighbor_sim > 0 else 0.0
        cloud_raw[tag] = cloud_hint_scores.get(tag, 0.0)
        rarity_raw[tag] = 1.0 / (1.0 + math.log1p(tag_counts.get(tag, 1)))

    semantic_norm = _normalize_dict_values(semantic_raw)
    neighbor_norm = _normalize_dict_values(neighbor_vote_ratio)
    cloud_norm = _normalize_dict_values(cloud_raw)
    rarity_norm = _normalize_dict_values(rarity_raw)

    candidates: List[Dict[str, Any]] = []
    for tag in semantic_raw.keys():
        components = {
            "semantic_fit": semantic_norm.get(tag, 0.0),
            "neighbor_vote": neighbor_norm.get(tag, 0.0),
            "tag_cloud_hint": cloud_norm.get(tag, 0.0),
            "rarity_adjust": rarity_norm.get(tag, 0.0),
        }
        score = (
            0.50 * components["semantic_fit"]
            + 0.30 * components["neighbor_vote"]
            + 0.15 * components["tag_cloud_hint"]
            + 0.05 * components["rarity_adjust"]
        )
        if score <= 0:
            continue
        candidates.append(
            {
                "tag": tag,
                "score": round(score, 6),
                "candidate_type": "existing",
                "is_new_tag": False,
                "components": {k: round(v, 6) for k, v in components.items()},
                "raw": {
                    "semantic": round(semantic_raw.get(tag, 0.0), 6),
                    "neighbor_vote": round(neighbor_vote_ratio.get(tag, 0.0), 6),
                    "cloud_hint": round(cloud_raw.get(tag, 0.0), 6),
                    "tag_count": tag_counts.get(tag, 0),
                },
            }
        )

    candidates.sort(key=lambda x: (-x["score"], x["tag"]))
    return candidates, neighbor_rows


def collect_article_top_keywords(post_content: str, article_vec: Dict[str, float], idf: Dict[str, float], top_n: int = 30) -> List[Tuple[str, float]]:
    tokens = tokenize_ja(post_content)
    if not tokens:
        return []
    tf: Dict[str, float] = defaultdict(float)
    for token in tokens:
        tf[token] += 1.0
    max_tf = max(tf.values()) if tf else 1.0

    scored: List[Tuple[str, float]] = []
    for token, count in tf.items():
        tf_norm = count / max_tf
        vec_weight = article_vec.get(token, 0.0)
        salience = (0.55 * tf_norm) + (0.45 * vec_weight)
        scored.append((token, salience * idf.get(token, 1.0)))

    scored.sort(key=lambda x: (-x[1], x[0]))
    return scored[:top_n]


def build_new_tag_candidates(
    post_content: str,
    article_vec: Dict[str, float],
    idf: Dict[str, float],
    neighbors: List[Tuple[int, float]],
    article_vectors: Dict[int, Dict[str, float]],
    existing_tag_set: Set[str],
    min_new_tag_score: float,
    max_new_tags: int,
    token_quality_judge: TokenQualityJudge,
    doc_count: int,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    keyword_rows = collect_article_top_keywords(post_content, article_vec, idf, top_n=40)
    if not keyword_rows:
        return [], []

    excluded_tokens: List[Dict[str, Any]] = []
    salience_raw: Dict[str, float] = {}
    specificity_raw: Dict[str, float] = {}
    neighbor_support_raw: Dict[str, float] = defaultdict(float)

    total_neighbor = sum(sim for _, sim in neighbors)
    for token, score in keyword_rows:
        token_tag_equivalent = token in existing_tag_set
        if token_tag_equivalent:
            continue
        if not is_noun_like_token(token, strict=True):
            continue
        quality = token_quality_judge.evaluate(token, idf=idf.get(token), doc_count=doc_count, enforce_abstract=True)
        if not quality.allow:
            excluded_tokens.append(
                {
                    "token": token,
                    "reason": quality.reason,
                    "abstractness_score": round(quality.abstractness_score, 6),
                }
            )
            continue
        salience_raw[token] = score
        specificity_raw[token] = idf.get(token, 1.0)

    for article_id, sim in neighbors:
        vec = article_vectors.get(article_id, {})
        if not vec:
            continue
        for token in salience_raw.keys():
            if token in vec:
                neighbor_support_raw[token] += sim

    salience_norm = _normalize_dict_values(salience_raw)
    specificity_norm = _normalize_dict_values(specificity_raw)
    if total_neighbor > 0:
        neighbor_ratio = {k: v / total_neighbor for k, v in neighbor_support_raw.items()}
    else:
        neighbor_ratio = {k: 0.0 for k in salience_raw.keys()}
    neighbor_norm = _normalize_dict_values(neighbor_ratio)

    candidates: List[Dict[str, Any]] = []
    for token in salience_raw.keys():
        components = {
            "keyword_salience": salience_norm.get(token, 0.0),
            "specificity": specificity_norm.get(token, 0.0),
            "neighbor_support": neighbor_norm.get(token, 0.0),
        }
        score = (
            0.55 * components["keyword_salience"]
            + 0.30 * components["specificity"]
            + 0.15 * components["neighbor_support"]
        )
        if score < min_new_tag_score:
            continue
        candidates.append(
            {
                "tag": token,
                "score": round(score, 6),
                "candidate_type": "new",
                "is_new_tag": True,
                "components": {k: round(v, 6) for k, v in components.items()},
                "raw": {
                    "salience": round(salience_raw.get(token, 0.0), 6),
                    "idf": round(specificity_raw.get(token, 0.0), 6),
                    "neighbor_support": round(neighbor_ratio.get(token, 0.0), 6),
                },
            }
        )

    candidates.sort(key=lambda x: (-x["score"], x["tag"]))
    excluded_tokens.sort(key=lambda x: (x["reason"], x["token"]))
    return candidates[:max_new_tags], excluded_tokens


def _normalize_dict_values(values: Dict[str, float]) -> Dict[str, float]:
    if not values:
        return {}
    lo = min(values.values())
    hi = max(values.values())
    if hi - lo < 1e-12:
        return {k: 0.0 for k in values}
    return {k: (v - lo) / (hi - lo) for k, v in values.items()}


def apply_feedback_bias(candidates: List[Dict[str, Any]], article_id: int, corrections: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    boost: Dict[str, float] = defaultdict(float)
    suppress: Dict[str, float] = defaultdict(float)
    for row in corrections:
        if row["article_id"] != article_id:
            continue
        for tag in row["add"]:
            boost[tag] += 1.0
        for tag in row["remove"]:
            suppress[tag] += 1.0

    out: List[Dict[str, Any]] = []
    seen: Set[str] = set()
    for item in candidates:
        tag = item["tag"]
        delta = (0.25 * boost.get(tag, 0.0)) - (0.35 * suppress.get(tag, 0.0))
        score = max(0.0, float(item["score"]) + delta)
        updated = dict(item)
        updated["score"] = round(score, 6)
        updated.setdefault("components", {})
        updated["components"]["feedback_delta"] = round(delta, 6)
        if score > 0:
            out.append(updated)
            seen.add(tag)

    for tag, b in boost.items():
        if tag in seen:
            continue
        out.append(
            {
                "tag": tag,
                "score": round(0.25 * b, 6),
                "candidate_type": "existing",
                "is_new_tag": False,
                "components": {"feedback_delta": round(0.25 * b, 6)},
                "raw": {"feedback_only": True},
            }
        )

    out.sort(key=lambda x: (-x["score"], x["tag"]))
    return out


def merge_candidates(existing: List[Dict[str, Any]], new: List[Dict[str, Any]], top_k: int) -> List[Dict[str, Any]]:
    merged = existing + new
    merged.sort(key=lambda x: (-x["score"], x["tag"]))
    return merged[:top_k]


def save_assignment(article_id: int, selected: List[Dict[str, Any]]) -> None:
    tags = sorted({row["tag"] for row in selected})
    tag_details = [
        {
            "tag": row["tag"],
            "score": row["score"],
            "is_new_tag": bool(row.get("is_new_tag", False)),
            "candidate_type": row.get("candidate_type", "existing"),
        }
        for row in selected
    ]

    rows = read_jsonl(ASSIGNED_TAGS_FILE)
    by_id: Dict[int, Dict[str, Any]] = {}
    for row in rows:
        try:
            rid = int(row.get("article_id"))
        except Exception:
            continue
        by_id[rid] = row

    by_id[article_id] = {
        "article_id": article_id,
        "tags": tags,
        "tag_details": tag_details,
        "source": "tag_assign",
        "updated_at": now_iso(),
    }
    ordered = [by_id[k] for k in sorted(by_id.keys())]
    write_jsonl(ASSIGNED_TAGS_FILE, ordered)


def main() -> None:
    parser = parse_args_common(argparse.ArgumentParser(description="記事へのタグ再付与候補生成スクリプト"))
    parser.add_argument("--article-id", type=int, help="対象記事ID（指定時は1件のみ）")
    parser.add_argument("--top-k", type=int, default=8, help="最終的に採用するタグ件数（既存+新規を統合して上位）")
    parser.add_argument("--max-new-tags", type=int, default=3, help="新規タグ候補の最大採用件数")
    parser.add_argument("--min-neighbor-score", type=float, default=0.08, help="近傍記事として採用する最小類似度")
    parser.add_argument("--min-new-tag-score", type=float, default=0.62, help="新規キーワードをタグ採用する最小スコア")
    parser.add_argument("--dry-run", action="store_true", help="assigned_tags.jsonl を更新しない")
    args = parser.parse_args()

    try:
        backend = configure_tokenizer(args.tokenizer)
    except RuntimeError as e:
        raise SystemExit(str(e))
    ensure_dirs()
    blog_dir = Path(args.blog_dir)
    output_dir = Path(args.output_dir)

    posts = load_posts(blog_dir)
    dicdir = active_mecab_dicdir()
    if backend == "mecab":
        print(f"[tokenizer] backend={backend} dicdir={dicdir}")
    else:
        print(f"[tokenizer] backend={backend}")
    article_index = build_article_index(posts)
    if args.article_id and args.article_id not in article_index:
        raise SystemExit(f"article_id={args.article_id} が見つかりません")

    assigned = load_assigned_tag_overrides(ASSIGNED_TAGS_FILE)
    corrections = load_corrections()
    merged_tags_map = apply_tag_overlays(posts, assigned, corrections)
    article_vectors = {p.article_id: article_token_weights(p) for p in posts}
    idf = build_idf(article_vectors)
    tag_profiles, tag_counts = build_tag_profiles(merged_tags_map, article_vectors, idf)

    existing_tag_set: Set[str] = set(tag_profiles.keys())
    manual_tag_set: Set[str] = set(existing_tag_set)
    for tags in merged_tags_map.values():
        manual_tag_set.update(tags)
    token_quality_judge = TokenQualityJudge(manual_tag_set=manual_tag_set)

    target_ids = [args.article_id] if args.article_id else [p.article_id for p in posts]
    report_items: List[Dict[str, Any]] = []

    for article_id in target_ids:
        post = article_index[article_id]
        target_vec = article_vectors.get(article_id, {})
        target_vec_idf = weighted_vector_with_idf(target_vec, idf)

        neighbors, total_neighbor_sim = build_neighbors(
            article_id,
            article_vectors,
            min_score=args.min_neighbor_score,
        )
        cloud_hint = get_cloud_hint_scores(merged_tags_map.get(article_id, []))

        semantic_vectors = dict(article_vectors)
        semantic_vectors[article_id] = target_vec_idf

        existing_candidates, neighbor_rows = build_existing_tag_candidates(
            target_id=article_id,
            merged_tags_map=merged_tags_map,
            article_vectors=semantic_vectors,
            tag_profiles=tag_profiles,
            tag_counts=tag_counts,
            neighbors=neighbors,
            total_neighbor_sim=total_neighbor_sim,
            cloud_hint_scores=cloud_hint,
        )

        new_candidates, excluded_new_tokens = build_new_tag_candidates(
            post_content=post.content,
            article_vec=target_vec,
            idf=idf,
            neighbors=neighbors,
            article_vectors=article_vectors,
            existing_tag_set=existing_tag_set,
            min_new_tag_score=max(0.0, min(1.0, args.min_new_tag_score)),
            max_new_tags=max(0, args.max_new_tags),
            token_quality_judge=token_quality_judge,
            doc_count=len(article_vectors),
        )

        merged_candidates = merge_candidates(existing_candidates, new_candidates, top_k=max(1, args.top_k * 3))
        with_feedback = apply_feedback_bias(merged_candidates, article_id, corrections)
        final_candidates = merge_candidates(
            [c for c in with_feedback if not c.get("is_new_tag")],
            [c for c in with_feedback if c.get("is_new_tag")],
            top_k=max(1, args.top_k),
        )

        selected = final_candidates[: args.top_k]

        report = {
            "article_id": article_id,
            "file": post.rel_path,
            "title": post.title,
            "current_tags": merged_tags_map.get(article_id, []),
            "selected_tags": selected,
            "existing_candidates": existing_candidates[: max(args.top_k, 12)],
            "new_tag_candidates": new_candidates,
            "excluded_new_tag_tokens": excluded_new_tokens[:80],
            "neighbors": neighbor_rows,
            "config": {
                "top_k": args.top_k,
                "max_new_tags": args.max_new_tags,
                "min_neighbor_score": args.min_neighbor_score,
                "min_new_tag_score": args.min_new_tag_score,
            },
            "generated_at": now_iso(),
        }
        report_items.append(report)

        if not args.dry_run:
            save_assignment(article_id, selected)

    report_name = f"tag_assign_{sanitize_filename(str(args.article_id or 'all'))}.json"
    report_path = output_dir / "reports" / report_name
    write_json(report_path, {"generated_at": now_iso(), "items": report_items, "dry_run": args.dry_run})
    print(f"[tag_assign] report written: {report_path}")

    written_labels = token_quality_judge.flush_label_updates()
    if written_labels > 0:
        print(f"[tag_assign] auto observations updated: {written_labels}")

    if not args.dry_run:
        print(f"[tag_assign] assigned tags updated: {ASSIGNED_TAGS_FILE}")


if __name__ == "__main__":
    main()

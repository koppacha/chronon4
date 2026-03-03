#!/usr/bin/env python3
from __future__ import annotations

import argparse
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, Set, Tuple

from common import (
    ASSIGNED_TAGS_FILE,
    NEEDS_REVIEW_FILE,
    TAG_ATTRIBUTES_FILE,
    TAG_CLUSTERS_FILE,
    TAG_RELATED_CLOUD_FILE,
    active_mecab_dicdir,
    apply_tag_overlays,
    article_token_weights,
    attribute_similarity,
    build_article_index,
    compute_idf_for_tags,
    configure_tokenizer,
    cosine_sparse,
    dump_debug_json,
    ensure_dirs,
    load_assigned_tag_overrides,
    load_corrections,
    load_post_metas,
    load_posts,
    load_posts_for_ids,
    load_tag_attributes,
    merge_weight_dicts,
    now_iso,
    parse_args_common,
    sanitize_filename,
    top_terms,
    TokenQualityJudge,
    write_json,
)


def build_tag_inputs(posts, merged_tags_map: Dict[int, List[str]]) -> Tuple[Dict[str, Set[int]], Dict[int, Dict[str, float]]]:
    article_index = build_article_index(posts)
    article_token_map = {post.article_id: article_token_weights(post) for post in posts}
    tag_to_articles: Dict[str, Set[int]] = defaultdict(set)

    for article_id, tags in merged_tags_map.items():
        if article_id not in article_index:
            continue
        for tag in tags:
            if tag:
                tag_to_articles[tag].add(article_id)

    return tag_to_articles, article_token_map


def compute_tag_vectors(tag_to_articles: Dict[str, Set[int]], article_token_map: Dict[int, Dict[str, float]]) -> Dict[str, Dict[str, float]]:
    tag_article_tokens: Dict[str, List[Dict[str, float]]] = {}
    for tag, article_ids in tag_to_articles.items():
        tag_article_tokens[tag] = [article_token_map.get(article_id, {}) for article_id in sorted(article_ids)]
    idf = compute_idf_for_tags(tag_article_tokens)
    return {tag: merge_weight_dicts(vecs, idf=idf) for tag, vecs in tag_article_tokens.items()}


def cooccurrence_similarity(a_articles: Set[int], b_articles: Set[int]) -> float:
    if not a_articles or not b_articles:
        return 0.0
    inter = len(a_articles & b_articles)
    if inter == 0:
        return 0.0
    return inter / ((len(a_articles) * len(b_articles)) ** 0.5)


def term_overlap_similarity(a_terms: List[str], b_terms: List[str]) -> float:
    aset = set(a_terms)
    bset = set(b_terms)
    if not aset or not bset:
        return 0.0
    inter = len(aset & bset)
    union = len(aset | bset)
    return inter / union if union else 0.0

RELATED_WEIGHTS = {"token": 0.48, "cooccurrence": 0.28, "attribute": 0.10, "top_terms_overlap": 0.14}


def compute_related_components(
    base_tag: str,
    other_tag: str,
    tag_vectors: Dict[str, Dict[str, float]],
    tag_to_articles: Dict[str, Set[int]],
    tag_attrs: Dict[str, Dict[str, Any]],
    top_terms_map: Dict[str, List[str]],
) -> Dict[str, float]:
    token_sim = cosine_sparse(tag_vectors.get(base_tag, {}), tag_vectors.get(other_tag, {}))
    cooc_sim = cooccurrence_similarity(tag_to_articles.get(base_tag, set()), tag_to_articles.get(other_tag, set()))
    attr_sim = attribute_similarity(tag_attrs.get(base_tag, {}), tag_attrs.get(other_tag, {}))
    # 仕様: 関連タグ選出では base_tag 以外の top_terms を必ず参照する。
    terms_sim = term_overlap_similarity(top_terms_map.get(base_tag, []), top_terms_map.get(other_tag, []))
    return {
        "token": token_sim,
        "cooccurrence": cooc_sim,
        "attribute": attr_sim,
        "top_terms_overlap": terms_sim,
    }


def compute_related_score(components: Dict[str, float]) -> float:
    return (
        RELATED_WEIGHTS["token"] * components["token"]
        + RELATED_WEIGHTS["cooccurrence"] * components["cooccurrence"]
        + RELATED_WEIGHTS["attribute"] * components["attribute"]
        + RELATED_WEIGHTS["top_terms_overlap"] * components["top_terms_overlap"]
    )


def build_related_row(
    base_tag: str,
    other_tag: str,
    tag_vectors: Dict[str, Dict[str, float]],
    tag_to_articles: Dict[str, Set[int]],
    tag_attrs: Dict[str, Dict[str, Any]],
    top_terms_map: Dict[str, List[str]],
) -> Dict[str, Any] | None:
    components = compute_related_components(
        base_tag=base_tag,
        other_tag=other_tag,
        tag_vectors=tag_vectors,
        tag_to_articles=tag_to_articles,
        tag_attrs=tag_attrs,
        top_terms_map=top_terms_map,
    )
    score = compute_related_score(components)
    if score <= 0:
        return None
    return {
        "tag": other_tag,
        "score": round(score, 6),
        "components": {k: round(v, 6) for k, v in components.items()},
        "article_count": len(tag_to_articles.get(other_tag, set())),
    }


def build_needs_review(tag_to_articles: Dict[str, Set[int]], tag_attributes: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    candidates = []
    for tag, article_ids in sorted(tag_to_articles.items(), key=lambda kv: (-len(kv[1]), kv[0])):
        if len(article_ids) < 2:
            continue
        attrs = tag_attributes.get(tag, {})
        if attrs:
            continue
        has_name_like = any(ch.isupper() for ch in tag) or any("ァ" <= ch <= "ヶ" for ch in tag) or any(ch.isdigit() for ch in tag)
        if has_name_like:
            candidates.append(
                {
                    "tag": tag,
                    "article_count": len(article_ids),
                    "suggested_fields": ["group", "series", "platforms"],
                    "reason": "高頻度タグだが metadata/tag_attributes.json に属性が未定義",
                }
            )
    return {"generated_at": now_iso(), "items": candidates[:200]}


def build_clusters(tag_scores: Dict[str, Dict[str, float]], threshold: float = 0.45) -> Dict[str, Any]:
    visited: Set[str] = set()
    clusters: List[Dict[str, Any]] = []
    tags = sorted(tag_scores.keys())

    for tag in tags:
        if tag in visited:
            continue
        stack = [tag]
        component: Set[str] = set()
        while stack:
            cur = stack.pop()
            if cur in visited:
                continue
            visited.add(cur)
            component.add(cur)
            for neighbor, score in tag_scores.get(cur, {}).items():
                if score >= threshold and neighbor not in visited:
                    stack.append(neighbor)
        members = sorted(component)
        if len(members) <= 1:
            continue
        clusters.append(
            {
                "cluster_id": f"cluster_{len(clusters)+1:03d}",
                "size": len(members),
                "tags": members,
            }
        )

    clusters.sort(key=lambda c: (-c["size"], c["cluster_id"]))
    return {"generated_at": now_iso(), "threshold": threshold, "clusters": clusters}


def _build_tag_to_articles_from_map(merged_tags_map: Dict[int, List[str]]) -> Dict[str, Set[int]]:
    tag_to_articles: Dict[str, Set[int]] = defaultdict(set)
    for article_id, tags in merged_tags_map.items():
        for tag in tags:
            if tag:
                tag_to_articles[tag].add(article_id)
    return tag_to_articles


def analyze_single_tag_fast(
    blog_dir: Path,
    merged_tags_map: Dict[int, List[str]],
    selected_tag: str,
    top_n: int,
    candidate_limit: int,
    max_articles: int,
    token_quality_judge: TokenQualityJudge,
) -> Dict[str, Any]:
    tag_to_articles = _build_tag_to_articles_from_map(merged_tags_map)
    if selected_tag not in tag_to_articles:
        return {
            "generated_at": now_iso(),
            "mode": "single_tag",
            "selected_tag": selected_tag,
            "sources": {
                "assigned_tags": str(ASSIGNED_TAGS_FILE),
                "tag_attributes": str(TAG_ATTRIBUTES_FILE),
            },
            "tags": {},
            "note": "selected_tag not found",
        }

    tag_attrs = load_tag_attributes(TAG_ATTRIBUTES_FILE)
    selected_articles = tag_to_articles[selected_tag]

    prelim_scores: List[Tuple[str, float]] = []
    for tag, articles in tag_to_articles.items():
        if tag == selected_tag:
            continue
        cooc_sim = cooccurrence_similarity(selected_articles, articles)
        attr_sim = attribute_similarity(tag_attrs.get(selected_tag, {}), tag_attrs.get(tag, {}))
        prelim = (0.85 * cooc_sim) + (0.15 * attr_sim)
        if prelim > 0:
            prelim_scores.append((tag, prelim))

    prelim_scores.sort(key=lambda x: (-x[1], x[0]))
    candidate_tags = [tag for tag, _ in prelim_scores[: max(1, candidate_limit)]]
    focused_tags = [selected_tag] + candidate_tags

    selected_sorted = sorted(tag_to_articles.get(selected_tag, set()), reverse=True)
    keep_selected_n = max(1, min(len(selected_sorted), max(300, max_articles // 2)))
    needed_article_ids: Set[int] = set(selected_sorted[:keep_selected_n])

    for tag in candidate_tags:
        for article_id in sorted(tag_to_articles.get(tag, set()), reverse=True):
            if article_id in needed_article_ids:
                continue
            needed_article_ids.add(article_id)
            if len(needed_article_ids) >= max_articles:
                break
        if len(needed_article_ids) >= max_articles:
            break

    focused_posts = load_posts_for_ids(blog_dir, needed_article_ids)
    article_token_map = {post.article_id: article_token_weights(post) for post in focused_posts}
    available_ids = set(article_token_map.keys())

    focused_tag_to_articles: Dict[str, Set[int]] = {}
    for tag in focused_tags:
        ids = tag_to_articles.get(tag, set()) & available_ids
        if ids:
            focused_tag_to_articles[tag] = ids

    tag_vectors = compute_tag_vectors(focused_tag_to_articles, article_token_map)
    top_terms_map = {
        tag: top_terms(tag_vectors.get(tag, {}), n=24, token_quality_judge=token_quality_judge)
        for tag in focused_tag_to_articles.keys()
    }

    related: List[Dict[str, Any]] = []
    for other in candidate_tags:
        if other not in focused_tag_to_articles:
            continue
        row = build_related_row(
            base_tag=selected_tag,
            other_tag=other,
            tag_vectors=tag_vectors,
            tag_to_articles=focused_tag_to_articles,
            tag_attrs=tag_attrs,
            top_terms_map=top_terms_map,
        )
        if row is not None:
            row["article_count"] = len(tag_to_articles.get(other, set()))
            related.append(row)

    related.sort(key=lambda x: (-x["score"], x["tag"]))

    return {
        "generated_at": now_iso(),
        "mode": "single_tag",
        "selected_tag": selected_tag,
        "fast_path": {
            "enabled": True,
            "candidate_limit": candidate_limit,
            "max_articles": max_articles,
            "candidate_count": len(candidate_tags),
            "selected_articles_total": len(tag_to_articles.get(selected_tag, set())),
            "focused_articles": len(needed_article_ids),
        },
        "sources": {
            "assigned_tags": str(ASSIGNED_TAGS_FILE),
            "tag_attributes": str(TAG_ATTRIBUTES_FILE),
        },
        "tags": {
            selected_tag: {
                "article_count": len(tag_to_articles[selected_tag]),
                "top_terms": top_terms_map.get(selected_tag, []),
                "related": related[:top_n],
            }
        },
    }


def analyze(
    posts,
    merged_tags_map: Dict[int, List[str]],
    selected_tag: str | None = None,
    top_n: int = 20,
    token_quality_judge: TokenQualityJudge | None = None,
) -> Dict[str, Any]:
    tag_to_articles, article_token_map = build_tag_inputs(posts, merged_tags_map)
    tag_vectors = compute_tag_vectors(tag_to_articles, article_token_map)
    tag_attrs = load_tag_attributes(TAG_ATTRIBUTES_FILE)
    tags = sorted(tag_to_articles.keys())
    top_terms_map = {
        tag: top_terms(tag_vectors.get(tag, {}), n=24, token_quality_judge=token_quality_judge)
        for tag in tags
    }

    output_tags: Dict[str, Any] = {}

    for tag in tags:
        if selected_tag and tag != selected_tag:
            continue
        related: List[Dict[str, Any]] = []
        for other in tags:
            if tag == other:
                continue
            row = build_related_row(
                base_tag=tag,
                other_tag=other,
                tag_vectors=tag_vectors,
                tag_to_articles=tag_to_articles,
                tag_attrs=tag_attrs,
                top_terms_map=top_terms_map,
            )
            if row is not None:
                related.append(row)
        related.sort(key=lambda x: (-x["score"], x["tag"]))
        output_tags[tag] = {
            "article_count": len(tag_to_articles[tag]),
            "top_terms": top_terms_map.get(tag, []),
            "related": related[:top_n],
        }

    if selected_tag:
        return {
            "generated_at": now_iso(),
            "mode": "single_tag",
            "selected_tag": selected_tag,
            "sources": {
                "assigned_tags": str(ASSIGNED_TAGS_FILE),
                "tag_attributes": str(TAG_ATTRIBUTES_FILE),
            },
            "tags": output_tags,
        }

    full_score_graph: Dict[str, Dict[str, float]] = {tag: {} for tag in tags}
    for tag in tags:
        for other in tags:
            if tag == other:
                continue
            components = compute_related_components(
                base_tag=tag,
                other_tag=other,
                tag_vectors=tag_vectors,
                tag_to_articles=tag_to_articles,
                tag_attrs=tag_attrs,
                top_terms_map=top_terms_map,
            )
            score = compute_related_score(components)
            if score > 0:
                full_score_graph[tag][other] = score

    ranked_tags = [
        {"tag": tag, "article_count": len(tag_to_articles[tag])}
        for tag in sorted(tags, key=lambda t: (-len(tag_to_articles[t]), t))
    ]

    return {
        "generated_at": now_iso(),
        "mode": "full",
        "weights": RELATED_WEIGHTS,
        "tags": output_tags,
        "ranked_tags": ranked_tags,
        "_internal": {
            "full_score_graph": full_score_graph,
            "needs_review": build_needs_review(tag_to_articles, tag_attrs),
        },
    }


def main() -> None:
    parser = parse_args_common(argparse.ArgumentParser(description="タグ関連度解析スクリプト"))
    parser.add_argument("--tag", help="指定タグ1件だけを解析して debug 出力する")
    parser.add_argument("--top-n", type=int, default=20, help="各タグの関連タグを何件出すか")
    parser.add_argument("--single-tag-candidate-limit", type=int, default=180, help="--tag 実行時の比較対象タグ上限")
    parser.add_argument("--single-tag-max-articles", type=int, default=1800, help="--tag 実行時に本文解析する記事数上限")
    parser.add_argument("--write-full", action="store_true", help="--tag 指定時でも tag_related_cloud.json を更新する")
    args = parser.parse_args()

    try:
        backend = configure_tokenizer(args.tokenizer)
    except RuntimeError as e:
        raise SystemExit(str(e))

    ensure_dirs()
    blog_dir = Path(args.blog_dir)

    dicdir = active_mecab_dicdir()
    if backend == "mecab":
        print(f"[tokenizer] backend={backend} dicdir={dicdir}")
    else:
        print(f"[tokenizer] backend={backend}")

    assigned = load_assigned_tag_overrides(ASSIGNED_TAGS_FILE)
    corrections = load_corrections()

    if args.tag and not args.write_full:
        metas = load_post_metas(blog_dir)
        merged_tags_map = apply_tag_overlays(metas, assigned, corrections)
        manual_tag_set: Set[str] = set()
        for tags in merged_tags_map.values():
            manual_tag_set.update(tags)
        token_quality_judge = TokenQualityJudge(manual_tag_set=manual_tag_set)
        result = analyze_single_tag_fast(
            blog_dir=blog_dir,
            merged_tags_map=merged_tags_map,
            selected_tag=args.tag,
            top_n=max(1, args.top_n),
            candidate_limit=max(30, args.single_tag_candidate_limit),
            max_articles=max(300, args.single_tag_max_articles),
            token_quality_judge=token_quality_judge,
        )
        debug_path = dump_debug_json(f"tag_analysis_{sanitize_filename(args.tag)}.json", result)
        print(f"[tag_analyze] single-tag result written: {debug_path}")
        written_labels = token_quality_judge.flush_label_updates()
        if written_labels > 0:
            print(f"[tag_analyze] auto observations updated: {written_labels}")
        return

    posts = load_posts(blog_dir)
    merged_tags_map = apply_tag_overlays(posts, assigned, corrections)
    manual_tag_set: Set[str] = set()
    for tags in merged_tags_map.values():
        manual_tag_set.update(tags)
    token_quality_judge = TokenQualityJudge(manual_tag_set=manual_tag_set)
    result = analyze(
        posts,
        merged_tags_map,
        selected_tag=args.tag,
        top_n=max(1, args.top_n),
        token_quality_judge=token_quality_judge,
    )

    if args.tag:
        debug_path = dump_debug_json(f"tag_analysis_{sanitize_filename(args.tag)}.json", result)
        print(f"[tag_analyze] single-tag result written: {debug_path}")
        if not args.write_full:
            return

    if result.get("mode") == "full":
        internal = result.pop("_internal", {})
        write_json(TAG_RELATED_CLOUD_FILE, result)
        write_json(TAG_CLUSTERS_FILE, build_clusters(internal.get("full_score_graph", {})))
        write_json(NEEDS_REVIEW_FILE, internal.get("needs_review", {"generated_at": now_iso(), "items": []}))
        print(f"[tag_analyze] wrote: {TAG_RELATED_CLOUD_FILE}")
        print(f"[tag_analyze] wrote: {TAG_CLUSTERS_FILE}")
        print(f"[tag_analyze] wrote: {NEEDS_REVIEW_FILE}")

    written_labels = token_quality_judge.flush_label_updates()
    if written_labels > 0:
        print(f"[tag_analyze] auto observations updated: {written_labels}")


if __name__ == "__main__":
    main()

from __future__ import annotations

import argparse
import datetime as dt
import importlib
import json
import math
import os
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

try:
    import yaml  # type: ignore
except Exception:
    yaml = None


ROOT_DIR = Path(__file__).resolve().parents[2]
LAB_TAG_DIR = ROOT_DIR / "labs" / "tag"
BLOG_DIR = ROOT_DIR / "blog"
OUTPUT_DIR = ROOT_DIR / "labs" / "tag" / "outputs"
METADATA_DIR = LAB_TAG_DIR / "metadata"
LEGACY_METADATA_DIR = OUTPUT_DIR / "metadata"
FEEDBACK_DIR = OUTPUT_DIR / "feedback"
CACHE_DIR = OUTPUT_DIR / "cache"
DEBUG_DIR = OUTPUT_DIR / "debug"
REPORTS_DIR = OUTPUT_DIR / "reports"
TOKEN_RULES_FILE = METADATA_DIR / "token_quality_rules.json"
TOKEN_ABSTRACTNESS_MODEL_FILE = METADATA_DIR / "token_abstractness_model.pkl"
TOKEN_ABSTRACTNESS_LABELS_FILE = METADATA_DIR / "token_abstractness_labels.jsonl"
TOKEN_ABSTRACTNESS_OBSERVATIONS_FILE = METADATA_DIR / "token_abstractness_observations.jsonl"

ASSIGNED_TAGS_FILE = OUTPUT_DIR / "assigned_tags.jsonl"
CORRECTIONS_FILE = FEEDBACK_DIR / "corrections.jsonl"
TAG_ATTRIBUTES_FILE = METADATA_DIR / "tag_attributes.json"
NEEDS_REVIEW_FILE = METADATA_DIR / "needs_review.json"
TAG_RELATED_CLOUD_FILE = OUTPUT_DIR / "tag_related_cloud.json"
TAG_CLUSTERS_FILE = OUTPUT_DIR / "tag_clusters.json"

IGNORE_BLOG_FOLDERS = {".obsidian", "keyword"}
TOKEN_RE = re.compile(r"[一-龠々ぁ-んァ-ヶーA-Za-z0-9_]{2,}")
SENTENCE_SPLIT_RE = re.compile(r"(?<=[。．！？!?])\s+|\n")
ARTICLE_ID_RE = re.compile(r"/(\d{4})-(\d{2})-(\d{2})-(\d+)\.md$")
HIRAGANA_ONLY_RE = re.compile(r"^[ぁ-んー]+$")
HAS_KANJI_RE = re.compile(r"[一-龠々]")
HAS_KATAKANA_RE = re.compile(r"[ァ-ヶー]")
HAS_LATIN_RE = re.compile(r"[A-Za-z]")
HAS_DIGIT_RE = re.compile(r"[0-9０-９〇零一二三四五六七八九十百千万億兆]")
NUMERIC_CHARS_RE = re.compile(r"^[0-9０-９〇零一二三四五六七八九十百千万億兆,，\.．\-ー]+$")
COMPOUND_SPLIT_RE = re.compile(r"(?:という|として|について|における|から|まで|より|ので|ため|の|が|を|に|で|と|へ|や|も|は)")
INVALID_ENDINGS = (
    "でした", "ます", "した", "して", "する", "され", "れる", "られる", "ない", "たい", "っぽい", "そう",
    "ため", "こと", "もの", "から", "ので", "だが", "でも", "です",
)
STOPWORDS = {
    "こと", "もの", "ため", "これ", "それ", "あれ", "よう", "さん", "する", "した", "して",
    "いる", "なる", "ある", "ない", "ます", "です", "という", "また", "その", "この", "ので",
    "から", "まで", "より", "では", "できる", "でき", "思う", "今回", "記事", "自分",
    "みたい", "かなり", "とても", "として", "について", "そして", "つまり", "だから", "だからこそ",
    "でも", "しかし", "ただし", "なお", "または", "および", "そして", "けれど", "それでも",
}

DEFAULT_COUNTER_SUFFIXES = [
    "年", "月", "日", "時", "分", "秒",
    "回", "件", "個", "人", "名", "台", "枚", "本", "冊", "社", "校",
    "歳", "才", "週", "期", "章", "話", "行", "列",
    "円", "千円", "万円", "億円", "兆円", "%", "％", "倍", "割",
]
DEFAULT_ABSTRACT_SUFFIXES = ["性", "化", "感", "度", "率", "力", "論", "観", "的", "性質", "関係", "可能性"]
DEFAULT_TOKEN_QUALITY_RULES: Dict[str, Any] = {
    "manual_tag_exempt": True,
    "hard_blocklist": ["今日", "時間", "必要", "問題"],
    "allowlist": ["会社"],
    "counter_suffixes": DEFAULT_COUNTER_SUFFIXES,
    "abstract_suffixes": DEFAULT_ABSTRACT_SUFFIXES,
    "numeric_patterns": [
        r"^[0０]+(?:年|月|日)$",
        r"^[0-9０-９〇零一二三四五六七八九十百千万億兆,，\.．\-ー]+$",
        r"^[0-9０-９〇零一二三四五六七八九十百千万億兆,，\.．\-ー]+(?:年|月|日|時|分|秒|回|件|個|人|名|台|枚|本|冊|社|校|歳|才|週|期|章|話|行|列|円|千円|万円|億円|兆円|％|%|倍|割)$",
    ],
    "thresholds": {"hard_abstract": 0.88, "soft_abstract": 0.72},
    "auto_observation": {
        "max_entries": 20000,
        "min_confidence": 0.40
    },
}

_ACTIVE_TOKENIZER_BACKEND = "regex"
_ACTIVE_MECAB_DICDIR: Optional[str] = None
_FUGASHI_TAGGER = None
_JANOME_TOKENIZER = None
NEOLOGD_ENV_VAR = "MECAB_NEOLOGD_DICDIR"


@dataclass
class PostRecord:
    article_id: int
    file_path: Path
    rel_path: str
    title: str
    date: str
    tags: List[str]
    content: str
    segments: List[str]


@dataclass
class PostMeta:
    article_id: int
    file_path: Path
    rel_path: str
    title: str
    date: str
    tags: List[str]


def now_iso() -> str:
    return dt.datetime.now().isoformat(timespec="seconds")


def ensure_dirs() -> None:
    for d in [OUTPUT_DIR, METADATA_DIR, FEEDBACK_DIR, CACHE_DIR, DEBUG_DIR, REPORTS_DIR]:
        d.mkdir(parents=True, exist_ok=True)
    _migrate_legacy_metadata_files()


def _migrate_legacy_metadata_files() -> None:
    # 旧 outputs/metadata から metadata へ、未移行ファイルだけコピーする。
    if not LEGACY_METADATA_DIR.exists():
        return
    for name in ("tag_attributes.json", "needs_review.json"):
        src = LEGACY_METADATA_DIR / name
        dst = METADATA_DIR / name
        if src.exists() and not dst.exists():
            try:
                dst.write_text(src.read_text(encoding="utf-8"), encoding="utf-8")
            except Exception:
                continue


def parse_args_common(parser: argparse.ArgumentParser) -> argparse.ArgumentParser:
    parser.add_argument("--blog-dir", default=str(BLOG_DIR), help="ブログ本文ディレクトリ")
    parser.add_argument("--output-dir", default=str(OUTPUT_DIR), help="出力ディレクトリ")
    parser.add_argument("--tokenizer", choices=["auto", "mecab", "janome", "regex"], default="auto", help="単語分割エンジン")
    return parser


def list_blog_markdown_files(blog_dir: Path) -> List[Path]:
    files: List[Path] = []
    for p in sorted(blog_dir.rglob("*.md")):
        if p.parent == blog_dir:
            continue
        if any(part in IGNORE_BLOG_FOLDERS for part in p.relative_to(blog_dir).parts):
            continue
        files.append(p)
    return files


def parse_front_matter(text: str) -> Tuple[Dict[str, Any], str]:
    if not text.startswith("---\n"):
        return {}, text
    end = text.find("\n---", 4)
    if end == -1:
        return {}, text
    raw = text[4:end]
    body_start = end + 4
    if body_start < len(text) and text[body_start] == "\n":
        body_start += 1
    return parse_yaml_like(raw), text[body_start:]


def parse_yaml_like(raw: str) -> Dict[str, Any]:
    if yaml is not None:
        try:
            loaded = yaml.safe_load(raw)
            return loaded if isinstance(loaded, dict) else {}
        except Exception:
            pass

    result: Dict[str, Any] = {}
    lines = raw.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i]
        if not line.strip() or line.lstrip().startswith("#") or ":" not in line:
            i += 1
            continue
        key, rest = line.split(":", 1)
        key = key.strip()
        value = rest.strip()
        if not key:
            i += 1
            continue
        if value == "":
            items: List[str] = []
            j = i + 1
            while j < len(lines):
                nxt = lines[j]
                if nxt.startswith("  - ") or nxt.startswith("- "):
                    items.append(nxt.split("-", 1)[1].strip().strip("'\""))
                    j += 1
                    continue
                if nxt.startswith(" "):
                    j += 1
                    continue
                break
            result[key] = [x for x in items if x] if items else ""
            i = j if items else i + 1
            continue
        if value.startswith("[") and value.endswith("]"):
            inner = value[1:-1].strip()
            result[key] = [x.strip().strip("'\"") for x in inner.split(",") if x.strip()] if inner else []
        else:
            result[key] = value.strip().strip("'\"")
        i += 1
    return result


def parse_article_id_from_path(rel_path: str) -> Optional[int]:
    normalized = rel_path.replace("\\", "/")
    m = ARTICLE_ID_RE.search(normalized)
    if m:
        return int(m.group(4))
    m2 = re.search(r"-(\d+)\.md$", normalized)
    return int(m2.group(1)) if m2 else None


def normalize_tags(value: Any) -> List[str]:
    if isinstance(value, list):
        return sorted({str(v).strip() for v in value if str(v).strip()})
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    return []


def split_segments(content: str) -> List[str]:
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n+", content) if p.strip()]
    segments: List[str] = []
    for p in paragraphs:
        if len(p) < 120:
            segments.append(p)
            continue
        for s in SENTENCE_SPLIT_RE.split(p):
            s = s.strip()
            if len(s) >= 20:
                segments.append(s)
    if not segments:
        compact = " ".join(content.split())
        if compact:
            segments = [compact]
    return segments


def configure_tokenizer(mode: str) -> str:
    global _ACTIVE_TOKENIZER_BACKEND
    _ACTIVE_TOKENIZER_BACKEND = _detect_tokenizer_backend(mode)
    return _ACTIVE_TOKENIZER_BACKEND


def active_tokenizer_backend() -> str:
    # configure_tokenizer() で確定したバックエンドをそのまま使う。
    # 呼び出し毎の再検出は高コストで、特に auto+regex で極端に遅くなる。
    return _ACTIVE_TOKENIZER_BACKEND


def active_mecab_dicdir() -> Optional[str]:
    return _ACTIVE_MECAB_DICDIR


def _detect_tokenizer_backend(mode: str) -> str:
    preferred = mode or "auto"
    if preferred == "mecab":
        if not _ensure_fugashi(require_neologd=True):
            raise RuntimeError(
                "tokenizer=mecab には mecab-ipadic-neologd が必要です。"
                f" 環境変数 {NEOLOGD_ENV_VAR} かシステム辞書パスを確認してください。"
            )
        return "mecab"
    if preferred == "auto":
        if _ensure_fugashi(require_neologd=True):
            return "mecab"
    if preferred in ("auto", "janome") and _ensure_janome():
        return "janome"
    return "regex"


def _ensure_fugashi(require_neologd: bool = False) -> bool:
    global _FUGASHI_TAGGER, _ACTIVE_MECAB_DICDIR
    if _FUGASHI_TAGGER is not None:
        if require_neologd and not _ACTIVE_MECAB_DICDIR:
            return False
        return True

    dicdir = _resolve_neologd_dicdir()
    if not dicdir:
        return False

    try:
        mod = importlib.import_module("fugashi")
        try:
            _FUGASHI_TAGGER = mod.Tagger(f"-d {dicdir}")
        except Exception:
            # ipadic/neologd など Unidic 以外の辞書は GenericTagger を使う
            _FUGASHI_TAGGER = mod.GenericTagger(f"-d {dicdir}")
        _ACTIVE_MECAB_DICDIR = dicdir
        return True
    except Exception:
        _FUGASHI_TAGGER = None
        _ACTIVE_MECAB_DICDIR = None
        return False


def _resolve_neologd_dicdir() -> Optional[str]:
    env_path = os.environ.get(NEOLOGD_ENV_VAR, "").strip()
    if env_path and _is_valid_mecab_dicdir(Path(env_path)):
        return env_path

    candidates: List[Path] = []
    mecab_dicdir = _mecab_config_dicdir()
    if mecab_dicdir:
        candidates.append(Path(mecab_dicdir) / "mecab-ipadic-neologd")

    candidates.extend(
        [
            Path("/usr/local/lib/mecab/dic/mecab-ipadic-neologd"),
            Path("/opt/homebrew/lib/mecab/dic/mecab-ipadic-neologd"),
            Path("/usr/lib/mecab/dic/mecab-ipadic-neologd"),
            Path("/usr/lib/x86_64-linux-gnu/mecab/dic/mecab-ipadic-neologd"),
        ]
    )

    for cand in candidates:
        if _is_valid_mecab_dicdir(cand):
            return str(cand)
    return None


def _mecab_config_dicdir() -> Optional[str]:
    try:
        proc = subprocess.run(
            ["mecab-config", "--dicdir"],
            check=True,
            capture_output=True,
            text=True,
        )
        path = proc.stdout.strip()
        return path or None
    except Exception:
        return None


def _is_valid_mecab_dicdir(path: Path) -> bool:
    if not path.exists() or not path.is_dir():
        return False
    required = ["sys.dic", "char.bin", "matrix.bin", "dicrc"]
    return all((path / name).exists() for name in required)


def _ensure_janome() -> bool:
    global _JANOME_TOKENIZER
    if _JANOME_TOKENIZER is not None:
        return True
    try:
        mod = importlib.import_module("janome.tokenizer")
        _JANOME_TOKENIZER = mod.Tokenizer()
        return True
    except Exception:
        return False


def _tokenize_mecab(text: str) -> List[str]:
    if not _ensure_fugashi():
        return []
    pieces: List[Tuple[str, str]] = []
    for w in _FUGASHI_TAGGER(text):
        surface = str(getattr(w, "surface", "")).strip()
        if not surface:
            continue
        pos1 = ""
        feat = getattr(w, "feature", None)
        if feat is not None:
            if hasattr(feat, "pos1"):
                pos1 = str(getattr(feat, "pos1", ""))
            elif isinstance(feat, (list, tuple)) and feat:
                pos1 = str(feat[0])
            else:
                pos1 = str(feat).split(",", 1)[0]
        pieces.append((surface, pos1))
    return _merge_compound_nouns(pieces)


def _tokenize_janome(text: str) -> List[str]:
    if not _ensure_janome():
        return []
    pieces: List[Tuple[str, str]] = []
    for token in _JANOME_TOKENIZER.tokenize(text):
        surface = str(getattr(token, "surface", "")).strip()
        if not surface:
            continue
        pos = str(getattr(token, "part_of_speech", ""))
        pos1 = pos.split(",", 1)[0] if pos else ""
        pieces.append((surface, pos1))
    return _merge_compound_nouns(pieces)


def _merge_compound_nouns(pieces: List[Tuple[str, str]]) -> List[str]:
    merged: List[str] = []
    i = 0
    while i < len(pieces):
        token, pos = pieces[i]
        if _is_joinable_piece(token, pos):
            seq = [token]
            j = i + 1
            while j < len(pieces) and _is_joinable_piece(pieces[j][0], pieces[j][1]):
                seq.append(pieces[j][0])
                j += 1
            merged_token = _join_sequence(seq)
            if is_noun_like_token(merged_token, strict=True):
                merged.append(merged_token.lower())
            elif len(seq) == 1 and is_noun_like_token(seq[0], strict=True):
                merged.append(seq[0].lower())
            i = j
            continue
        i += 1
    return merged


def _is_joinable_piece(token: str, pos1: str) -> bool:
    if not token:
        return False
    if pos1 == "名詞":
        return True
    if re.fullmatch(r"[A-Za-z0-9]+", token):
        return True
    return False


def _join_sequence(seq: List[str]) -> str:
    if not seq:
        return ""
    out = seq[0]
    for nxt in seq[1:]:
        if re.fullmatch(r"[A-Za-z0-9]+", out[-1:]) and re.fullmatch(r"[A-Za-z0-9]+", nxt[:1]):
            out += " " + nxt
        else:
            out += nxt
    return out


def is_noun_like_token(token: str, strict: bool = False) -> bool:
    t = token.strip().lower()
    if len(t) < 2:
        return False
    if t.isdigit() or t in STOPWORDS:
        return False
    if any(t.endswith(suffix) for suffix in INVALID_ENDINGS):
        return False
    if HIRAGANA_ONLY_RE.match(t):
        return False

    looks_content_word = bool(HAS_KANJI_RE.search(t) or HAS_KATAKANA_RE.search(t) or HAS_LATIN_RE.search(t))
    if not looks_content_word:
        return False

    if strict:
        if HAS_LATIN_RE.search(t) and len(t) < 3:
            return False
        if len(t) > 14:
            return False
        hira_count = len(re.findall(r"[ぁ-ん]", t))
        content_count = len(re.findall(r"[一-龠々ァ-ヶーA-Za-z0-9]", t))
        if hira_count >= max(2, content_count):
            return False
        if any(marker in t for marker in ("という", "ので", "から", "ため", "でした", "ます", "こと", "もの")):
            return False
    return True


@dataclass
class TokenQualityDecision:
    allow: bool
    reason: str
    abstractness_score: float = 0.0


def _merge_rules(base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
    merged = dict(base)
    for key, value in override.items():
        if key == "thresholds" and isinstance(value, dict):
            thresholds = dict(base.get("thresholds", {}))
            thresholds.update(value)
            merged[key] = thresholds
        else:
            merged[key] = value
    return merged


def load_token_quality_rules(path: Path = TOKEN_RULES_FILE) -> Dict[str, Any]:
    rules = dict(DEFAULT_TOKEN_QUALITY_RULES)
    if not path.exists():
        return rules
    loaded = load_json(path, {})
    if not isinstance(loaded, dict):
        return rules
    return _merge_rules(rules, loaded)


def _build_counter_suffix_re(counter_suffixes: List[str]) -> re.Pattern[str]:
    ordered = sorted({s for s in counter_suffixes if isinstance(s, str) and s}, key=len, reverse=True)
    if not ordered:
        ordered = sorted(DEFAULT_COUNTER_SUFFIXES, key=len, reverse=True)
    body = "|".join(re.escape(s) for s in ordered)
    return re.compile(
        rf"^[0-9０-９〇零一二三四五六七八九十百千万億兆,，\.．\-ー]+(?:{body})$"
    )


def _try_load_abstractness_model(model_path: Path):
    if not model_path.exists():
        return None
    try:
        import joblib  # type: ignore

        return joblib.load(model_path)
    except Exception:
        return None


class TokenQualityJudge:
    def __init__(
        self,
        rules_path: Path = TOKEN_RULES_FILE,
        model_path: Path = TOKEN_ABSTRACTNESS_MODEL_FILE,
        labels_path: Path = TOKEN_ABSTRACTNESS_LABELS_FILE,
        observations_path: Path = TOKEN_ABSTRACTNESS_OBSERVATIONS_FILE,
        manual_tag_set: Optional[set[str]] = None,
        auto_write_labels: bool = True,
    ) -> None:
        self.rules = load_token_quality_rules(rules_path)
        self.manual_tag_set = {t.strip().lower() for t in (manual_tag_set or set()) if t and t.strip()}
        self.allowlist = {str(t).strip().lower() for t in self.rules.get("allowlist", []) if str(t).strip()}
        self.hard_blocklist = {str(t).strip().lower() for t in self.rules.get("hard_blocklist", []) if str(t).strip()}
        self.abstract_suffixes = tuple(
            sorted({str(t).strip().lower() for t in self.rules.get("abstract_suffixes", []) if str(t).strip()}, key=len, reverse=True)
        )
        self.numeric_patterns = [
            re.compile(p)
            for p in self.rules.get("numeric_patterns", [])
            if isinstance(p, str) and p.strip()
        ]
        self.counter_suffix_re = _build_counter_suffix_re(list(self.rules.get("counter_suffixes", DEFAULT_COUNTER_SUFFIXES)))
        th = self.rules.get("thresholds", {}) if isinstance(self.rules.get("thresholds"), dict) else {}
        self.hard_abstract_threshold = float(th.get("hard_abstract", 0.88))
        self.soft_abstract_threshold = float(th.get("soft_abstract", 0.72))
        self.manual_tag_exempt = bool(self.rules.get("manual_tag_exempt", True))
        obs_cfg = self.rules.get("auto_observation", {}) if isinstance(self.rules.get("auto_observation"), dict) else {}
        self.auto_obs_max_entries = int(obs_cfg.get("max_entries", 20000))
        self.auto_obs_min_confidence = float(obs_cfg.get("min_confidence", 0.40))

        self.model = _try_load_abstractness_model(model_path)
        self.labels_path = labels_path
        self.observations_path = observations_path
        self.auto_write_labels = auto_write_labels
        self._pending_obs_updates: Dict[str, Dict[str, Any]] = {}
        self._manual_label_map = self._load_manual_label_map()

    def evaluate(
        self,
        token: str,
        *,
        idf: Optional[float] = None,
        doc_count: Optional[int] = None,
        enforce_abstract: bool = True,
    ) -> TokenQualityDecision:
        t = token.strip().lower()
        if not t:
            decision = TokenQualityDecision(allow=False, reason="empty")
            self._record_decision(t, decision)
            return decision

        if self.manual_tag_exempt and t in self.manual_tag_set:
            decision = TokenQualityDecision(allow=True, reason="manual_tag_exempt")
            self._record_decision(t, decision)
            return decision
        if t in self.allowlist:
            decision = TokenQualityDecision(allow=True, reason="allowlist")
            self._record_decision(t, decision)
            return decision
        if t in self.hard_blocklist:
            decision = TokenQualityDecision(allow=False, reason="hard_blocklist")
            self._record_decision(t, decision)
            return decision
        if self._is_numeric_noise(t):
            decision = TokenQualityDecision(allow=False, reason="numeric_noise")
            self._record_decision(t, decision)
            return decision

        explicit_label = self._manual_label_map.get(t)
        if explicit_label == 1:
            decision = TokenQualityDecision(allow=False, reason="labeled_abstract", abstractness_score=1.0)
            self._record_decision(t, decision)
            return decision
        if explicit_label == 0:
            decision = TokenQualityDecision(allow=True, reason="labeled_concrete", abstractness_score=0.0)
            self._record_decision(t, decision)
            return decision

        if not enforce_abstract:
            decision = TokenQualityDecision(allow=True, reason="pass")
            self._record_decision(t, decision)
            return decision

        score = self.estimate_abstractness(t, idf=idf, doc_count=doc_count)
        if score >= self.hard_abstract_threshold:
            decision = TokenQualityDecision(allow=False, reason="abstract_high", abstractness_score=score)
            self._record_decision(t, decision)
            return decision
        if score >= self.soft_abstract_threshold:
            decision = TokenQualityDecision(allow=False, reason="abstract_gray", abstractness_score=score)
            self._record_decision(t, decision)
            return decision
        decision = TokenQualityDecision(allow=True, reason="pass", abstractness_score=score)
        self._record_decision(t, decision)
        return decision

    def estimate_abstractness(self, token: str, *, idf: Optional[float] = None, doc_count: Optional[int] = None) -> float:
        t = token.strip().lower()
        heuristic = 0.0

        if any(t.endswith(s) for s in self.abstract_suffixes):
            heuristic += 0.35
        if HAS_KANJI_RE.search(t) and len(t) <= 2:
            heuristic += 0.10

        if idf is not None and doc_count and doc_count > 0:
            try:
                est_df = ((1.0 + doc_count) / math.exp(max(0.0, idf - 1.0))) - 1.0
                ratio = max(0.0, min(1.0, est_df / float(doc_count)))
                if ratio >= 0.30:
                    heuristic += 0.25
                elif ratio >= 0.15:
                    heuristic += 0.15
            except Exception:
                pass

        heuristic = max(0.0, min(1.0, heuristic))
        ml_score = self._predict_ml_score(t)
        if ml_score is None:
            return heuristic
        return max(0.0, min(1.0, (0.65 * ml_score) + (0.35 * heuristic)))

    def _predict_ml_score(self, token: str) -> Optional[float]:
        if self.model is None:
            return None
        try:
            if hasattr(self.model, "predict_proba"):
                probs = self.model.predict_proba([token])
                if probs is not None and len(probs) > 0 and len(probs[0]) >= 2:
                    return float(probs[0][1])
            if hasattr(self.model, "decision_function"):
                score = float(self.model.decision_function([token])[0])
                return 1.0 / (1.0 + math.exp(-score))
        except Exception:
            return None
        return None

    def _is_numeric_noise(self, token: str) -> bool:
        if token in {"0日", "0月", "0年", "０日", "０月", "０年"}:
            return True
        if any(pat.fullmatch(token) for pat in self.numeric_patterns):
            return True
        if self.counter_suffix_re.fullmatch(token):
            return True
        if NUMERIC_CHARS_RE.fullmatch(token):
            return True
        if HAS_DIGIT_RE.search(token) and not HAS_LATIN_RE.search(token) and self.counter_suffix_re.fullmatch(token):
            return True
        return False

    def _normalize_label_value(self, value: Any) -> Optional[int]:
        if value in (1, "1", True, "abstract"):
            return 1
        if value in (0, "0", False, "concrete"):
            return 0
        return None

    def _load_manual_label_map(self) -> Dict[str, int]:
        rows = read_jsonl(self.labels_path)
        out: Dict[str, int] = {}
        for row in rows:
            token = str(row.get("token", "")).strip().lower()
            if not token:
                continue
            label = self._normalize_label_value(row.get("label"))
            if label is None:
                continue
            source = str(row.get("source", "")).strip().lower()
            auto = bool(row.get("auto_generated", False))
            manual_flag = bool(row.get("manual", False))
            # 手動確定ラベルのみを一次ソースにする。
            if auto or source in {"auto", "migrated_rule", "auto_legacy"}:
                continue
            if not (manual_flag or source in {"manual", "human", "seed"}):
                continue
            out[token] = label
        return out

    def _decision_confidence(self, decision: TokenQualityDecision) -> float:
        if decision.reason in {"hard_blocklist", "allowlist", "labeled_abstract", "labeled_concrete"}:
            return 1.0
        if decision.abstractness_score <= 0.0:
            return 0.0
        return max(0.0, min(1.0, abs(decision.abstractness_score - 0.5) * 2.0))

    def _vote_key(self, decision: TokenQualityDecision) -> str:
        if decision.reason in {"hard_blocklist", "labeled_abstract", "abstract_high"}:
            return "a"
        if decision.reason in {"allowlist", "labeled_concrete", "pass"}:
            return "c"
        if decision.reason in {"abstract_gray"}:
            return "u"
        return "u"

    def _should_record_observation(self, token: str, decision: TokenQualityDecision, confidence: float) -> bool:
        if len(token) < 2 or len(token) > 24:
            return False
        if decision.reason in {"numeric_noise", "manual_tag_exempt", "empty"}:
            return False
        if confidence < self.auto_obs_min_confidence and decision.reason in {"pass", "abstract_gray", "abstract_high"}:
            return False
        return True

    def _record_decision(self, token: str, decision: TokenQualityDecision) -> None:
        if not self.auto_write_labels or not token:
            return

        confidence = self._decision_confidence(decision)
        if not self._should_record_observation(token, decision, confidence):
            return

        vote_key = self._vote_key(decision)
        cur = self._pending_obs_updates.get(token)
        if cur is None:
            cur = {
                "t": token,
                "a": 0,
                "c": 0,
                "u": 0,
                "n": 0,
                "cs": 0.0,
                "lr": decision.reason,
                "ua": now_iso(),
            }
            self._pending_obs_updates[token] = cur

        cur[vote_key] = int(cur.get(vote_key, 0)) + 1
        cur["n"] = int(cur.get("n", 0)) + 1
        cur["cs"] = float(cur.get("cs", 0.0)) + confidence
        cur["lr"] = decision.reason
        cur["ua"] = now_iso()

    def _compact_observation_row(self, row: Dict[str, Any]) -> Dict[str, Any]:
        token = str(row.get("t", row.get("token", ""))).strip().lower()
        if not token:
            return row
        a = max(0, int(row.get("a", 0)))
        c = max(0, int(row.get("c", 0)))
        u = max(0, int(row.get("u", 0)))
        n = max(1, int(row.get("n", max(1, a + c + u))))
        cs = float(row.get("cs", row.get("confidence", 0.0) * n))
        lr = str(row.get("lr", row.get("reason", ""))).strip().lower() or "unknown"
        ua = str(row.get("ua", row.get("updated_at", now_iso())))
        return {
            "t": token,
            "a": a,
            "c": c,
            "u": u,
            "n": n,
            "cs": round(cs, 6),
            "lr": lr,
            "ua": ua,
        }

    def _prune_observation_rows(self, rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if self.auto_obs_max_entries <= 0 or len(rows) <= self.auto_obs_max_entries:
            return rows
        rows.sort(
            key=lambda r: (
                -int(r.get("n", 0)),
                -float(r.get("cs", 0.0)),
                str(r.get("t", "")),
            )
        )
        return rows[: self.auto_obs_max_entries]

    def flush_label_updates(self) -> int:
        if not self.auto_write_labels or not self._pending_obs_updates:
            return 0

        path = self.observations_path
        path.parent.mkdir(parents=True, exist_ok=True)
        rows = read_jsonl(path)

        by_token: Dict[str, Dict[str, Any]] = {}
        order: List[str] = []
        for row in rows:
            compact = self._compact_observation_row(dict(row))
            token = str(compact.get("t", "")).strip().lower()
            if not token:
                continue
            if token not in by_token:
                by_token[token] = compact
                order.append(token)

        updated = 0
        for token, delta in self._pending_obs_updates.items():
            prev = by_token.get(token)
            if prev is None:
                by_token[token] = self._compact_observation_row(dict(delta))
                order.append(token)
                updated += 1
                continue

            merged = {
                "t": token,
                "a": int(prev.get("a", 0)) + int(delta.get("a", 0)),
                "c": int(prev.get("c", 0)) + int(delta.get("c", 0)),
                "u": int(prev.get("u", 0)) + int(delta.get("u", 0)),
                "n": int(prev.get("n", 0)) + int(delta.get("n", 0)),
                "cs": float(prev.get("cs", 0.0)) + float(delta.get("cs", 0.0)),
                "lr": str(delta.get("lr", prev.get("lr", "unknown"))),
                "ua": str(delta.get("ua", now_iso())),
            }
            by_token[token] = self._compact_observation_row(merged)
            updated += 1

        output_rows = [by_token[token] for token in order if token in by_token]
        output_rows = self._prune_observation_rows(output_rows)
        write_jsonl(path, output_rows)
        self._pending_obs_updates.clear()
        return updated



def _split_compound_token(token: str) -> List[str]:
    parts = [p for p in COMPOUND_SPLIT_RE.split(token) if p]
    if not parts:
        return [token]
    out: List[str] = []
    for part in parts:
        # ひらがなに偏る接辞を外す
        core = part.strip("ー")
        if core:
            out.append(core)
    return out or [token]


def tokenize_ja(text: str) -> List[str]:
    backend = active_tokenizer_backend()
    if backend == "mecab":
        return _tokenize_mecab(text)
    if backend == "janome":
        return _tokenize_janome(text)

    tokens: List[str] = []
    for raw in [m.group(0).lower() for m in TOKEN_RE.finditer(text)]:
        for token in _split_compound_token(raw):
            if is_noun_like_token(token, strict=True):
                tokens.append(token)
    return tokens


def load_post_metas(blog_dir: Path) -> List[PostMeta]:
    metas: List[PostMeta] = []
    for path in list_blog_markdown_files(blog_dir):
        rel_path = str(path.relative_to(blog_dir))
        article_id = parse_article_id_from_path(rel_path)
        if article_id is None:
            continue
        front, _ = parse_front_matter(path.read_text(encoding="utf-8"))
        metas.append(
            PostMeta(
                article_id=article_id,
                file_path=path,
                rel_path=rel_path,
                title=str(front.get("title", rel_path)).strip() or rel_path,
                date=str(front.get("date", "")).strip(),
                tags=normalize_tags(front.get("tags")),
            )
        )
    metas.sort(key=lambda p: p.article_id)
    return metas


def load_posts_for_ids(blog_dir: Path, article_ids: set[int]) -> List[PostRecord]:
    if not article_ids:
        return []
    posts: List[PostRecord] = []
    for path in list_blog_markdown_files(blog_dir):
        rel_path = str(path.relative_to(blog_dir))
        article_id = parse_article_id_from_path(rel_path)
        if article_id is None or article_id not in article_ids:
            continue
        front, content = parse_front_matter(path.read_text(encoding="utf-8"))
        posts.append(
            PostRecord(
                article_id=article_id,
                file_path=path,
                rel_path=rel_path,
                title=str(front.get("title", rel_path)).strip() or rel_path,
                date=str(front.get("date", "")).strip(),
                tags=normalize_tags(front.get("tags")),
                content=content,
                segments=split_segments(content),
            )
        )
    posts.sort(key=lambda p: p.article_id)
    return posts


def load_posts(blog_dir: Path) -> List[PostRecord]:
    posts: List[PostRecord] = []
    for path in list_blog_markdown_files(blog_dir):
        rel_path = str(path.relative_to(blog_dir))
        article_id = parse_article_id_from_path(rel_path)
        if article_id is None:
            continue
        front, content = parse_front_matter(path.read_text(encoding="utf-8"))
        posts.append(
            PostRecord(
                article_id=article_id,
                file_path=path,
                rel_path=rel_path,
                title=str(front.get("title", rel_path)).strip() or rel_path,
                date=str(front.get("date", "")).strip(),
                tags=normalize_tags(front.get("tags")),
                content=content,
                segments=split_segments(content),
            )
        )
    posts.sort(key=lambda p: p.article_id)
    return posts


def load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def read_jsonl(path: Path) -> List[Dict[str, Any]]:
    if not path.exists():
        return []
    rows: List[Dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(obj, dict):
            rows.append(obj)
    return rows


def write_jsonl(path: Path, rows: Iterable[Dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")


def load_assigned_tag_overrides(path: Path = ASSIGNED_TAGS_FILE) -> Dict[int, List[str]]:
    latest: Dict[int, List[str]] = {}
    for row in read_jsonl(path):
        try:
            article_id = int(row.get("article_id"))
        except Exception:
            continue
        latest[article_id] = normalize_tags(row.get("tags"))
    return latest


def load_corrections(path: Path = CORRECTIONS_FILE) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for row in read_jsonl(path):
        try:
            article_id = int(row.get("article_id"))
        except Exception:
            continue
        add = normalize_tags(row.get("add", []))
        remove = normalize_tags(row.get("remove", []))
        if not add and not remove:
            continue
        out.append(
            {
                "article_id": article_id,
                "add": add,
                "remove": remove,
                "note": str(row.get("note", "")),
                "source": str(row.get("source", "")),
                "updated_at": str(row.get("updated_at", "")),
            }
        )
    return out


def apply_tag_overlays(posts: List[PostRecord], assigned: Dict[int, List[str]], corrections: List[Dict[str, Any]]) -> Dict[int, List[str]]:
    merged: Dict[int, set[str]] = {p.article_id: set(p.tags) for p in posts}
    for article_id, tags in assigned.items():
        merged.setdefault(article_id, set()).update(tags)
    for row in corrections:
        bucket = merged.setdefault(row["article_id"], set())
        for t in row["remove"]:
            bucket.discard(t)
        for t in row["add"]:
            bucket.add(t)
    return {k: sorted(v) for k, v in merged.items()}


def build_article_index(posts: List[PostRecord]) -> Dict[int, PostRecord]:
    return {p.article_id: p for p in posts}


def article_token_weights(post: PostRecord) -> Dict[str, float]:
    tf: Dict[str, float] = {}
    for segment in post.segments:
        for token in tokenize_ja(segment):
            tf[token] = tf.get(token, 0.0) + 1.0
    if not tf:
        return {}
    max_tf = max(tf.values())
    return {k: 0.5 + 0.5 * (v / max_tf) for k, v in tf.items()}


def compute_idf_for_tags(tag_article_tokens: Dict[str, List[Dict[str, float]]]) -> Dict[str, float]:
    n_tags = max(1, len(tag_article_tokens))
    df: Dict[str, int] = {}
    for vecs in tag_article_tokens.values():
        seen: set[str] = set()
        for vec in vecs:
            seen.update(vec.keys())
        for token in seen:
            df[token] = df.get(token, 0) + 1
    return {token: math.log((1 + n_tags) / (1 + c)) + 1.0 for token, c in df.items()}


def merge_weight_dicts(dicts: Iterable[Dict[str, float]], idf: Optional[Dict[str, float]] = None) -> Dict[str, float]:
    merged: Dict[str, float] = {}
    count = 0
    for d in dicts:
        if not d:
            continue
        count += 1
        for k, v in d.items():
            merged[k] = merged.get(k, 0.0) + v * (idf.get(k, 1.0) if idf else 1.0)
    if count == 0:
        return {}
    return {k: v / count for k, v in merged.items()}


def cosine_sparse(a: Dict[str, float], b: Dict[str, float]) -> float:
    if not a or not b:
        return 0.0
    if len(a) > len(b):
        a, b = b, a
    dot = sum(v * b.get(k, 0.0) for k, v in a.items())
    na = math.sqrt(sum(v * v for v in a.values()))
    nb = math.sqrt(sum(v * v for v in b.values()))
    return dot / (na * nb) if na and nb else 0.0


def top_terms(
    vec: Dict[str, float],
    n: int = 12,
    token_quality_judge: Optional[TokenQualityJudge] = None,
    idf: Optional[Dict[str, float]] = None,
    doc_count: Optional[int] = None,
) -> List[str]:
    sorted_items = sorted(vec.items(), key=lambda kv: (-kv[1], kv[0]))
    if token_quality_judge is None:
        return [k for k, _ in sorted_items[:n]]

    out: List[str] = []
    for token, _ in sorted_items:
        decision = token_quality_judge.evaluate(
            token,
            idf=idf.get(token) if idf else None,
            doc_count=doc_count,
            enforce_abstract=True,
        )
        if decision.allow:
            out.append(token)
        if len(out) >= n:
            break
    return out


def load_tag_attributes(path: Path = TAG_ATTRIBUTES_FILE) -> Dict[str, Dict[str, Any]]:
    data = load_json(path, {})
    if not isinstance(data, dict) or not data:
        legacy = LEGACY_METADATA_DIR / "tag_attributes.json"
        if path == TAG_ATTRIBUTES_FILE and legacy.exists():
            data = load_json(legacy, {})
    if not isinstance(data, dict):
        return {}
    return {str(k): v for k, v in data.items() if isinstance(v, dict)}


def attribute_similarity(a: Dict[str, Any], b: Dict[str, Any]) -> float:
    if not a or not b:
        return 0.0
    scores: List[float] = []
    for key in sorted(set(a.keys()) & set(b.keys())):
        av, bv = a[key], b[key]
        if isinstance(av, list) and isinstance(bv, list):
            aset = {str(x) for x in av if str(x)}
            bset = {str(x) for x in bv if str(x)}
            if aset or bset:
                scores.append(len(aset & bset) / len(aset | bset))
        else:
            scores.append(1.0 if str(av) == str(bv) and str(av) else 0.0)
    return sum(scores) / len(scores) if scores else 0.0


def sanitize_filename(name: str) -> str:
    safe = re.sub(r"[^0-9A-Za-zぁ-んァ-ヶ一-龠々_-]+", "_", name).strip("_")
    return safe[:80] or "item"


def dump_debug_json(file_name: str, data: Any, output_dir: Path = OUTPUT_DIR) -> Path:
    path = output_dir / "debug" / file_name
    write_json(path, data)
    return path

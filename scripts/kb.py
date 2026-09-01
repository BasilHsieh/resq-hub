#!/usr/bin/env python3
"""ResQ Hub 知識庫維護腳本（零外部相依）。

用法：
    python3 scripts/kb.py index    重新生成 INDEX.md 的 AUTO 區塊
    python3 scripts/kb.py check    一致性檢查（有問題回傳非 0）
    python3 scripts/kb.py all      先 index 再 check

設計原則：所有索引資料的唯一真相是各文件的 frontmatter 與 `## 關聯` 區塊。
INDEX.md 的表格是生成物，不要手改（改了會被覆蓋）。
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# 掃描範圍：知識文件與對外輸出
SCAN_DIRS = ["knowledge", "output"]
# 這些檔在 repo 根目錄，也要檢查連結但不進文件索引表
ROOT_DOCS = ["INDEX.md", "MAP.md", "ARCHITECTURE.md", "README.md", "CLAUDE.md", "DECISIONS.md"]

# frontmatter priority 允許值 → INDEX 分組標題
PRIORITY_GROUPS = [
    ("high", "⭐ 高度相關（v1 必讀）"),
    ("normal", "中度相關"),
    ("archive", "歸檔（已被涵蓋或直接用途低）"),
    ("parked", "⏸ 平行主題／暫緩"),
]
VALID_PRIORITY = {p for p, _ in PRIORITY_GROUPS}

# `## 關聯` 區塊允許的關係動詞
VALID_RELATIONS = {
    "支撐": "證據支持對方的論點",
    "依據": "本文件的推論建立在對方之上（支撐／錨定的反向）",
    "反駁": "與對方的結論直接衝突（對稱）",
    "修訂": "對方需因本文件修改",
    "待修訂": "本文件需因對方修改（修訂的反向）",
    "延伸": "接續對方往下談",
    "前身": "對方接續本文件（延伸的反向）",
    "取代": "已涵蓋對方，對方僅存查",
    "已被取代": "本文件已被對方涵蓋（取代的反向）",
    "對照": "同主題的不同視角（對稱）",
    "錨定": "第一手田野證據錨定對方的推論",
}

GITIGNORED_PREFIXES = ("raw/", "archive/", "../raw/", "../archive/")

FM_RE = re.compile(r"\A---\r?\n(.*?)\r?\n---\r?\n", re.S)
LINK_RE = re.compile(r"\[([^\]]*)\]\(([^)\s]+?)(?:\s+\"[^\"]*\")?\)")
# mermaid 圖裡的 `click NODE "path" "tooltip"`——不是 markdown 連結，會靜靜爛掉
CLICK_RE = re.compile(r'^\s*click\s+\S+\s+"([^"]+)"', re.M)
REL_RE = re.compile(
    r"^-\s*\*\*(?P<rel>[^*]+?)\*\*\s*\[(?P<title>[^\]]*)\]\((?P<path>[^)#\s]+)[^)]*\)\s*(?:[—–-]\s*(?P<note>.*))?$"
)


# --------------------------------------------------------------------------
# 極簡 frontmatter parser：只支援本知識庫實際用到的三種形態
#   key: value
#   key: [a, b, c]
#   key:
#     - item
# --------------------------------------------------------------------------
def parse_frontmatter(text: str) -> dict:
    m = FM_RE.match(text)
    if not m:
        return {}
    data: dict = {}
    key = None
    for raw in m.group(1).splitlines():
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        if raw.startswith((" ", "\t")) and raw.lstrip().startswith("- "):
            if key:
                data.setdefault(key, [])
                if isinstance(data[key], list):
                    data[key].append(raw.lstrip()[2:].strip())
            continue
        if ":" not in raw:
            continue
        key, _, val = raw.partition(":")
        key, val = key.strip(), val.strip()
        if val.startswith("[") and val.endswith("]"):
            data[key] = [v.strip() for v in val[1:-1].split(",") if v.strip()]
        elif val == "":
            data[key] = []
        else:
            data[key] = val
    return data


def body_after_frontmatter(text: str) -> str:
    m = FM_RE.match(text)
    return text[m.end():] if m else text


def parse_relations(text: str) -> list[dict]:
    """抓 `## 關聯` 區塊裡的關係列。"""
    body = body_after_frontmatter(text)
    m = re.search(r"^##\s*關聯\s*$", body, re.M)
    if not m:
        return []
    rest = body[m.end():]
    nxt = re.search(r"^##\s", rest, re.M)
    block = rest[: nxt.start()] if nxt else rest
    out = []
    for line in block.splitlines():
        line = line.strip()
        if not line.startswith("-"):
            continue
        rm = REL_RE.match(line)
        if rm:
            out.append(
                {
                    "rel": rm.group("rel").strip(),
                    "path": rm.group("path").strip(),
                    "note": (rm.group("note") or "").strip(),
                    "raw": line,
                    "parsed": True,
                }
            )
        else:
            out.append({"raw": line, "parsed": False})
    return out


class Doc:
    def __init__(self, path: Path):
        self.path = path
        self.rel = path.relative_to(ROOT).as_posix()
        self.text = path.read_text(encoding="utf-8")
        self.fm = parse_frontmatter(self.text)
        self.relations = parse_relations(self.text)

    @property
    def title(self) -> str:
        return self.path.stem

    @property
    def tags(self) -> list[str]:
        t = self.fm.get("tags", [])
        return t if isinstance(t, list) else [t]

    @property
    def summary(self) -> str:
        return str(self.fm.get("summary", "")).strip()

    @property
    def priority(self) -> str:
        return str(self.fm.get("priority", "normal")).strip() or "normal"

    def resolve(self, link: str) -> Path:
        return (self.path.parent / link).resolve()


def collect_docs() -> list[Doc]:
    """知識文件。目錄型 README.md 是導覽不是知識，排除在索引與 frontmatter 檢查之外。"""
    docs = []
    for d in SCAN_DIRS:
        for p in sorted((ROOT / d).rglob("*.md")):
            if p.name == "README.md":
                continue
            docs.append(Doc(p))
    return docs


def collect_all_md() -> list[Doc]:
    """所有 markdown——連結檢查用，README 與 root 文件都要檢查。"""
    docs = collect_docs()
    for d in SCAN_DIRS:
        for p in sorted((ROOT / d).rglob("README.md")):
            docs.append(Doc(p))
    for name in ROOT_DOCS:
        p = ROOT / name
        if p.exists():
            docs.append(Doc(p))
    return docs


# --------------------------------------------------------------------------
# index
# --------------------------------------------------------------------------
def render_doc_index(docs: list[Doc]) -> str:
    lines: list[str] = []
    by_dir: dict[str, list[Doc]] = {}
    for d in docs:
        by_dir.setdefault(d.path.parent.relative_to(ROOT).as_posix(), []).append(d)

    order = ["output", "knowledge/fieldwork", "knowledge/framework",
             "knowledge/synthesis", "knowledge/context"]
    dirs = [x for x in order if x in by_dir] + [x for x in sorted(by_dir) if x not in order]

    for dirname in dirs:
        group = by_dir[dirname]
        lines.append(f"### `{dirname}/`\n")
        buckets: dict[str, list[Doc]] = {}
        for d in group:
            buckets.setdefault(d.priority, []).append(d)
        multi = len([b for b in buckets if b != "normal"]) > 0 and len(buckets) > 1
        for pkey, plabel in PRIORITY_GROUPS:
            if pkey not in buckets:
                continue
            if multi:
                lines.append(f"**{plabel}**\n")
            lines.append("| 文件 | 摘要 | Tags |")
            lines.append("|---|---|---|")
            for d in sorted(buckets[pkey], key=lambda x: x.title):
                tags = " ".join(f"`#{t}`" for t in d.tags)
                summ = d.summary.replace("|", "\\|") or "—"
                lines.append(f"| [{d.title}]({d.rel}) | {summ} | {tags} |")
            lines.append("")
    return "\n".join(lines).rstrip()


def render_tag_index(docs: list[Doc]) -> str:
    tagmap: dict[str, list[Doc]] = {}
    for d in docs:
        for t in d.tags:
            tagmap.setdefault(t, []).append(d)
    lines = []
    for tag in sorted(tagmap, key=lambda t: (-len(tagmap[t]), t)):
        items = " · ".join(
            f"[{d.title}]({d.rel})" for d in sorted(tagmap[tag], key=lambda x: x.title)
        )
        lines.append(f"- **#{tag}**（{len(tagmap[tag])}）— {items}")
    return "\n".join(lines)


def render_relation_map(docs: list[Doc]) -> str:
    rows = []
    for d in sorted(docs, key=lambda x: x.rel):
        for r in d.relations:
            if not r.get("parsed"):
                continue
            tgt = d.resolve(r["path"])
            try:
                tgt_rel = tgt.relative_to(ROOT).as_posix()
            except ValueError:
                tgt_rel = r["path"]
            rows.append(f"| [{d.title}]({d.rel}) | **{r['rel']}** | [{Path(tgt_rel).stem}]({tgt_rel}) | {r['note']} |")
    if not rows:
        return "_（尚無關聯資料）_"
    head = ["| 來源 | 關係 | 對象 | 說明 |", "|---|---|---|---|"]
    return "\n".join(head + rows)


def render_kb_map(docs: list[Doc]) -> str:
    """生成 ARCHITECTURE 圖 2（知識庫地圖）的 mermaid。

    節點清單自動產生（會隨文件增減），邊只畫「粗結構流」——關聯的細節在 MAP.md，
    畫進圖裡會變毛球。
    """
    ids = {d.rel: f"N{i}" for i, d in enumerate(sorted(docs, key=lambda x: x.rel), 1)}

    def label(d: Doc) -> str:
        mark = " ⚠️" if d.fm.get("revision_pending") else ""
        return f'{ids[d.rel]}["{d.title}{mark}"]'

    def bucket(dirname: str, prio: str | None = None) -> list[Doc]:
        out = [d for d in docs if d.path.parent.relative_to(ROOT).as_posix() == dirname]
        return sorted([d for d in out if prio is None or d.priority == prio], key=lambda x: x.title)

    L = ["flowchart TB", '    subgraph RAW["📥 raw/（不進 git）"]',
         '        RP["PDF 與筆記原始檔"]', "    end", ""]

    ctx_groups = [("HIGH", "⭐ 高度相關（v1 必讀）", "high"),
                  ("MID", "中度相關", "normal"),
                  ("LOW", "歸檔", "archive"),
                  ("PARK", "⏸ 平行主題", "parked")]
    ctx_total = len(bucket("knowledge/context"))
    L.append(f'    subgraph CTX["📚 knowledge/context/ — {ctx_total} 份文獻"]')
    L.append("        direction TB")
    present = []
    for gid, gtitle, prio in ctx_groups:
        items = bucket("knowledge/context", prio)
        if not items:
            continue
        present.append((gid, prio))
        L.append(f'        subgraph {gid}["{gtitle}"]')
        for d in items:
            L.append(f"            {label(d)}")
        L.append("        end")
    L += ["    end", ""]

    for dirname, sid, title in [("knowledge/framework", "FW", "🧭 knowledge/framework/"),
                                ("knowledge/fieldwork", "FLD", "🥾 knowledge/fieldwork/"),
                                ("knowledge/synthesis", "SYN", "🔬 knowledge/synthesis/")]:
        items = bucket(dirname)
        if not items:
            continue
        n = f" — {len(items)} 份" if len(items) > 1 else ""
        L.append(f'    subgraph {sid}["{title}{n}"]')
        for d in items:
            L.append(f"        {label(d)}")
        L += ["    end", ""]

    L.append('    subgraph OUT["📦 output/ + 決策"]')
    for d in bucket("output"):
        L.append(f"        {label(d)}")
    L += ['        PRD["prototype/ + spec/"]', '        DEC["DECISIONS.md"]', "    end", ""]

    L.append("    RAW ==>|處理| CTX")
    for gid, prio in present:
        L.append(f"    {gid} {'-->' if prio == 'high' else '-.補充.->'} FW")
    if bucket("knowledge/synthesis"):
        L.append("    HIGH --> SYN" if any(g == "HIGH" for g, _ in present) else "")
        L.append("    SYN --> OUT")
    L += ["    FLD ==>|錨點| FW", "    FLD ==>|錨點| OUT",
          "    FW --> OUT", "    OUT --> DEC", "    DEC --> PRD", ""]

    styles = {"high": "high", "normal": "mid", "archive": "low", "parked": "low"}
    L += ["    classDef high fill:#fef3c7,stroke:#d97706",
          "    classDef mid fill:#dbeafe,stroke:#2563eb,color:#1e3a8a",
          "    classDef low fill:#f3f4f6,stroke:#6b7280",
          "    classDef fw fill:#dcfce7,stroke:#16a34a",
          "    classDef fld fill:#fce7f3,stroke:#db2777",
          "    classDef syn fill:#ede9fe,stroke:#7c3aed",
          "    classDef out fill:#e0e7ff,stroke:#6366f1"]
    for cls, dirname in [("fw", "knowledge/framework"), ("fld", "knowledge/fieldwork"),
                         ("syn", "knowledge/synthesis"), ("out", "output")]:
        got = [ids[d.rel] for d in bucket(dirname)]
        if got:
            L.append(f"    class {','.join(got)} {cls}")
    L.append("    class PRD,DEC out")
    for prio, cls in styles.items():
        got = [ids[d.rel] for d in bucket("knowledge/context", prio)]
        if got:
            L.append(f"    class {','.join(got)} {cls}")
    L.append("")
    for d in sorted(docs, key=lambda x: x.rel):
        L.append(f'    click {ids[d.rel]} "{d.rel}" "開啟原檔"')
    L.append('    click DEC "DECISIONS.md" "開啟原檔"')
    return "```mermaid\n" + "\n".join(x for x in L if x is not None) + "\n```"


def write_auto_block(text: str, name: str, content: str) -> tuple[str, bool]:
    start, end = f"<!-- AUTO:{name}:start -->", f"<!-- AUTO:{name}:end -->"
    pat = re.compile(re.escape(start) + r".*?" + re.escape(end), re.S)
    if not pat.search(text):
        return text, False
    return pat.sub(lambda _: f"{start}\n{content}\n{end}", text), True


def cmd_index() -> int:
    """把 AUTO 區塊寫進「含有該標記的」root 文件——標記在哪，內容就生成到哪。"""
    docs = collect_docs()
    blocks = {
        "doc-index": render_doc_index(docs),
        "tag-index": render_tag_index(docs),
        "relation-map": render_relation_map(docs),
        "kb-map": render_kb_map(docs),
    }
    written: dict[str, str] = {}
    for name in ROOT_DOCS:
        f = ROOT / name
        if not f.exists():
            continue
        text = orig = f.read_text(encoding="utf-8")
        for bname, content in blocks.items():
            text, ok = write_auto_block(text, bname, content)
            if ok:
                written[bname] = name
        if text != orig:
            f.write_text(text, encoding="utf-8")
    for bname, target in sorted(written.items()):
        print(f"✅ {target} ← AUTO:{bname}")
    for bname in blocks:
        if bname not in written:
            print(f"⚠️  沒有任何 root 文件含有 AUTO:{bname} 標記，該區塊未生成")
    print(f"— 掃描 {len(docs)} 份文件 —")
    return 0


# --------------------------------------------------------------------------
# check
# --------------------------------------------------------------------------
def cmd_check() -> int:
    docs = collect_docs()
    all_docs = collect_all_md()
    by_rel = {d.rel: d for d in docs}
    errors: list[str] = []
    warns: list[str] = []

    # 1. frontmatter 必填
    for d in docs:
        for field in ("tags", "summary", "date"):
            if not d.fm.get(field):
                errors.append(f"{d.rel}：frontmatter 缺 `{field}`")
        if d.rel.startswith("knowledge/context/") and not d.fm.get("citation"):
            errors.append(f"{d.rel}：frontmatter 缺 `citation`（別人 clone 下來要核得到引用）")
        if d.priority not in VALID_PRIORITY:
            errors.append(
                f"{d.rel}：priority `{d.priority}` 不合法（可用 {'/'.join(sorted(VALID_PRIORITY))}）"
            )

    # 2. 連結有效性（含 root 檔）
    for d in all_docs:
        for _, link in LINK_RE.findall(d.text):
            if link.startswith(("http://", "https://", "mailto:", "#")):
                continue
            clean = link.split("#")[0]
            if not clean:
                continue
            if clean.startswith(GITIGNORED_PREFIXES):
                warns.append(f"{d.rel}：連結指向未進 git 的目錄 → `{link}`（GitHub 上是死連結）")
                continue
            if not d.resolve(clean).exists():
                errors.append(f"{d.rel}：壞連結 → `{link}`")

    # 2b. mermaid click 目標
    for d in all_docs:
        for target in CLICK_RE.findall(d.text):
            if target.startswith(("http://", "https://")):
                continue
            if not (ROOT / target).exists() and not d.resolve(target).exists():
                errors.append(f"{d.rel}：mermaid click 目標不存在 → `{target}`")

    # 3. 關聯區塊
    for d in docs:
        if d.rel.startswith("output/"):
            continue
        parsed = [r for r in d.relations if r.get("parsed")]
        bad = [r for r in d.relations if not r.get("parsed")]
        for r in bad:
            warns.append(f"{d.rel}：關聯格式無法解析 → {r['raw'][:60]}")
        if not d.relations:
            warns.append(f"{d.rel}：沒有 `## 關聯` 區塊（孤兒文件）")
        for r in parsed:
            if r["rel"] not in VALID_RELATIONS:
                warns.append(
                    f"{d.rel}：關係動詞 `{r['rel']}` 不在字彙表（{'/'.join(VALID_RELATIONS)}）"
                )
            tgt = d.resolve(r["path"])
            try:
                tgt_rel = tgt.relative_to(ROOT).as_posix()
            except ValueError:
                continue
            other = by_rel.get(tgt_rel)
            if other is None:
                continue
            back = any(
                o.get("parsed") and other.resolve(o["path"]) == d.path.resolve()
                for o in other.relations
            )
            if not back:
                warns.append(f"單向關聯：{d.rel} —{r['rel']}→ {tgt_rel}，但對方沒回指")

    # 4. 未處理的 revision_pending
    for d in docs:
        rp = d.fm.get("revision_pending")
        if rp:
            n = len(rp) if isinstance(rp, list) else 1
            warns.append(f"{d.rel}：有 {n} 筆未處理的 revision_pending")

    for e in errors:
        print(f"❌ {e}")
    for w in warns:
        print(f"⚠️  {w}")
    print(f"\n— {len(docs)} 份文件；{len(errors)} 個錯誤、{len(warns)} 個提醒 —")
    return 1 if errors else 0


def main() -> int:
    cmd = sys.argv[1] if len(sys.argv) > 1 else "all"
    if cmd == "index":
        return cmd_index()
    if cmd == "check":
        return cmd_check()
    if cmd == "all":
        rc = cmd_index()
        print()
        return cmd_check() or rc
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main())

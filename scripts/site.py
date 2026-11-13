#!/usr/bin/env python3
"""ResQ Hub 的網站：把 repo 裡給人看的頁面做成靜態網站（D-21）。

  python3 scripts/site.py              預覽：全部頁面，掛「草稿預覽」標記，輸出到 _site/
  python3 scripts/site.py --public     正式：只放 status 是「對外發布」的頁
  python3 scripts/site.py --artifact   預覽，首頁照 claude.ai artifact 的格式輸出（發起人看預覽用）

內容只在 repo 裡改（output/handbook、output/knowledge、output/出處與著作權.md），網站不另外維護一份。
樣式：顏色、間距、圓角、字型讀設計系統的 tokens.json；版面與元件在 output/site/。
研究方法頁「現在跑到哪」從 knowledge/研究方向.md、案例比較表.md、研究清單.md 自動產生。
零外部相依：Markdown 用這裡的小轉換器，只支援我們頁面用到的寫法。
"""
from __future__ import annotations

import datetime
import html
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from kb import body_after_frontmatter, parse_frontmatter  # noqa: E402
import ds  # noqa: E402  設計系統：網站深色主題的顏色由它算

OUT = ROOT / "_site"
SITE_SRC = ROOT / "output" / "site"
TOKENS = ROOT / "output" / "design-system" / "tokens.json"
PUBLISHED = "對外發布"
SLUG_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")

# 網站的分區：key、資料夾、名稱、給誰
SECTIONS = [
    ("handbook", "output/handbook", "手冊", "給第一次想去災區幫忙的人：出發前要知道的事。"),
    ("knowledge", "output/knowledge", "知識庫", "給想弄懂的人：大量志工湧入災區時，現場實際怎麼運作、哪些做法有證據。"),
]
ROOT_PAGES = ["output/出處與著作權.md"]  # 放在網站根目錄的頁
METHOD_SLUG = "how-we-research"  # 研究方法頁（output/knowledge/研究怎麼做.md）

esc = lambda s: html.escape(str(s), quote=True)  # noqa: E731


def repo_slug() -> str:
    try:
        url = subprocess.run(["git", "-C", str(ROOT), "remote", "get-url", "origin"],
                             capture_output=True, text=True, check=True).stdout.strip()
        m = re.search(r"github\.com[:/]([^/]+/[^/.]+)", url)
        if m:
            return m.group(1)
    except Exception:
        pass
    return "BasilHsieh/resq-hub"


GITHUB = f"https://github.com/{repo_slug()}"


def last_commit_date() -> str:
    try:
        return subprocess.run(["git", "-C", str(ROOT), "log", "-1", "--format=%cs"],
                              capture_output=True, text=True, check=True).stdout.strip()
    except Exception:
        return ""


def strip_md(s: str) -> str:
    s = re.sub(r"\[\^[^\]]+\]", "", s)
    s = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", s)
    s = re.sub(r"[*`]", "", s)
    return s.strip()


CJK = "[⺀-鿿豈-﫿＀-￯　-〿]"


def smart_join(parts: list[str]) -> str:
    out = ""
    for p in parts:
        p = p.strip()
        if not out:
            out = p
        elif re.search(CJK + "$", out) and re.match(CJK, p):
            out += p
        else:
            out += " " + p
    return out


def heading_id(text: str, seen: dict) -> str:
    t = re.sub(r"[^\w\- ]", "", strip_md(text).lower()).strip().replace(" ", "-")
    t = t or "section"
    n = seen.get(t, 0)
    seen[t] = n + 1
    return t if n == 0 else f"{t}-{n}"


# ---------------------------------------------------------------- 頁面

class Page:
    def __init__(self, rel: str, section: str):
        self.rel = rel
        self.section = section
        text = (ROOT / rel).read_text(encoding="utf-8")
        self.fm = parse_frontmatter(text)
        self.body = body_after_frontmatter(text)
        self.slug = self.fm.get("slug") or ""
        self.status = self.fm.get("status") or "草稿"
        self.date = self.fm.get("date") or ""
        self.summary = self.fm.get("summary") or ""
        srcs = self.fm.get("sources") or []
        self.sources = [srcs] if isinstance(srcs, str) else list(srcs)
        m = re.search(r"^#\s+(.+)$", self.body, re.M)
        self.title = strip_md(m.group(1)) if m else Path(rel).stem

    @property
    def out(self) -> str:
        return f"{self.section}/{self.slug}.html" if self.section else f"{self.slug}.html"


def discover() -> tuple[list[Page], list[str]]:
    pages, errors, seen = [], [], {}
    for key, folder, _, _ in SECTIONS:
        for p in sorted((ROOT / folder).glob("*.md")):
            if p.name == "README.md":
                continue
            pages.append(Page(str(p.relative_to(ROOT)), key))
    for rel in ROOT_PAGES:
        if (ROOT / rel).exists():
            pages.append(Page(rel, ""))
    for pg in pages:
        if not pg.slug:
            errors.append(f"{pg.rel}：缺 `slug`（網站的網址，英文小寫與連字號，例如 where-no-one-goes）")
        elif not SLUG_RE.match(pg.slug):
            errors.append(f"{pg.rel}：`slug` 只能用英文小寫、數字與連字號 → `{pg.slug}`")
        elif pg.out in seen:
            errors.append(f"{pg.rel}：`slug` 跟 {seen[pg.out]} 重複 → `{pg.slug}`")
        else:
            seen[pg.out] = pg.rel
    return pages, errors


def section_order(key: str, folder: str, pages: list[Page]) -> list[Page]:
    """照該區 README 裡連結出現的順序排；README 沒列的排在後面。"""
    readme = ROOT / folder / "README.md"
    order = []
    if readme.exists():
        for m in re.finditer(r"\]\(([^)#]+\.md)", readme.read_text(encoding="utf-8")):
            name = Path(m.group(1)).name
            if name not in order:
                order.append(name)
    mine = [p for p in pages if p.section == key]
    rank = lambda p: (order.index(Path(p.rel).name) if Path(p.rel).name in order else len(order), p.rel)  # noqa: E731
    return sorted(mine, key=rank)


# ---------------------------------------------------------------- Markdown

class Renderer:
    """只支援我們頁面用到的 Markdown：標題、段落、清單（可巢狀）、引言、表格、註腳、連結、粗體、行內程式碼。"""

    def __init__(self, src_rel: str, out_rel: str, site_map: dict, raw: dict | None = None):
        self.src_dir = Path(src_rel).parent
        self.out_dir = Path(out_rel).parent
        self.site_map = site_map  # repo 相對路徑 → 網站路徑
        self.raw = raw if raw is not None else {}
        self.fn_defs: dict[str, str] = {}
        self.fn_order: list[str] = []
        self.fn_count: dict[str, int] = {}
        self.ids: dict[str, int] = {}
        self.warnings: list[str] = []

    # ---- 連結
    def rel_url(self, target_out: str) -> str:
        import os
        return os.path.relpath(target_out, self.out_dir or ".").replace("\\", "/")

    def resolve(self, url: str) -> tuple[str, bool]:
        if re.match(r"^(https?:|mailto:)", url):
            return url, True
        if url.startswith("#"):
            return url, False
        path, _, frag = url.partition("#")
        import os
        repo_path = os.path.normpath(str(self.src_dir / path)).replace("\\", "/")
        if repo_path in self.site_map:
            return self.rel_url(self.site_map[repo_path]) + (f"#{frag}" if frag else ""), False
        if not (ROOT / repo_path).exists():
            self.warnings.append(f"連結的檔案不存在：{url}")
        kind = "tree" if (ROOT / repo_path).is_dir() else "blob"
        return f"{GITHUB}/{kind}/main/{repo_path}" + (f"#{frag}" if frag else ""), True

    def a(self, href: str, label: str, external: bool) -> str:
        attrs = ' target="_blank" rel="noopener"' if external else ""
        return f'<a href="{esc(href)}"{attrs}>{label}</a>'

    # ---- 行內
    def inline(self, s: str, links: bool = True) -> str:
        store: list[str] = []

        def keep(h: str) -> str:
            store.append(h)
            return f"\x00{len(store) - 1}\x00"

        s = re.sub(r"`([^`]+)`", lambda m: keep(f"<code>{html.escape(m.group(1))}</code>"), s)
        s = html.escape(s, quote=False)
        if links:
            def md_link(m):
                href, ext = self.resolve(html.unescape(m.group(2)))
                return keep(self.a(href, self.inline(html.unescape(m.group(1)), links=False), ext))
            s = re.sub(r"\[([^\]\^][^\]]*)\]\(([^)\s]+)\)", md_link, s)
            s = re.sub(r"&lt;(https?://[^\s<>]+?)&gt;",
                       lambda m: keep(self.a(html.unescape(m.group(1)), m.group(1), True)), s)

            def bare(m):
                url = m.group(1)
                tail = ""
                while url and url[-1] in ".,;:":
                    tail, url = url[-1] + tail, url[:-1]
                return keep(self.a(html.unescape(url), url, True)) + tail
            s = re.sub(r"(?<![\w/\"=])(https?://[^\s<>\x00）」』，。；、()]+)", bare, s)
            s = re.sub(r"\[\^([^\]]+)\]", lambda m: keep(self.fn_ref(m.group(1))), s)
        s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
        s = re.sub(r"(?<![*\w])\*(?![\s*])(.+?)(?<![\s*])\*(?![*\w])", r"<em>\1</em>", s)
        while "\x00" in s:
            s = re.sub(r"\x00(\d+)\x00", lambda m: store[int(m.group(1))], s)
        return s

    def fn_ref(self, label: str) -> str:
        if label not in self.fn_order:
            self.fn_order.append(label)
        n = self.fn_order.index(label) + 1
        self.fn_count[label] = self.fn_count.get(label, 0) + 1
        k = self.fn_count[label]
        return (f'<sup class="fnref"><a href="#fn-{n}" id="fnref-{n}-{k}" '
                f'aria-label="註腳 {n}">{n}</a></sup>')

    # ---- 區塊
    LIST_RE = re.compile(r"^(\s*)([-*+]|\d+[.)])\s+(.*)$")
    FN_RE = re.compile(r"^\[\^([^\]]+)\]:\s*(.*)$")

    def is_block_start(self, line: str) -> bool:
        return bool(re.match(r"^(#{1,6}\s|>|```|\|)", line) or self.LIST_RE.match(line)
                    or self.FN_RE.match(line) or re.match(r"^(-{3,}|\*{3,})\s*$", line)
                    or line.strip() in self.raw or line.startswith("<!--"))

    def render(self, text: str) -> str:
        lines = []
        for line in text.split("\n"):
            m = self.FN_RE.match(line)
            if m:
                self.fn_defs[m.group(1)] = m.group(2)
            else:
                lines.append(line)
        body = self.blocks(lines)
        return body + self.footnotes()

    def blocks(self, lines: list[str]) -> str:
        out, i, n = [], 0, len(lines)
        while i < n:
            line = lines[i]
            st = line.strip()
            if not st:
                i += 1
                continue
            if st in self.raw:
                out.append(self.raw[st])
                i += 1
                continue
            if st.startswith("<!--"):
                while i < n and "-->" not in lines[i]:
                    i += 1
                i += 1
                continue
            if st.startswith("```"):
                j = i + 1
                code = []
                while j < n and not lines[j].strip().startswith("```"):
                    code.append(lines[j])
                    j += 1
                out.append(f"<pre><code>{html.escape(chr(10).join(code))}</code></pre>")
                i = j + 1
                continue
            m = re.match(r"^(#{1,6})\s+(.*?)\s*#*$", st)
            if m:
                level = len(m.group(1))
                hid = heading_id(m.group(2), self.ids)
                out.append(f'<h{level} id="{esc(hid)}">{self.inline(m.group(2))}</h{level}>')
                i += 1
                continue
            if re.match(r"^(-{3,}|\*{3,})$", st):
                out.append("<hr>")
                i += 1
                continue
            if st.startswith("|") and i + 1 < n and re.match(r"^\|?\s*:?-{3,}", lines[i + 1].strip()):
                rows = []
                while i < n and lines[i].strip().startswith("|"):
                    rows.append(lines[i])
                    i += 1
                out.append(self.table(rows))
                continue
            if st.startswith(">"):
                inner = []
                while i < n and lines[i].strip().startswith(">"):
                    inner.append(re.sub(r"^\s*>\s?", "", lines[i]))
                    i += 1
                out.append(f"<blockquote>{self.blocks(inner)}</blockquote>")
                continue
            if self.LIST_RE.match(line):
                indent = len(line) - len(line.lstrip())
                h, i = self.list_block(lines, i, indent)
                out.append(h)
                continue
            para = []
            while i < n and lines[i].strip() and not (para and self.is_block_start(lines[i])):
                para.append(lines[i])
                i += 1
            out.append(f"<p>{self.inline(smart_join(para))}</p>")
        return "\n".join(out)

    def list_block(self, lines: list[str], i: int, base: int) -> tuple[str, int]:
        first = self.LIST_RE.match(lines[i])
        ordered = first.group(2)[0].isdigit()
        items: list[dict] = []
        n = len(lines)
        while i < n:
            line = lines[i]
            if not line.strip():
                j = i + 1
                while j < n and not lines[j].strip():
                    j += 1
                if j < n:
                    m2 = self.LIST_RE.match(lines[j])
                    ind2 = len(lines[j]) - len(lines[j].lstrip())
                    if (m2 and ind2 >= base) or (ind2 > base and items):
                        i = j
                        continue
                break
            m = self.LIST_RE.match(line)
            ind = len(line) - len(line.lstrip())
            if m and ind == base:
                items.append({"text": [m.group(3)], "sub": ""})
                i += 1
            elif m and ind > base and items:
                sub, i = self.list_block(lines, i, ind)
                items[-1]["sub"] += sub
            elif ind > base and items and not self.LIST_RE.match(line):
                items[-1]["text"].append(line.strip())
                i += 1
            else:
                break
        tag = "ol" if ordered else "ul"
        lis = "".join(f"<li>{self.inline(smart_join(it['text']))}{it['sub']}</li>" for it in items)
        return f"<{tag}>{lis}</{tag}>", i

    def table(self, rows: list[str]) -> str:
        def cells(r: str) -> list[str]:
            r = r.strip()
            r = r[1:] if r.startswith("|") else r
            r = r[:-1] if r.endswith("|") else r
            return [c.strip() for c in r.split("|")]
        head = cells(rows[0])
        th = "".join(f"<th scope=\"col\">{self.inline(c)}</th>" for c in head)
        trs = []
        for r in rows[2:]:
            cs = cells(r)
            trs.append("<tr>" + "".join(f"<td>{self.inline(c)}</td>" for c in cs) + "</tr>")
        return (f'<div class="table-wrap"><table><thead><tr>{th}</tr></thead>'
                f'<tbody>{"".join(trs)}</tbody></table></div>')

    def footnotes(self) -> str:
        if not self.fn_order:
            return ""
        items = []
        for idx, label in enumerate(self.fn_order, 1):
            text = self.fn_defs.get(label)
            if text is None:
                self.warnings.append(f"註腳 [^{label}] 沒有內容")
                text = ""
            # 註腳裡不再產生註腳號
            body = self.inline(text).replace('<sup class="fnref">', '<sup class="fnref nested">')
            items.append(f'<li id="fn-{idx}">{body} <a class="fnback" href="#fnref-{idx}-1" '
                         f'aria-label="回到內文">↩</a></li>')
        return f'<section class="footnotes" aria-label="註腳"><h2>註腳</h2><ol>{"".join(items)}</ol></section>'


# ---------------------------------------------------------------- 研究現在跑到哪（從研究的檔案產生）

THESIS_STATES = ["被推翻", "兩邊都有", "有挑戰", "有支持", "還沒測"]
CASE_STATES = {"✅": ("done", "挖完"), "🔶": ("partial", "有片段"), "⏳": ("todo", "還沒挖")}


def public_words(s: str) -> str:
    """研究筆記寫 Basil；給人看的地方寫「發起人」（出處與著作權 §三）。"""
    return re.sub(r" ?Basil ?", "發起人", s)


def parse_theses() -> list[dict]:
    text = (ROOT / "knowledge/研究方向.md").read_text(encoding="utf-8")
    out = []
    for m in re.finditer(r"^### 論點 (\d+)：(.+)$([\s\S]*?)(?=^### |^## |\Z)", text, re.M):
        st = re.search(r"^- \*\*狀態\*\*：(.+)$", m.group(3), re.M)
        status = st.group(1).strip() if st else "還沒測"
        key = next((k for k in THESIS_STATES if status.startswith(k)), "還沒測")
        rest = status[len(key):].lstrip("——－-：:，, ")
        out.append({"n": int(m.group(1)), "text": strip_md(m.group(2)), "state": key,
                    "detail": public_words(strip_md(rest))})
    return out


def parse_cases() -> dict:
    text = (ROOT / "knowledge/案例比較表.md").read_text(encoding="utf-8")
    rows, header = [], None
    for line in text.split("\n"):
        if line.startswith("| 案例"):
            header = [c.strip() for c in line.strip("|").split("|")]
            continue
        if header and line.startswith("|") and not line.startswith("|---"):
            cs = [c.strip() for c in line.strip().strip("|").split("|")]
            if len(cs) >= len(header):
                rows.append(dict(zip(header, cs)))
        elif header and not line.startswith("|"):
            header = None if rows else header
    status_of = {}
    for r in rows:
        sym = next((s for s in CASE_STATES if s in r.get("狀態", "")), "⏳")
        status_of[r["案例"]] = CASE_STATES[sym][0]
    queue = []
    sec = re.search(r"^## 三、佇列[\s\S]*?(?=^## |\Z)", text, re.M)
    for m in re.finditer(r"^(\d+)\. \*\*(.+?)\*\*(.*)$", sec.group(0) if sec else "", re.M):
        name = m.group(2).strip()
        base = re.sub(r"[\s\d–／/、]+$", "", name)
        state = next((v for k, v in status_of.items() if k.startswith(base)), "todo")
        desc = re.split(r"——|。", m.group(3).lstrip("——－- "), maxsplit=1)[0]
        queue.append({"n": int(m.group(1)), "name": name, "state": state,
                      "desc": public_words(strip_md(desc)).strip()})
    counts = {k: sum(1 for q in queue if q["state"] == k) for k in ("done", "partial", "todo")}
    return {"queue": queue, "counts": counts, "total": len(queue)}


def parse_research_list() -> dict:
    text = (ROOT / "knowledge/研究清單.md").read_text(encoding="utf-8")
    waiting, approved = [], []
    for line in text.split("\n"):
        m = re.match(r"^\| (R-\d+) \|", line)
        if not m:
            continue
        cs = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cs) < 3:
            continue
        status = cs[-2]
        title = public_words(strip_md(re.split(r"\*\*①", cs[1])[0]))
        item = {"id": m.group(1), "title": title}
        if status.startswith("📝"):
            waiting.append(item)
        elif status.startswith("✔"):
            approved.append(item)
    return {"waiting": waiting, "approved": approved}


def status_data() -> dict:
    return {"theses": parse_theses(), "cases": parse_cases(), "research": parse_research_list(),
            "commit": last_commit_date()}


def chip(text: str, kind: str) -> str:
    return f'<span class="chip chip-{kind}">{esc(text)}</span>'


THESIS_CHIP = {"還沒測": "untested", "有支持": "support", "有挑戰": "challenge",
               "兩邊都有": "both", "被推翻": "refuted"}


def status_html(d: dict, gh: str) -> str:
    th = "".join(
        f'<li class="thesis"><span class="thesis-n">論點 {t["n"]}</span>'
        f'<p class="thesis-text">{esc(t["text"])}</p>'
        f'<p class="thesis-state">{chip(t["state"], THESIS_CHIP[t["state"]])}'
        f'<span class="thesis-detail">{esc(t["detail"])}</span></p></li>'
        for t in d["theses"])
    c = d["cases"]
    total = max(c["total"], 1)
    bar = "".join(
        f'<span class="seg seg-{k}" style="flex-grow:{c["counts"][k]}" title="{esc(lbl)} {c["counts"][k]}"></span>'
        for k, lbl in (("done", "挖完"), ("partial", "有片段"), ("todo", "還沒挖")) if c["counts"][k])
    legend = "".join(
        f'<li>{chip(lbl, "case-" + k)}<span class="num">{c["counts"][k]}</span></li>'
        for k, lbl in (("done", "挖完"), ("partial", "有片段"), ("todo", "還沒挖")))
    nxt = next((q for q in c["queue"] if q["state"] != "done"), None)
    queue = "".join(
        f'<li class="{ "is-next" if q is nxt else "" }"><span class="qn">{q["n"]}</span>'
        f'<span class="qname">{esc(q["name"])}</span>'
        f'{chip({"done": "挖完", "partial": "有片段", "todo": "還沒挖"}[q["state"]], "case-" + q["state"])}'
        f'{"<span class=" + chr(34) + "next-tag" + chr(34) + ">下一個</span>" if q is nxt else ""}</li>'
        for q in c["queue"])
    r = d["research"]
    waiting = "".join(f'<li><span class="rid">{esc(x["id"])}</span>{esc(x["title"])}</li>' for x in r["waiting"]) \
        or "<li>目前沒有</li>"
    approved = "".join(f'<li><span class="rid">{esc(x["id"])}</span>{esc(x["title"])}</li>' for x in r["approved"]) \
        or "<li>目前沒有</li>"
    return f'''<div class="status" id="status">
<section class="status-block status-theses" aria-labelledby="st-theses">
  <h3 id="st-theses">論點各站在哪</h3>
  <p class="status-note">論點是 ResQ Hub 押的假設，文字是發起人的話；研究只更新狀態。</p>
  <ol class="theses">{th}</ol>
  <p class="status-src"><a href="{gh}/blob/main/knowledge/研究方向.md" target="_blank" rel="noopener">看完整的論點看板與證據</a></p>
</section>
<section class="status-block" aria-labelledby="st-cases">
  <h3 id="st-cases">案例挖到哪</h3>
  <div class="case-bar" role="img" aria-label="{c["total"]} 個案例：挖完 {c["counts"]["done"]}、有片段 {c["counts"]["partial"]}、還沒挖 {c["counts"]["todo"]}">{bar}</div>
  <ul class="case-legend">{legend}</ul>
  <ol class="queue">{queue}</ol>
  <p class="status-src"><a href="{gh}/blob/main/knowledge/案例比較表.md" target="_blank" rel="noopener">看案例比較表</a></p>
</section>
<section class="status-block" aria-labelledby="st-waiting">
  <h3 id="st-waiting">等發起人點頭的檢驗題</h3>
  <ul class="rlist">{waiting}</ul>
  <h3>已點頭、等排程做的</h3>
  <ul class="rlist">{approved}</ul>
  <p class="status-note">排程每週二晚上 11 點跑，額度有剩才跑。</p>
  <p class="status-src"><a href="{gh}/blob/main/knowledge/研究清單.md" target="_blank" rel="noopener">看研究清單</a></p>
</section>
<p class="status-stamp">這一段從研究的檔案自動產生；資料的最後更新：{esc(d["commit"] or "（不明）")}</p>
</div>'''


# ---------------------------------------------------------------- 研究方法頁的流程圖

LANES = [("founder", "發起人"), ("claude", "Claude 與排程"), ("agent", "AI 助手")]


def lane_of(who: str) -> str:
    hits = [(who.find(k), lane) for k, lane in (("發起人", "founder"), ("Claude", "claude"),
                                                ("排程", "claude"), ("助手", "agent")) if k in who]
    return min(hits)[1] if hits else "claude"


def parse_steps(section: str) -> list[dict]:
    steps = []
    for m in re.finditer(r"^### (\d+)\.\s*(.+)$([\s\S]*?)(?=^### |\Z)", section, re.M):
        fields = dict(re.findall(r"^- \*\*(.+?)\*\*：(.+)$", m.group(3), re.M))
        steps.append({"n": int(m.group(1)), "title": m.group(2).strip(), **fields})
    return steps


def flow_html(steps: list[dict], r: Renderer) -> str:
    lane_row = {k: i + 1 for i, (k, _) in enumerate(LANES)}
    names = "".join(f'<div class="lane-band" style="grid-row:{2 * lane_row[k] - 1} / span 2"></div>'
                    f'<div class="lane-name lane-{k}" style="grid-row:{2 * lane_row[k] - 1}">{esc(v)}</div>'
                    for k, v in LANES)
    nodes = []
    cards = []
    for s in steps:
        lane = lane_of(s.get("誰", ""))
        nodes.append(f'<a class="flow-step lane-{lane}" href="#step-{s["n"]}" data-step="{s["n"]}" '
                     f'style="grid-row:{2 * lane_row[lane]};grid-column:{s["n"]}">'
                     f'<span class="num">{s["n"]}</span><span class="name">{esc(s["title"])}</span></a>')
        dl = "".join(f"<dt>{k}</dt><dd>{r.inline(s[k])}</dd>" for k in ("做什麼", "留下什麼", "例子") if s.get(k))
        cards.append(f'<li id="step-{s["n"]}" class="step-card lane-{lane}"><div class="step-head">'
                     f'<span class="num">{s["n"]}</span><h3>{esc(s["title"])}</h3>'
                     f'<span class="who">{esc(s.get("誰", ""))}</span></div><dl>{dl}</dl></li>')
    return (f'<figure class="flow"><div class="flow-scroll" tabindex="0" aria-label="流程圖，可以左右捲動">'
            f'<div class="flow-grid" style="--steps:{len(steps)}">{names}{"".join(nodes)}'
            f'<svg class="flow-links" aria-hidden="true"></svg></div></div>'
            f'<figcaption>一份研究的 {len(steps)} 步，分成三條線。發起人只在三個地方出手：丟來源、點頭、說「你 merge」。'
            f'點一步，看它做什麼、留下什麼。<span class="scroll-hint">圖比畫面寬，可以左右捲動。</span></figcaption></figure>'
            f'<ol class="step-cards">{"".join(cards)}</ol>')


# ---------------------------------------------------------------- 樣板

def tokens_css() -> str:
    d = json.loads(TOKENS.read_text(encoding="utf-8"))
    lines = ["/* 由 scripts/site.py 從 output/design-system/tokens.json 產生，不要手改 */", ":root {"]
    for group in ("color", "spacing", "radius", "shadow", "size", "stroke"):
        for t in (d.get(group) or {}).get("tokens", []):
            lines.append(f"  --{t['name']}: {t['value']};")
    fam = ((d.get("type") or {}).get("families") or {}).get("sans")
    if fam:
        lines.append(f"  --font-sans: {fam};")
    lines.append("}")
    # 深色主題：scripts/ds.py 從同一個主色算（志工頁只有淺色，所以不存進 tokens.json）。只換顏色 token。
    dark = ds.dark_tokens()
    if dark:
        decl = " ".join(f"--{k}: {v};" for k, v in dark.items())
        focus = f"--focus-ring: 0 0 0 2px {dark['ground']}, 0 0 0 4.5px {ds.focus_color(dark)};"
        body = f"{decl} {focus} color-scheme: dark;"
        lines += ["@media (prefers-color-scheme: dark) {", f"  :root:not([data-theme=\"light\"]) {{ {body} }}", "}",
                  f":root[data-theme=\"dark\"] {{ {body} }}"]
    return "\n".join(lines)


class Site:
    asset_v = ""

    def __init__(self, public: bool, artifact: bool):
        self.public = public
        self.artifact = artifact
        self.preview = not public
        self.today = datetime.date.today().isoformat()
        self.status = status_data()

    def q(self) -> str:
        """樣式與程式的網址加版本號，改了就不會讀到舊的；artifact 預覽不加。"""
        return f"?v={self.asset_v}" if self.asset_v and not self.artifact else ""

    def nav(self, root: str, active: str, has_method: bool) -> str:
        items = [("index.html", "首頁", "home"), ("handbook/index.html", "手冊", "handbook"),
                 ("knowledge/index.html", "知識庫", "knowledge")]
        if has_method:
            items.append((f"knowledge/{METHOD_SLUG}.html", "研究怎麼做", "method"))
        return "".join(f'<a href="{root}{h}"{" aria-current=" + chr(34) + "page" + chr(34) if k == active else ""}>{t}</a>'
                       for h, t, k in items)

    def shell(self, *, title: str, description: str, root: str, active: str, body: str,
              has_method: bool, artifact_index: bool = False) -> str:
        band = ('<div class="draft-band" role="note"><div class="wrap">草稿預覽：這些頁面都還沒對外發布，'
                '也還沒有懂的人看過。</div></div>') if self.preview else ""
        foot = (f'<p>內容以 <a href="https://creativecommons.org/licenses/by/4.0/deed.zh-hant" target="_blank" rel="noopener">CC BY 4.0</a> 授權：'
                f'註明出處「ResQ Hub」就能轉貼、改寫。引用的別人的內容，權利還是原作者的。</p>'
                f'<p><a href="{root}sources-and-copyright.html">出處與著作權</a>'
                f'<span aria-hidden="true">・</span><a href="{GITHUB}" target="_blank" rel="noopener">GitHub 上的原始檔</a></p>'
                f'<p class="stamp">網站從 repo 自動產生，產生於 {self.today}</p>')
        head = (f"<title>{esc(title)}</title>\n<meta name=\"description\" content=\"{esc(description)}\">\n"
                f"<link rel=\"stylesheet\" href=\"{root}assets/site.css{self.q()}\">")
        content = (f'<a class="skip" href="#main">跳到內容</a>{band}'
                   f'<header class="top"><div class="wrap top-in"><a class="brand" href="{root}index.html">ResQ Hub</a>'
                   f'<nav class="nav" aria-label="主要">{self.nav(root, active, has_method)}</nav></div></header>'
                   f'<main id="main">{body}</main>'
                   f'<footer class="foot"><div class="wrap">{foot}</div></footer>'
                   f'<script src="{root}assets/site.js{self.q()}" defer></script>')
        if artifact_index:
            return f'{head}\n<meta name="claude:viewport-fit-sides" content="cover">\n{content}\n'
        return ('<!doctype html>\n<html lang="zh-Hant">\n<head>\n<meta charset="utf-8">\n'
                '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
                f'{head}\n</head>\n<body>\n{content}\n</body>\n</html>\n')

    def lead(self, summary: str) -> str:
        first = re.split(r"(?<=[。？！])", summary, maxsplit=1)[0]
        return first if len(first) <= 90 else re.split(r"(?<=[；：])", first, maxsplit=1)[0]


def build(public: bool = False, artifact: bool = False) -> int:
    pages, errors = discover()
    if errors:
        for e in errors:
            print("❌", e)
        return 1
    site = Site(public, artifact)
    if public:
        pages = [p for p in pages if p.status == PUBLISHED]
    site_map = {p.rel: p.out for p in pages}
    has_method = any(p.slug == METHOD_SLUG for p in pages)
    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / "assets").mkdir(parents=True)
    css = tokens_css() + "\n\n" + (SITE_SRC / "site.css").read_text(encoding="utf-8")
    (OUT / "assets/site.css").write_text(css, encoding="utf-8")
    shutil.copy(SITE_SRC / "site.js", OUT / "assets/site.js")
    import hashlib
    site.asset_v = hashlib.sha1((css + (SITE_SRC / "site.js").read_text(encoding="utf-8")).encode()).hexdigest()[:8]
    warnings = []

    for p in pages:
        root = "../" if p.section else ""
        body_md = p.body
        raw = {}
        r = Renderer(p.rel, p.out, site_map, raw)
        if p.slug == METHOD_SLUG:
            raw["@@STATUS@@"] = status_html(site.status, GITHUB)
            body_md = re.sub(r"<!-- site:status -->[\s\S]*?<!-- /site:status -->", "@@STATUS@@", body_md)
            sec = re.search(r"^## 一份研究怎麼跑\s*$([\s\S]*?)(?=^## )", body_md, re.M)
            if sec:
                raw["@@FLOW@@"] = flow_html(parse_steps(sec.group(1)), r)
                body_md = body_md[:sec.start(1)] + "\n@@FLOW@@\n\n" + body_md[sec.end(1):]
        content = r.render(body_md)
        meta = (f'<div class="page-meta">{chip(p.status, "draft" if p.status != PUBLISHED else "published")}'
                f'<span>更新於 {esc(p.date)}</span></div>')
        if p.sources:
            lis = []
            for s in p.sources:
                href, ext = r.resolve("/".join([".."] * len(Path(p.rel).parent.parts) + [s]))
                lis.append(f"<li>{r.a(href, esc(Path(s).stem), ext)}</li>")
            meta += (f'<details class="sources"><summary>這一頁根據 {len(p.sources)} 份研究筆記</summary>'
                     f'<ul>{"".join(lis)}</ul></details>')
        content = content.replace("</h1>", "</h1>" + meta, 1)
        crumbs = ""
        if p.section:
            sec_name = next(t for k, _, t, _ in SECTIONS if k == p.section)
            crumbs = (f'<nav class="crumbs" aria-label="位置"><a href="../index.html">首頁</a>'
                      f'<span aria-hidden="true">／</span><a href="index.html">{sec_name}</a></nav>')
        wide = " page-wide" if p.slug == METHOD_SLUG else ""
        body = f'<div class="wrap page{wide}">{crumbs}<article class="prose">{content}</article></div>'
        active = "method" if p.slug == METHOD_SLUG else (p.section or "home")
        doc = site.shell(title=f"{p.title}｜ResQ Hub", description=site.lead(p.summary), root=root,
                         active=active, body=body, has_method=has_method)
        dest = OUT / p.out
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(doc, encoding="utf-8")
        warnings += [f"{p.rel}：{w}" for w in r.warnings]

    for key, folder, name, intro in SECTIONS:
        mine = section_order(key, folder, pages)
        cards = "".join(
            f'<li><a class="card" href="{p.slug}.html">{chip(p.status, "draft" if p.status != PUBLISHED else "published")}'
            f'<h2>{esc(p.title)}</h2><p>{esc(site.lead(p.summary))}</p></a></li>' for p in mine) \
            or '<li class="empty">這一區還沒有對外發布的頁。</li>'
        body = (f'<div class="wrap page"><nav class="crumbs" aria-label="位置"><a href="../index.html">首頁</a></nav>'
                f'<header class="section-head"><h1>{name}</h1><p>{esc(intro)}</p></header>'
                f'<ul class="cards">{cards}</ul></div>')
        (OUT / key).mkdir(exist_ok=True)
        (OUT / key / "index.html").write_text(
            site.shell(title=f"{name}｜ResQ Hub", description=intro, root="../", active=key, body=body,
                       has_method=has_method), encoding="utf-8")

    (OUT / "index.html").write_text(home(site, pages, has_method), encoding="utf-8")
    for w in warnings:
        print("⚠️ ", w)
    print(f"— 網站：{len(pages)} 頁{'（只放對外發布的）' if public else '（預覽，含草稿）'}，輸出到 {OUT.relative_to(ROOT)}/ —")
    return 0


def home(site: Site, pages: list[Page], has_method: bool) -> str:
    d = site.status
    by = {k: sum(1 for t in d["theses"] if t["state"] == k) for k in THESIS_STATES}
    thesis_line = "・".join(f"{k} {v}" for k, v in by.items() if v)
    c = d["cases"]
    count = lambda key: sum(1 for p in pages if p.section == key)  # noqa: E731
    method_link = f'knowledge/{METHOD_SLUG}.html' if has_method else f"{GITHUB}/blob/main/output/knowledge/研究怎麼做.md"
    entries = [
        ("handbook/index.html", "手冊", "第一次想去的人", "出發前要帶什麼、怎麼去、到了找誰、什麼時候先不要去。", f"{count('handbook')} 頁"),
        ("knowledge/index.html", "知識庫", "想弄懂的人", "大量志工湧入時會發生什麼、哪裡會沒人去、派工有沒有用、政府怎麼面對。", f"{count('knowledge')} 頁"),
        (method_link, "研究怎麼做", "想知道內容從哪來的人", "研究怎麼跑、每一步誰做、怎麼讀我們的證據，以及研究現在跑到哪。", "流程與進度"),
    ]
    cards = "".join(
        f'<li><a class="entry" href="{h}"><span class="entry-for">給{who}</span><h2>{t}</h2><p>{desc}</p>'
        f'<span class="entry-count">{cnt}</span></a></li>' for h, t, who, desc, cnt in entries)
    waiting = len(d["research"]["waiting"])
    tiles = (
        f'<li class="tile"><span class="tile-num">{len(d["theses"])}</span><span class="tile-label">條論點</span>'
        f'<span class="tile-sub">{esc(thesis_line)}</span></li>'
        f'<li class="tile"><span class="tile-num">{c["total"]}</span><span class="tile-label">個案例在佇列裡</span>'
        f'<span class="tile-sub">挖完 {c["counts"]["done"]}・有片段 {c["counts"]["partial"]}・還沒挖 {c["counts"]["todo"]}</span></li>'
        f'<li class="tile"><span class="tile-num">{waiting}</span><span class="tile-label">題等發起人點頭</span>'
        f'<span class="tile-sub">排程每週二晚上 11 點跑</span></li>')
    status_href = method_link + ("#status" if has_method else "")
    body = (f'<section class="hero"><div class="wrap">'
            f'<h1>大量志工湧入災區的時候，現場實際發生了什麼？</h1>'
            f'<p class="lead">ResQ Hub 研究全世界大型災害與戰爭中，政府忙不過來、大量志工湧入的時候；'
            f'也在做一個讓志工自己決定去哪一戶的工具。這裡放研究的成果。</p></div></section>'
            f'<div class="wrap"><ul class="entries">{cards}</ul>'
            f'<section class="pulse" aria-labelledby="pulse-h"><h2 id="pulse-h">研究現在跑到哪</h2>'
            f'<ul class="tiles">{tiles}</ul>'
            f'<p><a class="more" href="{status_href}">看每一條論點與每一個案例</a></p></section></div>')
    title = "ResQ Hub 官網" if site.artifact else "ResQ Hub"
    return site.shell(title=title, description="大型災害中大量志工湧入時的研究成果：手冊、知識庫與研究方法。",
                      root="", active="home", body=body, has_method=has_method, artifact_index=site.artifact)


if __name__ == "__main__":
    args = set(sys.argv[1:])
    sys.exit(build(public="--public" in args, artifact="--artifact" in args))

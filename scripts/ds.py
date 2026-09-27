#!/usr/bin/env python3
"""ResQ Hub 設計系統（output/design-system/）的維護腳本（零外部相依）。

用法：
    python3 scripts/ds.py sync         從 tokens.json 重新生成 bundle.css 的 AUTO 區塊
    python3 scripts/ds.py check        一致性檢查（有問題回傳非 0）
    python3 scripts/ds.py stage DIR    把設計系統複製到 DIR/project/，印出發布用的 files 對照表
    python3 scripts/ds.py palette [主色hue 主色chroma 中性hue 缺人hue]
                                       從一個主色推出全部顏色，寫回 tokens.json（不給數字＝照 meta.palette 重算）

平常不用直接跑：kb.py index 會順便 sync，kb.py check 會順便 check（CI 也就一併擋下過期的預設值）。

設計原則：tokens.json 是顏色、字級、間距、尺寸的唯一真相；顏色本身由 meta.palette 的主色推出來（palette 指令）。bundle.css 最上面那份預設值
（specificity 0，給沒載入 tokens.css 的地方用）是生成物，不要手改。
設計系統 artifact 與這個資料夾一一對應：artifact 的 project/<路徑> ＝ 這裡的 <路徑>；
artifact 自己的索引 project/design-system.json 不進 repo。
"""
from __future__ import annotations

import json
import math
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DS = ROOT / "output" / "design-system"
CSS = DS / "components" / "bundle.css"
JS = DS / "components" / "bundle.js"

START_PREFIX = "/* AUTO:tokens:start"
START = START_PREFIX + " — scripts/ds.py 從 tokens.json 生成，不要手改 */"
END = "/* AUTO:tokens:end */"
AUTO_RE = re.compile(re.escape(START_PREFIX) + r".*?" + re.escape(END), re.S)

NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$")
HEX_RE = re.compile(r"^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$")
NOT_LIST = {"name", "version", "color", "type", "meta"}


def rel(p: Path) -> str:
    try:
        return p.relative_to(ROOT).as_posix()
    except ValueError:
        return p.as_posix()


def load_tokens() -> dict:
    return json.loads((DS / "tokens.json").read_text(encoding="utf-8"))


def list_families(tokens: dict) -> list[tuple[str, dict]]:
    return [(k, v) for k, v in tokens.items()
            if k not in NOT_LIST and isinstance(v, dict) and isinstance(v.get("tokens"), list)]


def first_value(v, theme: str):
    return v.get(theme) if isinstance(v, dict) else v


def render_defaults(tokens: dict) -> str:
    theme = tokens["color"]["themes"][0]["id"]
    lines = []
    for t in tokens["color"]["tokens"]:
        v = first_value(t["value"], theme)
        if isinstance(v, str) and v.startswith("{"):
            v = f"var(--{v[1:-1]})"
        lines.append(f"  --{t['name']}: {v};")
    for _, fam in list_families(tokens):
        for t in fam["tokens"]:
            lines.append(f"  --{t['name']}: {first_value(t['value'], theme)};")
    for key, stack in tokens["type"]["families"].items():
        lines.append(f"  --font-{key}: {stack};")
    out = [START, ":where(:root) {", *lines, "}"]
    for g in tokens["type"]["groups"]:
        for s in g["styles"]:
            decl = [f"font-family: var(--font-{s.get('family', g.get('family'))})",
                    f"font-size: {s['fontSize']}", f"line-height: {s['lineHeight']}",
                    f"font-weight: {s['fontWeight']}"]
            if s.get("letterSpacing"):
                decl.append(f"letter-spacing: {s['letterSpacing']}")
            out.append(f":where(.{s['name']}) {{ " + "; ".join(decl) + "; }")
    out.append(END)
    return "\n".join(out)


# --------------------------------------------------------------------------
# 顏色：從一個主色推出全部（OKLCH），並檢查太陽下的對比
# --------------------------------------------------------------------------
TEXT_MIN, BORDER_MIN = 6.5, 3.0
CONTRAST_PAIRS = [(fg, bg, TEXT_MIN) for fg in ("ink", "ink-2", "ink-3") for bg in ("ground", "surface", "tonal")] + [
    ("action-fg", "action", TEXT_MIN), ("action-ink", "action-soft", TEXT_MIN), ("need-fg", "need", TEXT_MIN),
    ("drill-fg", "drill", TEXT_MIN), ("line-strong", "surface", BORDER_MIN), ("line-strong", "ground", BORDER_MIN)]


def _oklch_lin(L: float, C: float, h: float) -> tuple:
    a, b = C * math.cos(math.radians(h)), C * math.sin(math.radians(h))
    l_, m_, s_ = (L + 0.3963377774 * a + 0.2158037573 * b, L - 0.1055613458 * a - 0.0638541728 * b,
                  L - 0.0894841775 * a - 1.2914855480 * b)
    l, m, s = l_ ** 3, m_ ** 3, s_ ** 3
    return (4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
            -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
            -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)


def oklch(L: float, C: float, h: float) -> str:
    """OKLCH → hex；超出 sRGB 就降彩度。"""
    ok = lambda rgb: all(-1e-6 <= c <= 1 + 1e-6 for c in rgb)
    if not ok(_oklch_lin(L, C, h)):
        lo, hi = 0.0, C
        for _ in range(40):
            mid = (lo + hi) / 2
            lo, hi = (mid, hi) if ok(_oklch_lin(L, mid, h)) else (lo, mid)
        C = lo
    enc = lambda c: 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055
    return "#%02x%02x%02x" % tuple(round(enc(min(1, max(0, c))) * 255) for c in _oklch_lin(L, C, h))


def contrast(a: str, b: str) -> float:
    def lum(hx: str) -> float:
        f = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
        r, g, bl = (f(int(hx[i:i + 2], 16) / 255) for i in (1, 3, 5))
        return 0.2126 * r + 0.7152 * g + 0.0722 * bl
    x, y = sorted((lum(a), lum(b)), reverse=True)
    return (x + 0.05) / (y + 0.05)


def _darkest_ok(C: float, h: float, against: list, target: float, L: float) -> str:
    """從 L 往暗找，第一個對 against 全部達到 target 的顏色。"""
    while L > 0.05:
        hx = oklch(L, C, h)
        if all(contrast(hx, a) >= target for a in against):
            return hx
        L -= 0.005
    return oklch(0.1, C, h)


def derive_palette(brand_h: float, brand_c: float, neutral_h: float, need_h: float) -> dict:
    """主色一個、暖色一個（只給缺人），其餘都是帶一點主色的中性色。主色彩度很低＝墨色版：主色就是字的顏色。"""
    p = {"ground": oklch(0.962, 0.008, neutral_h), "surface": "#ffffff", "tonal": oklch(0.925, 0.014, neutral_h),
         "line": oklch(0.875, 0.012, neutral_h), "ink": oklch(0.235, 0.016, neutral_h), "ink-2": oklch(0.375, 0.018, neutral_h)}
    p["ink-3"] = _darkest_ok(0.02, neutral_h, [p["ground"], "#ffffff", p["tonal"]], 6.6, 0.6)
    p["line-strong"] = _darkest_ok(0.02, neutral_h, [p["ground"], "#ffffff"], 3.2, 0.75)
    if brand_c < 0.03:
        p["action"], p["action-soft"], p["action-ink"] = p["ink"], oklch(0.925, 0.02, neutral_h), p["ink"]
    else:
        p["action"] = _darkest_ok(brand_c, brand_h, ["#ffffff"], 6.8, 0.7)
        p["action-soft"] = oklch(0.94, 0.03 if brand_h < 230 else 0.04, brand_h)
        p["action-ink"] = _darkest_ok(min(brand_c, 0.1), brand_h, [p["action-soft"]], 7.0, 0.6)
    p["action-fg"] = "#ffffff"
    p["need"] = oklch(0.915, 0.065, need_h)
    p["need-fg"] = _darkest_ok(0.14, need_h, [p["need"]], 6.8, 0.6)
    p["drill"], p["drill-fg"] = p["ink"], "#ffffff"
    return p


def resolved_colors(tokens: dict) -> dict:
    theme = tokens["color"]["themes"][0]["id"]
    raw = {t["name"]: first_value(t["value"], theme) for t in tokens["color"]["tokens"]}
    out = {}
    for n, v in raw.items():
        seen = 0
        while isinstance(v, str) and v.startswith("{") and seen < 16:
            v, seen = raw.get(v[1:-1], ""), seen + 1
        out[n] = v
    return out


def palette(args: list) -> list:
    tokens = load_tokens()
    seed = tokens.setdefault("meta", {}).setdefault("palette", {})
    if args:
        bh, bc, nh, sh = (float(a) for a in args)
        seed.update({"brand": [bh, bc], "neutral": nh, "need": sh})
    p = derive_palette(seed["brand"][0], seed["brand"][1], seed["neutral"], seed["need"])
    for t in tokens["color"]["tokens"]:
        if t["name"] in p:
            t["value"] = p[t["name"]]
    for t in tokens.get("shadow", {}).get("tokens", []):
        if t["name"] == "focus-ring":
            t["value"] = f"0 0 0 2px {p['ground']}, 0 0 0 4.5px {p['action']}"
    (DS / "tokens.json").write_text(json.dumps(tokens, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return [f"✅ {rel(DS / 'tokens.json')} ← 主色 {seed['brand']}，中性 {seed['neutral']}，缺人 {seed['need']}"] + sync()


def sync() -> list[str]:
    """回傳要印出的訊息；沒有設計系統就什麼都不做。"""
    if not DS.exists():
        return []
    text = CSS.read_text(encoding="utf-8")
    if not AUTO_RE.search(text):
        return [f"⚠️  {rel(CSS)} 沒有 AUTO:tokens 標記，預設值未生成"]
    new = AUTO_RE.sub(lambda _: render_defaults(load_tokens()), text, count=1)
    if new != text:
        CSS.write_text(new, encoding="utf-8")
    return [f"✅ {rel(CSS)} ← AUTO:tokens"]


def bundle_components() -> tuple[str, list[str]]:
    head = JS.read_text(encoding="utf-8").split("\n", 1)[0]
    m = re.match(r"/\* @ds-bundle: (\{.*\}) \*/$", head)
    if not m:
        raise ValueError("bundle.js 第一行不是 @ds-bundle 標頭")
    meta = json.loads(m.group(1))
    return meta["namespace"], [c["name"] for c in meta["components"]]


def check() -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warns: list[str] = []
    if not DS.exists():
        return errors, warns
    try:
        tokens = load_tokens()
    except (OSError, ValueError) as e:
        return [f"{rel(DS)}/tokens.json 讀不進來：{e}"], warns

    # 1. tokens.json：名稱、重複、色值
    names: set[str] = set()
    colors = {t["name"] for t in tokens["color"]["tokens"]}
    for fam_name, fam in [("color", tokens["color"])] + list_families(tokens):
        for t in fam["tokens"]:
            n = t.get("name", "")
            if not NAME_RE.match(n):
                errors.append(f"tokens.json：{fam_name} 的名稱不合法 → `{n}`")
            if n in names:
                errors.append(f"tokens.json：名稱重複（會被丟掉）→ `{n}`")
            names.add(n)
            if not t.get("usage"):
                warns.append(f"tokens.json：`{n}` 沒有 usage")
    for t in tokens["color"]["tokens"]:
        vals = t["value"].values() if isinstance(t["value"], dict) else [t["value"]]
        for v in vals:
            if v.startswith("{"):
                if v[1:-1] not in colors or v[1:-1] == t["name"]:
                    errors.append(f"tokens.json：`{t['name']}` 的別名指向不存在的顏色 → {v}")
            elif not HEX_RE.match(v):
                errors.append(f"tokens.json：`{t['name']}` 的色值不是 hex 或別名 → {v}")
    styles = set()
    for g in tokens["type"]["groups"]:
        for s in g["styles"]:
            if not NAME_RE.match(s["name"]) or s["name"] in styles:
                errors.append(f"tokens.json：字級名稱不合法或重複 → `{s['name']}`")
            styles.add(s["name"])
    known_vars = names | {f"font-{k}" for k in tokens["type"]["families"]}
    cols = resolved_colors(tokens)
    for fg, bg, need in CONTRAST_PAIRS:
        if fg in cols and bg in cols and HEX_RE.match(cols[fg] or "") and HEX_RE.match(cols[bg] or ""):
            c = contrast(cols[fg][:7], cols[bg][:7])
            if c < need:
                errors.append(f"tokens.json：`{fg}` 對 `{bg}` 對比 {c:.1f}，不到 {need}（太陽下看不清楚）")
    seed = tokens.get("meta", {}).get("palette")
    if seed:
        want = derive_palette(seed["brand"][0], seed["brand"][1], seed["neutral"], seed["need"])
        drift = sorted(n for n, v in want.items() if cols.get(n, "").lower() != v.lower())
        if drift:
            warns.append(f"tokens.json：這些顏色跟主色推出來的不一樣（有人手改過？）→ {', '.join(drift)}")

    # 2. bundle.css 的預設值是不是最新
    css = CSS.read_text(encoding="utf-8")
    m = AUTO_RE.search(css)
    if not m:
        errors.append(f"{rel(CSS)}：沒有 AUTO:tokens 區塊")
    elif m.group(0) != render_defaults(tokens):
        errors.append(f"{rel(CSS)}：AUTO:tokens 過期，跑 python3 scripts/kb.py index")

    # 3. bundle.js：標頭、禁字、每個元件的說明與預覽
    js = JS.read_text(encoding="utf-8")
    if re.search(r"</script|<!--", js, re.I):
        errors.append(f"{rel(JS)}：含有 `</script` 或 `<!--`，內嵌時會壞")
    try:
        ns, comps = bundle_components()
        if f"window.{ns}" not in js:
            errors.append(f"{rel(JS)}：沒有指定 window.{ns}")
    except (ValueError, KeyError) as e:
        errors.append(f"{rel(JS)}：{e}")
        comps = []
    for c in comps:
        d = DS / "components" / c
        readme, preview = d / "README.md", d / "preview.html"
        if not readme.exists():
            errors.append(f"{rel(d)}：缺 README.md")
        if not preview.exists():
            errors.append(f"{rel(d)}：缺 preview.html")
        elif not preview.read_text(encoding="utf-8").startswith("<!-- @dsCard "):
            errors.append(f"{rel(preview)}：第一行不是 @dsCard 標記")
    for d in sorted(p for p in (DS / "components").iterdir() if p.is_dir()):
        if d.name != "Cover" and d.name not in comps:
            warns.append(f"{rel(d)}：不在 bundle.js 的元件清單裡")
    if not (DS / "components" / "Cover" / "preview.html").exists():
        warns.append(f"{rel(DS)}：沒有封面（components/Cover/preview.html）")

    # 4. 用到的變數與字級都要存在
    sources = [CSS] + sorted((DS / "components").glob("*/preview.html"))
    for p in sources:
        text = p.read_text(encoding="utf-8")
        if p == CSS:
            text = AUTO_RE.sub("", text)
        for v in sorted(set(re.findall(r"var\(--([A-Za-z0-9_.-]+)", text)) - known_vars):
            errors.append(f"{rel(p)}：用到不存在的 token → --{v}")
    for s in sorted(set(re.findall(r"\brq-t-[a-z0-9-]+", js)) - styles):
        errors.append(f"{rel(JS)}：用到不存在的字級 → .{s}")
    return errors, warns


def stage(target: Path) -> dict:
    proj = target / "project"
    for p in sorted(DS.rglob("*")):
        if p.is_file() and not p.name.startswith("."):
            dst = proj / p.relative_to(DS)
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(p, dst)
    files: dict = {}
    for p in sorted(proj.rglob("*")):
        if p.is_file():
            r = p.relative_to(target).as_posix()
            files[r] = {"from": r, "contentType": "text/plain"} if r.endswith(".ts") else r
    return files


def main() -> int:
    cmd = sys.argv[1] if len(sys.argv) > 1 else "check"
    if cmd == "sync":
        for line in sync():
            print(line)
        return 0
    if cmd == "check":
        errors, warns = check()
        for e in errors:
            print(f"❌ {e}")
        for w in warns:
            print(f"⚠️  {w}")
        print(f"— 設計系統：{len(errors)} 個錯誤、{len(warns)} 個提醒 —")
        return 1 if errors else 0
    if cmd == "palette" and len(sys.argv) in (2, 6):
        for line in palette(sys.argv[2:]):
            print(line)
        return 0
    if cmd == "stage" and len(sys.argv) > 2:
        print(json.dumps(stage(Path(sys.argv[2])), ensure_ascii=False, indent=1))
        return 0
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main())

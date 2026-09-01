# ResQ Hub — Claude 操作指引

## 這個人與這個專案

Basil 是軟體產品經理，曾三次進入 2025 花蓮光復災區（馬太鞍溪堰塞湖溢流）擔任志工。
**Basil 不寫 code**——技術實作與文件處理都由 Claude 負責。溝通語言：**繁體中文**。

這是一個**研究／規格 repo，不是產品 repo**。做到 prototype 與規格為止，實作會另外找人。
因此「決策的理由與被否決的選項」是這裡最值錢的東西，不是結論本身。

Basil 要的是**直接的批判性分析，不是四平八穩的摘要**。有不同意見就說。

---

## 開場怎麼進入狀況

讀 `INDEX.md` 的「從這裡開始」表，**依當下任務挑路徑，不要從頭讀到尾**。
需要知道現在決定了什麼、卡在哪 → `DECISIONS.md`。
其他文件按需讀取；每份的 `summary` 夠好，足以判斷相關性。

大型原始檔（>1000 行）不全讀：先讀前 80 行判斷結構，再決定讀哪段。

---

## 處理 `raw/` 進來的資料

1. **判斷性質**（論文、訪談、會議記錄、個人想法）
2. **有疑問先問**——不確定分類或詮釋時跟 Basil 討論，不要自行假設
3. 整理成結構化文件放進 `knowledge/` 對應子目錄
4. 補 frontmatter、補 `## 關聯`、跑 `python3 scripts/kb.py all`

frontmatter 必填 `tags` `date` `summary` `priority`；`knowledge/context/` 另外必填 `citation`（完整可查證出處，不能只寫 `raw/` 路徑——那個檔不進 git）。`priority` 與關聯字彙的定義在 `scripts/kb.py`。

**新檔命名規則**（舊檔不動，重新命名會打斷 116 條關聯）：
- `knowledge/context/` — `作者+主題+年.md`，例：`呂朝賢集集地震志工_2008.md`；非單一作者的政策文件用 `主題_年.md`
- `knowledge/framework/` — `主題.md`，不帶年份（會持續修訂）
- `knowledge/fieldwork/` — `地點事件_人_年.md`

---

## 知識庫的兩條結構鐵則

**1. `INDEX.md` 的 `AUTO` 區塊是生成物，不要手改。**
文件索引、Tag 索引、關聯圖都由 `scripts/kb.py` 從 frontmatter 與各文件的 `## 關聯` 區塊生成。手改會被覆蓋。

**2. 文件之間的關聯寫在文件自己的 `## 關聯` 區塊，而且是雙向的。**
加一條關聯就是加兩條（來源寫正向、對象寫反向）。腳本會抓出單向的。

```bash
python3 scripts/kb.py all   # 重新生成索引 + 一致性檢查
```

---

## 收工

Basil 說「收工」「可以了」或一段工作告一段落時，跑 `.claude/skills/wrap-up/`（`/wrap-up`）。
它涵蓋：固化本 session 的結論 → 維護關聯 → 一致性檢查 → 矛盾偵測 → commit → **開 PR（絕不 merge）**。

知識庫階段直接對 `main` 開 PR，不需要 Basil 下任何 git 指令。

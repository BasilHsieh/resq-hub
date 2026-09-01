---
name: wrap-up
description: ResQ Hub 的 session 收尾流程——把這次對話產生的有價值結論寫進知識庫、維護文件之間的關聯、跑一致性檢查、commit 並開 PR（不 merge）。當 Basil 說「收工」「可以了」「今天到這」「開 PR」「幫我 commit」，或一段實質工作告一段落時使用。
---

# 收工流程

把一次對話的成果**固化進知識庫**，然後開 PR 交給 Basil merge。

**鐵則**：只開 PR，**絕不 merge**。merge 永遠是 Basil 的動作。

---

## 步驟

### 1. 盤點這個 session 產生了什麼

先看做了什麼：

```bash
git status --short && git diff --stat
```

然後回頭掃這次對話，把產出分成三類：

| 類 | 例子 | 去哪 |
|---|---|---|
| **決策** | 選了 A 否決了 B、確認了範圍、推翻了先前結論 | `DECISIONS.md` |
| **知識** | 新文獻整理、新的跨文件結論、新框架、田野觀察 | `knowledge/` 對應子目錄 |
| **過程** | 辯論的轉折、被推翻的假設、放棄的路徑 | 寫進對應文件的「思考歷程」段 |

> **「過程」不要丟掉。** 這個 repo 最終要交給別人實作——「為什麼否決了 B」比「選了 A」更值錢。一個被推翻的假設值得寫一段。
>
> **不確定某個討論算不算有價值就問 Basil**，不要自行假設。

### 2. 寫進文件

- 新文件放進 `knowledge/{context,framework,fieldwork,synthesis}/`，frontmatter 必須有 `tags` `date` `summary` `priority`；`context/` 另外必填 `citation`（完整可查證出處——`raw/` 不進 git，只寫路徑等於沒有出處）
- `priority` 值：`high`（v1 必讀）／`normal`／`archive`（已被涵蓋）／`parked`（平行主題暫緩）
- 既有文件的重大更新：在 frontmatter 加 `revision_pending:` 條列，說明**因為什麼**要修訂什麼

### 3. 維護關聯（這步最容易被跳過，別跳）

每份 knowledge 文件底部都有 `## 關聯` 區塊，**這是文件關係的唯一真相**（INDEX 的關聯圖只是它的彙整）。

格式固定，腳本會解析：

```markdown
## 關聯

- **支撐** [對方檔名](相對路徑.md) — 一句話說明這個關係
```

關係字彙（定義在 `scripts/kb.py` 的 `VALID_RELATIONS`）：

| 正向 | 反向 | 意思 |
|---|---|---|
| `支撐` | `依據` | 證據支持對方的論點 |
| `錨定` | `依據` | 第一手田野錨定對方的推論 |
| `反駁` | `反駁` | 與對方的結論直接衝突（對稱） |
| `修訂` | `待修訂` | 對方需因本文件修改 |
| `延伸` | `前身` | 接續對方往下談 |
| `取代` | `已被取代` | 已涵蓋對方，對方僅存查 |
| `對照` | `對照` | 同主題的不同視角（對稱） |

**加一條關聯就是加兩條**——來源寫正向，對象寫反向。腳本會抓出只有單向的。

問自己：這份新文件**反駁了什麼、支撐了什麼、讓什麼需要修訂**？三個都答不出來，可能它還沒被真的讀進知識庫。

### 4. 跑腳本

```bash
python3 scripts/kb.py all
```

- 重新生成 `INDEX.md` 的三個 AUTO 區塊（**不要手改那些區塊**）
- 檢查壞連結、缺 frontmatter、單向關聯、未處理的 `revision_pending`

**❌ 錯誤必須全部修掉。⚠️ 提醒要逐條看過**——有些是真問題（單向關聯、壞連結），有些是刻意保留的狀態（未處理的 revision_pending 是研究狀態，不是 bug）。

同一份檢查在 CI 上會對每個 PR 再跑一次（`.github/workflows/kb-check.yml`），而且會驗證索引是最新的——**沒跑 `index` 就 commit，PR 會被擋下來**。

### 5. 矛盾偵測（腳本抓不到，只有你能做）

這是最有價值的一步。檢查這次的新結論有沒有跟既有敘述打架：

- `output/vision.md` 還在講被推翻的方向嗎？（**這是最危險的一處**——output 是唯一的對外層）
- `README.md` 的「目前狀態」還準嗎？
- `knowledge/framework/` 有沒有段落跟新決策衝突？
- `ARCHITECTURE.md` 的圖需要更新嗎？（新文件進 knowledge → 圖 2；決策變動 → 圖 1、圖 3；新方案 → 圖 4）

**找到矛盾就修掉，或明確標記為「已知張力」並寫進 DECISIONS.md。** 不要放著。

### 6. 更新 DECISIONS.md

- 新決策：加一條 `D-XX`，寫清楚**決定什麼／否決了什麼／為什麼／依據哪份文件**
- 舊決策被推翻：**不刪**，標記「已推翻」並寫明推翻者
- 新的未決問題：加進第二節，按阻塞程度排序

### 7. Commit 並開 PR

commit message 用繁體中文，寫清楚這個 session 的實質產出（不是檔案清單）。Basil 不需要確認 message。

```bash
git add -A && git commit -m "$(cat <<'MSG'
<一行摘要>

<這個 session 的實質產出，2-5 條>

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
git push -u origin HEAD
gh pr create --title "<標題>" --body "<內容>"
```

PR body 要寫：**做了什麼／為什麼／有哪些需要 Basil 判斷的地方**。

最後回報 PR 連結。**不要 merge。**

---

## 收工前自我檢查

- [ ] 這次對話有價值的結論都進文件了（決策、知識、過程三類）
- [ ] 新／改動的文件都有 `## 關聯`，而且是雙向的
- [ ] `python3 scripts/kb.py all` 沒有 ❌
- [ ] 所有 ⚠️ 逐條看過，該修的修了、該保留的知道為什麼保留
- [ ] `output/vision.md` 與 `README.md` 跟最新結論一致
- [ ] `DECISIONS.md` 反映最新狀態
- [ ] PR 已開，**沒有 merge**

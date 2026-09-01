# output/ — 交付層

> 這裡放**要拿給別人看的東西**。`knowledge/` 是給自己與未來 session 讀的，`output/` 是給工程師、NGO、學研單位看的。

## 交付物的形態：prototype 優先，spec 為輔

**不寫大份 markdown PRD。** 決策見 [DECISIONS.md](../DECISIONS.md) D-08。

理由很直接：這個 repo 最終要交給別人實作，而**可以打開來點的 HTML mockup，比 20 頁文字規格有效得多**。文字規格描述介面，mockup 就是介面——對方不用在腦裡重建你的想像。「做到 prototype 跟人溝通」本來就是這個 repo 自己定的終點。

```
output/
  vision.md        對外立場與方向（唯一的散文式文件）
  prototype/       可跑的 HTML mockup ← 交付物本體
  spec/            附在 mockup 旁的簡短說明，不是獨立規格書
```

## `prototype/`

單檔 HTML，打開就能點，不需要 build、不需要後端。每個 prototype 一個資料夾，附一份 `README.md` 說明：

1. **這版在展示什麼**（哪個流程、哪個畫面）
2. **刻意不展示什麼**（避免對方以為沒做到的是漏掉的）
3. **哪些數字是假的**（mockup 一定有假資料，要說清楚哪些是編的）

## `spec/`

只寫 **mockup 看不出來的東西**。看得出來的不要重複寫一遍——那就退回文字規格了。

該寫的：資料模型、狀態轉換（例如覆蓋地圖 🔴/🟢/⚪ 怎麼變）、邊界條件、明確不做的範圍。

## 目前狀態

**兩個資料夾都是空的。** 這不是遺漏——v1 場景（U-07）與 North Star（U-09）還沒定案，現在做 prototype 會做到錯的東西上。

先解 [DECISIONS.md](../DECISIONS.md) 的 U-01（需求資料從哪來）——那是覆蓋地圖能不能成立的前提，也直接決定第一個 prototype 該長什麼樣。

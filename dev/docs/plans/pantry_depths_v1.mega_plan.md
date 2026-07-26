# Pantry Depths V1 Mega Plan：一週原型與渲染移植

> **Status**: 已排程。Repository scaffold 已完成（v0.1.0，`npm run verify` 綠燈），三個 Plan 已建立，下一步是 `/implement pantry_rules_01`。
> **Supersedes**: 無。
> **本文性質**: 執行時以 §5 為工單；§1–§4 與 §6–§8 是決策依據與背景，供未來重新評估時參考。
> **權威邊界**: 本文擁有架構、交付範圍與 future work。實作前的公式與數字由[設計文件](../design/pantry-depths_v1.md) 擁有；對應規則與 content 落地後由 codebase 接手。設計意圖與 Frozen extensions 不會過期，[報告](../reports/) 是給人看的實作視圖。

---

## 1. 里程碑定義

### 1.1 V1 出貨的定義

一個可以從第一層走到結局的第一人稱格子地牢，外加兩份讓人不必讀原始碼就能 review 的報告。

出貨條件（全部必須成立）：

1. 玩家能從 B1 起點走到 B5，打倒公主，看到結局演出。
2. 五層地圖、三色鑰匙、六扇門、四次數值升級、隱藏牆與溫泉全部可用。
3. 戰鬥完全確定性：相同輸入序列永遠產生相同結果。
4. 所有數值住在 `src/content/`，不是散在渲染或輸入程式碼裡。
5. `npm run verify` 綠燈。
6. 平衡報告可由指令重新生成，且與當前 content 一致。
7. 架構導覽報告存在，且能回答「加一隻敵人要動哪幾個檔」。

### 1.2 時程預算

| 項目                         | 估計                 |
| ---------------------------- | -------------------- |
| 總預算                       | 一週                 |
| Child 數量                   | 11 個 + 1 個平行項目 |
| 單一 child 上限              | **1 天**             |
| 前置文件（本文 + 三份 plan） | 半天                 |

**單一 child 超過一天沒收就是估錯了。** 這是本專案唯一的早期警報訊號，不要忽略它。

### 1.3 移植量的實測基準

`port-ref/game.js`：833 行、48 個函式。

| 去向                 | 內容                                                                                                       | 量            |
| -------------------- | ---------------------------------------------------------------------------------------------------------- | ------------- |
| 搬進 `presentation/` | textures、raycast、floor casting、atmosphere、hands、minimap、audio                                        | 約 450–500 行 |
| **直接刪除**         | `updateEnemies`／`findNextDirection`／`lineOfSight`／`canEnemyMove`（全部 AI）、`drinkPotion`、`drawChest` | 約 90 行      |
| 重寫進 `core/`       | `cellAt`、`isSolid`、`attack`、`interact`、`hurtPlayer`                                                    | 不算移植      |
| 移進 `ui/`           | `updateHud`、`updateObjectives`、`showToast`                                                               | 小            |

移植的實際規模是約 500 行，不是 833 行。刪掉的 AI 是本作最大的簡化：敵人永遠不移動。

---

## 2. 權威模型

三層文件加 codebase，各有不同壽命。同一件事只能住在一個地方。

| 來源                    | 擁有                                                | 壽命                           |
| ----------------------- | --------------------------------------------------- | ------------------------------ |
| **本 Mega Plan**        | 架構、交付範圍、落地順序、跨切面不變式、future work | 到 milestone 結束              |
| **Plan**                | 該組的行為需求、child overview                      | 到該 plan 收掉                 |
| **Implementation Spec** | 檔案座標、函式、落地順序                            | 到 child ship                  |
| **`src/content/`**      | **所有實際數值**                                    | 永久                           |
| **`src/core/`**         | **所有規則與公式**                                  | 永久                           |
| **設計文件**            | Frozen extensions 範圍契約、設計意圖                | 永久                           |
| 設計文件的數值章節      | 數字（暫時）                                        | **到 `src/content/` 存在為止** |
| **HTML 報告**           | 實作後的真相，給人看的視圖                          | 隨 codebase 重新生成           |

### 2.1 設計文件的到期規則

`dev/docs/design/pantry-depths_v1.md` 第五、六、七、十節（傷害公式、玩家數值、敵人表與成本矩陣、生命預算）在對應的 `src/content/` 與 `src/core/` 檔案存在之後**降級為歷史紀錄**。之後那些數字若與 codebase 不一致，**codebase 是對的**，設計文件不需要回頭修。

不會過期的部分：第一節的 Frozen extensions 範圍契約，以及各節的設計意圖說明（為什麼不能後退、為什麼顏色對應路／攻／防、為什麼溫泉是彩蛋）。**沒有任何程式碼能編碼「我們刻意不做 X」**，那只能住在文件裡。

### 2.2 為什麼要有報告

Codebase 是數值的唯一權威，但一堆沒有註解的常數沒辦法 review。報告的存在就是為了讓人不必讀 `src/content/` 也能判斷平衡是否合理、不必讀 `src/presentation/` 也能知道一次 Action 怎麼流動。

見 §6。

---

## 3. 設計原則（全程不變式）

### 3.1 保留

1. **戰鬥零隨機數。** 相同輸入序列永遠產生相同結果。這是平衡模擬可行的前提，也讓每一次 playtest 死亡都可以精確重現。
2. **`core/` 不碰 DOM。** 不 import 任何其他層、不使用瀏覽器 global、不認識 canvas。以 `npm run check:boundaries` 機械強制。
3. **數值住 `content/`。** `core/` 與 `presentation/` 裡不得出現遊戲數字的字面值。
4. **敵人只有五個欄位**：位置、HP、攻擊、防禦、外觀。沒有速度、視野、行為、狀態。
5. **移植不改行為。** 見 §4.2。

### 3.2 消滅

1. 敵人 AI、尋路、追擊、視野判定——`port-ref` 裡的這些全部刪除，不是註解掉。
2. 金幣、寶箱、藥水、背包格、裝備、經驗值、商店。
3. Pointer lock、滑鼠視角、奔跑。
4. Runtime 迷宮生成。生成器只存在於 `dev/tools/`，不進 build。
5. 存檔。

### 3.3 成功度量（檔案預算）

| 層                  | 預算           | 超標代表                     |
| ------------------- | -------------- | ---------------------------- |
| `src/core/`         | < 400 行       | 規則以外的東西跑進來了       |
| `src/content/`      | 純資料，零邏輯 | 有分支就是規則，該去 `core/` |
| `src/presentation/` | 約 500 行      | 超過就是移植變成了重構       |
| `src/ui/`           | < 200 行       | HUD 開始長出狀態             |

---

## 4. 風險與歷史失敗模式

### 4.1 Child 在實作期繁殖

**歷史事故**：前一個專案的前端 plan 拆出 `13a`、`13b`、`13c1`，presentation 重構吃掉近一週。

**診斷**：這不是層數不夠，是 child 邊界在實作期才被發現不對，於是就地生出子代。多加一層 parent 不會阻止下面繁殖。

**對策**：

1. **Child overview 在 plan 變 active 之前必須寫完**（`plan_standard.md` 已有此要求）。
2. **每個 Plan 的 child 編號從 `01` 重新開始**，ID 永遠是 `<plan_scope>_<NN>` 兩段。要生 `13c1` 的衝動出現時，它在命名上無處可去——那個訊號會逼你回去檢查邊界。
3. **實作中途需要新增 child = 範圍警報**，停下來重新劃邊界，不要就地生子代。

### 4.2 移植變成重構

**這是本專案最高的風險項目**，Plan B 獨立存在就是為了關住它。

渲染移植之所以會爆炸，永遠是因為「搬過來」在過程中悄悄變成「順手改好」。對策是把**搬**和**改**拆成不同的 child：

- **`pantry_presentation_01`（搬）**：驗收標準是保留的 presentation 能力可與 `port-ref/` 並排比對，沒有非預期差異。只准移動程式碼、拆檔、刪除已裁掉的功能。
- **`pantry_presentation_02`（改）**：非同步載入、距離 tint、預烘白閃——全部是新功能，全部歸這裡。

在 `pantry_presentation_01` 期間發現「這裡順手改一下會更好」的任何念頭，一律記進 `pantry_presentation_02` 或 §8，不當場改。

### 4.3 素材生成的風格不一致

五隻敵人分次生成會得到五種畫風，而且是要全部重做才修得掉的那種。對策見 §5 平行項目 S。

---

## 5. Plan 分組與落地順序（工單）

分組判準是**一個 Plan 只有一種驗證方式**。不是按 child 數量分堆，是按「怎麼證明它對」分堆——因為 Acceptance Criteria 必須能用同一種語言寫完。

| Plan                                                    | Scope                 | 驗證方式                                  | 風險   |
| ------------------------------------------------------- | --------------------- | ----------------------------------------- | ------ |
| **[A. Rules and Content](pantry_rules.plan.md)**        | `pantry_rules`        | Unit test + debug viewer + 生成的平衡報告 | 低     |
| **[B. Presentation Port](pantry_presentation.plan.md)** | `pantry_presentation` | 與 `port-ref/` 在保留能力範圍內並排比對   | **高** |
| **[C. Feel and Endgame](pantry_feel.plan.md)**          | `pantry_feel`         | 手動試玩與鍵盤／無障礙檢查                | 中     |
| **S. Enemy Sprite Art（平行項目）**                     | `pantry_sprite_art`   | 目視 + 風格一致性                         | 中     |

### Plan A — Rules and Content

Gameplay rules 與 gameplay content 的全部內容。Presentation 與 feel 擁有的設定仍然落在 `content/`，但隨各自 Plan 建立，避免 Plan A 提前放入尚無 owner 的數值。這組先落地，因為其他所有東西都以它為基準做平衡，而且它在最終 renderer 之前就能靠 unit test、debug viewer 與報告完整觀察。

| Child             | 焦點                                                                      |
| ----------------- | ------------------------------------------------------------------------- |
| `pantry_rules_01` | Dev-only debug hub、tool catalog、debug route 與 production 隔離          |
| `pantry_rules_02` | 傷害公式、擊殺成本模型、敵人與門數值、unit test、combat explorer          |
| `pantry_rules_03` | 格子朝向、Action、相鄰反擊、鑰匙門樓梯、可破壞牆、溫泉與 2D action viewer |
| `pantry_rules_04` | 五層地圖離線烘焙、手工配置、連通性驗證與 floor viewer                     |
| `pantry_rules_05` | Harness scenario、route replay 與平衡報告生成                             |

`pantry_rules_01` 先建立觀察面，但不創造假的 gameplay model；第一個實際 viewer 隨 `pantry_rules_02` 落地。所有 viewer 都讀真正的 snapshot／semantic event，操作也走正式 command boundary，不得複製公式或直接竄改 state。

`pantry_rules_02` 的驗收特別明確：**設計文件的成本矩陣逐格變成 test case**，包含 `—` 那幾格穿不透的狀況。同一個 change 拿掉 `--passWithNoTests`。

### Plan B — Presentation Port

從 `port-ref/` 把渲染搬過來。

| Child                    | 焦點                                                                                          |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| `pantry_presentation_01` | 渲染層移植：raycast、floor casting、程序化材質、氛圍、手部、minimap、音效。保留能力的行為不變 |
| `pantry_presentation_02` | Sprite pipeline：非同步載入階段、距離 tint 與暖色火把加成、預烘白閃                           |

並排比對只涵蓋保留的 presentation 能力，不包含已裁掉的 AI、寶箱、金幣、藥水、舊 HUD、pointer lock、滑鼠視角或連續移動。

`pantry_presentation_02` 的三件事都是真正的新工作，不是移植。特別是**距離 tint**——現行實作只用 `globalAlpha` 淡出，沒有距離變暗，換成正常打光的圖檔後遠處敵人會在紫黑走廊裡發亮。

### Plan C — Feel and Endgame

只能靠玩才知道對不對的部分。

| Child            | 焦點                                                                         |
| ---------------- | ---------------------------------------------------------------------------- |
| `pantry_feel_01` | Runtime 與輸入：離散補間、補間期間鎖輸入、`S` 的拒絕回饋                     |
| `pantry_feel_02` | HUD：DOM overlay，玩家攻防、鑰匙、樓層、探索 minimap、面向敵人的數值面板     |
| `pantry_feel_03` | VFX 與兩個下限狀況：Block 藍框、`無法穿透`、側面威脅提示、裂痕階段、溫泉暖光 |
| `pantry_feel_04` | 公主、結局演出、死亡畫面與統計                                               |

`pantry_feel_01` 有一條容易漏的規則：**反擊在補間開始時就結算完成，動畫只是表現**。不要讓動畫時間影響遊戲狀態。

### 平行項目 S — Enemy Sprite Art

**不屬於任何 Plan，不擋任何東西，也不被任何東西擋。**

五張固定 512×512 PNG（蝙蝠、地精、骷髏、守衛、公主）加公主的倒下圖。它獨立的理由有二：

1. 它是素材生產，不是程式工作，驗證方式（風格一致性）與任何一個 Plan 都不同。塞進 Plan A 或 B 會讓那個 Plan 的 Acceptance Criteria 變成四不像。
2. 它有唯一的不確定性來源（生成結果可能要重來），把它放進關鍵路徑會讓程式進度被素材卡住。

**程式端一路使用 `port-ref` 的程序化 sprite 當 placeholder**，素材什麼時候好就什麼時候換進去。`pantry_presentation_02` 的載入管線對「載進來的是什麼圖」不做假設。

先寫 style spec（色碼、描邊粗細、剪影規則、平光要求），五隻在同一次作業中一起產出。

### 落地順序

```text
pantry_rules_01 → pantry_rules_02 → pantry_rules_03 ─┬─→ pantry_rules_04 → pantry_rules_05
                                                     │
pantry_presentation_01 ──────────────────────────────┼─→ pantry_presentation_02
                                                     │
                                                     └─→ pantry_feel_01 → pantry_feel_02 → pantry_feel_03 → pantry_feel_04

S 全程平行，隨時可以插入
```

- `pantry_presentation_01` 沒有任何依賴，它是純移植，可以與早期 Rules children 同時進行。
- `pantry_rules_04`（地圖）需要 `pantry_rules_03` 的格子語意才能驗證連通性。
- `pantry_rules_05`（報告）需要前四個 Rules children 全部到位。
- `pantry_feel_01` 需要 `pantry_rules_03` 與 `pantry_presentation_01`。
- `pantry_feel_03` 需要 `pantry_presentation_02` 與 `pantry_feel_02`。

### 明確不做的事

- 不做瀏覽器自動化測試。手動試玩就是 e2e，`dev/agent_rules/test_operations.md` 已記錄為長期缺口。
- 不做 `src/platform/` 與 `src/shared/`。V1 沒有持久化、桌面殼或跨 feature 共用需求。
- 不做設定選單（音量除外）。
- 不做第六層、真魔王戰、二週目。
- 不在 `pantry_presentation_01` 期間改進任何渲染行為。

---

## 6. 報告產出

兩份，分開。分開的理由是**覆寫安全**：生成的那份隨時可以重跑覆蓋，手寫的那份不會被蓋掉。

| 報告     | 路徑                                               | 性質                                 | 誰產出            |
| -------- | -------------------------------------------------- | ------------------------------------ | ----------------- |
| 平衡報告 | `dev/docs/reports/pantry_depths_balance.html`      | **生成**，由 harness 從 content 重算 | `pantry_rules_05` |
| 架構導覽 | `dev/docs/reports/pantry_depths_architecture.html` | **手寫**，描述已實作的真相           | milestone 收尾    |

### 6.1 平衡報告（生成）

內容全部從 `src/content/` 與 `src/core/` 重算，**在結構上不可能過期**：

- 敵人表
- 成本矩陣（5 個 Stage × 5 種敵人）
- 必經路線 HP 預算表
- 五層鑰匙／門連通性驗證：沒有鑰匙鎖在自己顏色的門後、必經傷害不超過最大生命
- 每層敵人配置與可繞過性

這份報告把調平衡從「玩 15 分鐘」變成「跑 200 毫秒」。

### 6.2 架構導覽（手寫）

參照 `tickstrike-web` 的 `tick-flow-map.html` 與 `meridian-idle` 的 `nautical_chart_navigation_map.html`：自足 HTML、深淺色主題、錨點分節、以「原始碼導覽入口」收尾。

至少要能回答：

- 一次 Action 從按鍵到畫面的完整流程
- 層邊界為什麼這樣切，以及邊界是怎麼被機械強制的
- **加一隻敵人要動哪幾個檔**
- 加一層樓要動哪幾個檔

本次里程碑只建立這兩份報告的**框架**，內容隨對應 child 落地後補齊。

---

## 7. 決策記錄

| #   | 決策                                                               | 理由                                                                                         |
| --- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| 1   | 採用 game-devkit，`platform: web-react`，無 profile                | `/implement` 是實際工作方式，不是額外開銷。web-react 是唯一 Web 軸                           |
| 2   | 宣告 no-React 偏離                                                 | 專案是 TypeScript + Canvas 2D。九份平台標準中三份的 trigger 永不觸發                         |
| 3   | 不用 React／Pixi／GSAP                                             | HUD 是八個數字沒有樹；raycaster 不經過 scene graph；補間必須與回合結算同步，不能交給外部時鐘 |
| 4   | 渲染用 Canvas，HUD 用 DOM                                          | 回合制 HUD 一秒只變兩次；Canvas 文字沒有排版且對輔助技術不存在                               |
| 5   | 地圖離線烘焙，生成器不進 build                                     | Runtime 生成會逼出一整套連通性與可通關性驗證框架，成本遠高於遊戲本身且對玩家不可見           |
| 6   | 敵人改固定 512×512 sprite，環境維持程序化                          | 角色需要剪影辨識度；牆地天花需要可平鋪與透視取樣                                             |
| 7   | 溫泉無限次補滿                                                     | 定位是彩蛋兼 debug 工具。主線平衡不依賴它，必經路線在不使用溫泉的前提下可通關                |
| 8   | 無存檔，死亡整局重來                                               | 單局 12–18 分鐘，所有數字對玩家可見，死亡永遠是規劃錯誤                                      |
| 9   | 三層文件 + 兩份報告                                                | 見 §2                                                                                        |
| 10  | 每個 Plan 的 child 從 `01` 重新編號                                | 見 §4.1                                                                                      |
| 11  | 移植與改進分成不同 child                                           | 見 §4.2                                                                                      |
| 12  | Sprite 素材獨立平行，不進任何 Plan                                 | 見 §5                                                                                        |
| 13  | Rules 第一個 child 先建 dev-only debug hub，後續 viewer 隨規則落地 | 在最終 renderer 之前提供真實 snapshot／command 的觀察面，避免用假規則或一路抓瞎              |
| 14  | Debug tooling 的 shared extraction 不阻擋 V1                       | 先以第二個 Web consumer 驗證 hub 與多種 viewer，再由 game-devkit 的獨立工作抽出通用契約      |

---

## 8. 開放問題

不阻擋開工。前四項只有 playtest 能回答，最後兩項是流程本身的實驗結果。

1. **必經成本 90 of 120 是否留了足夠的犯錯空間。** 調整順序是先降 B2 骷髏的攻擊（6 → 5），再動公主。平衡調整一律改 `src/content/`，絕不改 `src/core/`。
2. **公主 40 的成本佔通關時生命的比重是否夠有壓迫感。** 過輕的話提高她的攻擊而不是 HP——HP 只會拉長回合數。
3. **死亡直接重來整局是否過於挫折。** 唯一允許的備案是「回到當層樓梯口，保留已開的門與已拾取鑰匙，生命補到 30%」，仍然不加存檔。採用與否是產品決策。
4. **玩家是否看得懂「無法穿透」而不是以為遊戲壞了。** 若不夠明顯，加一次性教學提示。
5. **三層結構（Mega → Plan → Spec）在一週專案上是否過重。** 本專案是這個結構的試跑；結束後把實際體感寫成 `mega_plan_standard.md` 餵回 game-devkit。
6. **`/implement` 不會自動往上讀 Mega Plan**，它只讀 spec 與其直接 parent plan。因此本文不得放任何 child 實作時需要知道的資訊。這條在跑過幾個 child 後要回頭驗證有沒有漏接。

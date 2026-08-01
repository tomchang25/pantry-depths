# Demo 工具鏈改造計畫

給作者自己看的。設計依據是 `dev/docs/design/pantry_demo_core.design.md`，那份文件的「嚴禁私自參考」同樣適用於這裡：本文只寫已經決定的東西，沒決定的列進最後的開放問題，不自己填。

這份文件用中文寫、而且滿是檔案路徑，兩件事都違反 `plan_standard.md`。這是一條登記過的 deviation，理由寫在 `dev/standards/work_lifecycle.addendum.md`，不是漏掉。

## 已定案的前提

- Workbench 存出來的單位是**一張 Map**，不是一個 floor。floor 是 runtime 組裝出來的，不是編輯器的儲存單位。（術語已定案：**map** 是一份內容、**room** 是 map 裡的一塊、**floor** 是一次 run 對一張 map 的使用、**level** 是難度數字且已被佔用，四個字的完整定義在 `dev/docs/archived/map_contract_foundation.plan.md`。）
- `dev/tools/floor-set/generator.ts` 留著當新 Map 產生器的骨架。
- **所有 authored 數值走同一條存檔路徑。** 一個開發期端點、一張白名單、一個目標一個驗證器。Map 是它的下一個目標，不是自己長一套。這條已經做完了，第 5 到 7 階直接接上去。

## 進度

**第 0 到 4 階全部做完。** 交付的內容記在 `CHANGELOG.md` 的 `The Demo Tool Chain`：可嵌入的 render 面板、Entity Workbench、HUD Workbench、裝飾分頁，加上後來長出來的 body／pickup／carried 三個調參分頁；`src/ui/` 刪掉了；多目標存檔端點在 `dev/tools/run-authoring-request.ts`。

**第 5 階起未開始，而且它現在的前置條件是另一份計畫**：`dev/docs/archived/map_contract_foundation.plan.md`。

刪剩下的連帶狀態，維持原判：`src/content/floor/floor-catalog.ts`、`src/content/floors/provisional-floor-set.json`、`src/core/run-state.ts` 目前只有測試在用，它們跟舊 schema 一起死在第 5 階。完整刪除清單在第 5 階那一節。`src/content/combat/enemies.ts` 讓 demo 透過 `EnemyAppearanceId` 拖著整套回合制戰鬥數學，這件事不在本計畫範圍，**而且目前沒有任何計畫擁有它**。

`DEBUG_TOOLS` 目前五筆：`three-block`、`three-preview`、`entity-workbench`、`hud-attack-workbench`、`floor-workbench`。最後一筆是舊的 FloorSet 工具，第 5 階才處理；前兩筆是 3D 那條線的產物，跟本計畫無關。

## 第 5 階開始之前要先對過的漂移

樓層迴圈與威脅預告兩條線都已經出貨（記在 `CHANGELOG.md` 的 `The Demo Floor Loop` 與 `Telegraphed Threats And Directional Damage`），而它們動到的正好是第 5 階要寫契約的那些東西。下面三件是**已經在 runtime 成真的事實**，不是本文提案的內容，第 5 階的 Map 契約要對著它們重寫而不是照本文照抄：

- 一個 floor 現在是 1 大 4 小：三間業務房（祭壇／溫泉／血祭壇）加一間撤離房，四邊各一間。本文原本寫的是 1 大 3 小。而在新術語下這五塊**都是 room**，主區不再是「網格的中間」。
- 四間小房的種類是固定的，抽的是**哪一間貼哪一邊**。
- tile 種類已經多出 `mortar`（迫擊砲台），而且 `open` / `filled` 之外的通行與視線規則長出了不只一條。第 5 階「沿用 demo `maze.ts` 現有的 tile 種類」這句仍然成立，但那個清單比本文寫的時候長。

## 階段順序

| 階  | 內容                 | 依賴                                                |
| --- | -------------------- | --------------------------------------------------- |
| 5   | Map / Room Workbench | `dev/docs/archived/map_contract_foundation.plan.md` |
| 6   | 新 Room 產生器       | 5                                                   |

原本的第 5 階同時包含「Map 契約」與「Map Workbench」。**契約那半已經拆出去**，成為 `dev/docs/archived/map_contract_foundation.plan.md`，理由是它是機械改動、驗收條件是「跑起來一模一樣」、可以被 `/goal` 一路跑完，而編輯器三樣都不是。本計畫從此只擁有編輯器與產生器。

**原本的第 6 階「在 Map 裡試玩」砍掉**，改成主頁吃 `?map=<id>`，由契約計畫交付。舊的第 7 階遞補成第 6 階，而且它的單位從 Map 降成 Room。

四個開放問題答掉三個，剩下的那一題不擋任何事。

---

## 第 5 階　Map / Room Workbench

契約、驗證、載入路徑、`?map=` 全部由 `dev/docs/archived/map_contract_foundation.plan.md` 交付。這一階開工的前提是那份計畫四個 child 全部落地，因為編輯器要寫進去的那個格式在那之前不存在。

### 兩個編輯面

**Edit Map**

- 固定 room 清單：哪幾間一定在，各佔哪個槽
- 抽籤 room 清單：池子裡有哪些
- 抽幾個
- 不可重複（暫定，不做權重）
- 存檔

**Edit Room**

- 幾格
- 敵人上限
- Respawn 速度與數量
- 結構：Manual（自己刻）或 Random（產生器生）
- 有 role 的話，是哪一個
- 存檔

### 兩層驗證，職責不同

- **存檔前驗**：擋在造成違規的那個控制項上。抽籤數大於池子大小、room 尺寸塞不進宣告的槽、面積超過上限 —— 這些在檔案靜止時就知道，所以不能等到載入。
- **載入後驗**：擋一次抽籤的結果。這一抽有沒有留下一條到出口的路。這件事在檔案靜止時不可知。

前驗是編輯器的事，後驗是契約計畫交付的東西，這一階只要不繞過它。

### Workbench 本身

不要就地改舊的。舊的 `floor-authoring.ts` 每個 mutation 都吃 `floorId` 加一個要被換掉的 entity union，`floor-map.ts` 的圖例、鑰匙計數、樓層切換鈕全是為「一組樓層」寫的。並排寫新的，能用了再刪舊的。

要刪的東西，總計 **5314 行**：

| 檔案                                            | 行數 |
| ----------------------------------------------- | ---- |
| `src/app/debug/floor-map.ts`                    | 1154 |
| `src/content/floor/floor-validation.ts`         | 862  |
| `src/app/debug/floor-authoring.ts`              | 843  |
| `src/core/run-state.ts`                         | 617  |
| `src/app/debug/floor-workbench.ts`              | 575  |
| `src/content/floors/provisional-floor-set.json` | 481  |
| `src/content/floor/floor-schema.ts`             | 354  |
| `src/app/debug/floor-viewer.ts`                 | 228  |
| `src/content/floor/floor-catalog.ts`            | 200  |

連帶：`test/unit/content/floor/` 兩支、`test/unit/core/run-state.test.ts`，以及 `test/unit/dev/tools/floor-set/generator.test.ts` 視第 6 階怎麼處理骨架而定。`test/e2e/debug-route.spec.ts` 只有一支，開工前確認它有沒有列舉工具。

可以直接搬的：

- `debug-shell.ts` 頁面與面板外殼，原封不動
- `dev/tools/authoring/authoring-api.ts` 已經是多目標的，`map` target 由契約計畫加好
- 「草稿 → 修改 → 驗證 → 匯出／存檔」這個流程形狀
- 「畫網格、點格子、右邊出 Cell Editor」這個互動模式

畫面走 `render-panel.ts`，跟其他 workbench 同一條。

### 為什麼沒有「在 Workbench 裡試玩」

原本的第 6 階要在 `render-panel.ts` 面板裡直接玩編輯中的圖。砍掉，理由是那一階自己就寫了它的毒：單張 Map 試玩時貼在旁邊的房間不存在，spawn 的來源跟實戰不一樣，所以「試玩」看到的不是遊戲會發生的事。一個跟實戰不一樣的試玩就是第二個真實來源，而本計畫第 5 條原則正是「預覽只讀，作者在預覽裡看到的任何東西都不能變成遊戲真實的來源」。

取而代之的是主頁 `?map=<id>`：玩到的就是遊戲，沒有任何接縫，成本是一個 query 參數加一個分支。

代價要認：**未存檔的草稿沒辦法這樣玩**，編輯迴圈變成存檔 → 開分頁。Workbench 可以放一顆按鈕開 `?map=<剛存的>` 新分頁，那是這一階可做的最大讓步。

## 第 6 階　新 Room 產生器

拿 `dev/tools/floor-set/generator.ts` 當骨架。抽掉鑰匙門配置那一層，保留網格開鑿、決定論的種子處理、以及「產出前先驗證」的形狀。

**產出的單位是一間 Room，不是一張 Map。** 這是新模型帶來的簡化：Random 是 room 的屬性，所以產生器只要會生一間房，map 怎麼把房組起來不干它的事。

**Key and Door Generator 砍掉**，鑰匙與門等它真的要做的時候再回來。

---

## 從舊 plan 搬過來的五條原則

`pantry_scene_authoring.plan.md` 的文件本身不留，但這五條想法要帶走。

1. **擺放與組裝分家。** 「哪些元件組成這個裝飾、各自偏移多少」屬於預設集；「這個裝飾放在哪一格、原點在哪」屬於擺放。擺放可以移動原點，不能移動、增減或重設任何元件。少了這條，你在 Asset Workbench 看到的組合就不保證是實際 render 的組合，預覽等於白看。
2. **變體是獨立命名的身份，不是逐次覆寫。** 暖色火把和冷色火把是兩筆目錄，不是一筆加參數。代價是目錄變長，換來所有在用的組合都被人組過也看過。
3. **為什麼非要即時預覽。** 第一張畫出來的 authored floor，鑰匙拾取物大約兩倍大、浮在視線高度。造成它的那個數值通過了 review、type check 和每一道自動化關卡——它只在唯一能顯示它的媒介裡是錯的。這就是這幾個 Workbench 存在的全部理由。
4. **每個 authored 數值都要可編輯且會存檔**，不能只活在 renderer 常數裡。只能靠改原始碼調的數字，等於永遠不會被調。招式、裝飾、body、pickup、carried 都已經照這條搬出來了，Map 是同一條路上的下一個。
5. **預覽只讀。** 預覽消費的是已經定案的內容，對它沒有權威。作者在預覽裡看到的任何東西都不能變成遊戲真實的來源；要寫入內容只能走跟編輯器同一條 mutation。

---

## 已答的問題

原本四題，答掉三題。答案記在這裡，不要再問一次。

1. **抽籤池存在哪。** 存在 Map 裡。Map 持有固定 room 清單與抽籤 room 清單，加上抽幾個，暫定不可重複、不做權重。不是另一個檔案。
2. **敵人上限與深度怎麼疊。** 兩個都不是 Map 的屬性：**上限與 respawn 是 room 的屬性**（因為身體會在房間之間走動，一個屬於整張圖的上限說得出總數、說不出任何一塊裝了什麼），**深度是 floor 的屬性**（floor 是一次 run 對一張 map 的使用）。所以同一張 map 出現在 B2 和 B7 是兩個 floor 共用一份內容，room 說基礎值，floor 說深度加成。
3. **小 Map 貼哪一邊、洞開在哪。** 結構題降級成欄位題：主區也是 room 之後，「貼哪一邊」變成固定 room 清單上的槽位欄位。洞的位置維持組裝時打通，authored 指定留到有人真的需要時再加。

## 開放問題

剩這一題，**不擋任何事**，第 5 階可以在它沒答的情況下開工。

1. **裝飾預設集要不要做成組合體**（一個身份含裝飾＋光＋特效，各帶自己的偏移），還是維持現在的扁平一層、之後再合併？舊 plan 主張前者，但那是為它自己的內容遷移寫的，不是為這裡。**目前所有裝飾相關工作已暫停**，所以這題連帶暫停。

還有一題同樣不擋事，先記著：**slime 要不要也做成八方向的 authored body。** Entity Workbench 的缺口矩陣已經把「blob 沒有方向也沒有 walk」變成一格看得見的空白。這題現在跟 `TODO.md` 的 `Three.js, With The Block Skeleton As The Prototype` 草稿會在同一個畫面上碰頭 —— 走 runtime 3D 的話它問的就不再是同一件事。

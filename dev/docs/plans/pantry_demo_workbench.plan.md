# Demo 工具鏈改造計畫

給作者自己看的。設計依據是 `dev/docs/design/pantry_demo_core.design.md`，那份文件的「嚴禁私自參考」同樣適用於這裡：本文只寫已經決定的東西，沒決定的列進最後的開放問題，不自己填。

這份文件用中文寫、而且滿是檔案路徑，兩件事都違反 `plan_standard.md`。這是一條登記過的 deviation，理由寫在 `dev/standards/work_lifecycle.addendum.md`，不是漏掉。

## 已定案的前提

- Workbench 存出來的單位是**一張 Map**，不是一個 Level。Level 是 runtime 組裝出來的，不是編輯器的儲存單位。
- `dev/tools/floor-set/generator.ts` 留著當新 Map 產生器的骨架。
- **所有 authored 數值走同一條存檔路徑。** 一個開發期端點、一張白名單、一個目標一個驗證器。Map 是它的下一個目標，不是自己長一套。這條已經做完了，第 5 到 7 階直接接上去。

## 進度

**第 0 到 4 階全部做完。** 交付的內容記在 `CHANGELOG.md` 的 `The Demo Tool Chain`：可嵌入的 render 面板、Entity Workbench、HUD Workbench、裝飾分頁，加上後來長出來的 body／pickup／carried 三個調參分頁；`src/ui/` 刪掉了；多目標存檔端點在 `dev/tools/run-authoring-request.ts`。

**第 5 階起未開始。**

刪剩下的連帶狀態，維持原判：`src/content/floor/floor-catalog.ts`、`src/content/floors/provisional-floor-set.json`、`src/core/run-state.ts` 目前只有測試在用，它們跟舊 schema 一起死在第 5 階。`src/content/combat/enemies.ts` 讓 demo 透過 `EnemyAppearanceId` 拖著整套回合制戰鬥數學，這件事不在本計畫範圍。

`DEBUG_TOOLS` 目前三筆：`entity-workbench`、`hud-attack-workbench`、`floor-workbench`。最後一筆是舊的 FloorSet 工具，第 5 階才處理。

## 第 5 階開始之前要先對過的漂移

樓層迴圈與威脅預告兩條線都已經出貨（記在 `CHANGELOG.md` 的 `The Demo Floor Loop` 與 `Telegraphed Threats And Directional Damage`），而它們動到的正好是第 5 階要寫契約的那些東西。下面三件是**已經在 runtime 成真的事實**，不是本文提案的內容，第 5 階的 Map 契約要對著它們重寫而不是照本文照抄：

- 一個 Level 現在是 1 大 4 小：三間業務房（祭壇／溫泉／血祭壇）加一間撤離房，四邊各一間。本文原本寫的是 1 大 3 小。
- 四間小房的種類是固定的，抽的是**哪一間貼哪一邊**。
- tile 種類已經多出 `mortar`（迫擊砲台），而且 `open` / `filled` 之外的通行與視線規則長出了不只一條。第 5 階「沿用 demo `maze.ts` 現有的 tile 種類」這句仍然成立，但那個清單比本文寫的時候長。

## 階段順序

| 階  | 內容                     | 依賴 |
| --- | ------------------------ | ---- |
| 5   | Map 契約與 Map Workbench | —    |
| 6   | 在 Map 裡試玩            | 5    |
| 7   | 新 Map 產生器            | 5    |

第 5 階排在最後不是因為它不重要，是因為它下面那四個開放問題還沒答。四題全部只擋第 5 階及其之後。

---

## 第 5 階　Map 契約與 Map Workbench

### Map 契約

一張 Map 就是一個檔案。內容：

- 身份與種類：大 Map，或小 Map 之一（種類對照上面那條漂移）
- 尺寸：大 21×21，小 7×7
- 格子：沿用 demo `maze.ts` 現有的 tile 種類，不要再發明第二套
- 大 Map 專屬：下層樓梯位置、敵人數量上限、重生速度
- 小 Map 專屬：它承載的那個設施

**Key and Door Generator 砍掉**，鑰匙與門是設計文件「待加內容」裡的東西，等它真的要做的時候再回來。

### 驗證縮到剩兩條

舊的 `floor-validation.ts` 有 862 行，絕大部分是鑰匙順序、門順序、樓梯連結、出口可達性的拓樸搜尋。新模型下不需要。剩下的保證只有：

1. 水坑不能圍成圓——設計文件點名的唯一卡死危險點。
2. 大 Map 保證有一條到樓梯的路，可以是要劈過去的。

這是幾十行的事。

### Workbench 本身

不要就地改舊的。舊的 `floor-authoring.ts` 每個 mutation 都吃 `floorId` 加一個要被換掉的 entity union，`floor-map.ts` 的圖例、鑰匙計數、樓層切換鈕全是為「一組樓層」寫的。並排寫新的，能用了再刪舊的——`floor-workbench.ts`、`floor-authoring.ts`、`floor-map.ts`、`floor-viewer.ts` 加起來約 2800 行，以及它們的測試與 e2e spec。

可以直接搬的：

- `debug-shell.ts` 頁面與面板外殼，原封不動
- `dev/tools/authoring/authoring-api.ts` 已經是多目標的，加一個 `map` target 就好
- 「草稿 → 修改 → 驗證 → 匯出／存檔」這個流程形狀
- 「畫網格、點格子、右邊出 Cell Editor」這個互動模式

畫面走 `render-panel.ts`，跟其他三個 workbench 同一條。

## 第 6 階　在 Map 裡試玩

`generateDemoMaze()` 旁邊加一條路：吃一張 authored Map 而不是現生一張。Workbench 按一個鍵，就在 `render-panel.ts` 那個面板裡直接玩這張圖。

這一階同時回答了預覽的問題——最好的預覽就是能走進去。編輯中的靜態預覽和可試玩之間的差別，只是要不要跑 simulation。

Entity Workbench 為了造假體而切出來的那條窄介面（給一隻 enemy 或一具 death，回一組 `RenderBlob` 與 `RenderSprite`）就是這一階要用的同一條，不必再挖第二條。

敵人這裡有一個接縫：上限與重生速度是大 Map 的屬性，但敵人可以走進貼在旁邊的小 Map。也就是說試玩時的盤面是拼接後的，spawn 卻是大 Map 的。單張 Map 試玩時小 Map 不存在，這個差異要在試玩模式裡講清楚，不要讓作者以為試玩等於實戰。

## 第 7 階　新 Map 產生器

拿 `generator.ts` 當骨架。抽掉鑰匙門配置那一層，保留網格開鑿、決定論的種子處理、以及「產出前先驗證」的形狀。產出的單位同樣是一張 Map。

---

## 從舊 plan 搬過來的五條原則

`pantry_scene_authoring.plan.md` 的文件本身不留，但這五條想法要帶走。

1. **擺放與組裝分家。** 「哪些元件組成這個裝飾、各自偏移多少」屬於預設集；「這個裝飾放在哪一格、原點在哪」屬於擺放。擺放可以移動原點，不能移動、增減或重設任何元件。少了這條，你在 Asset Workbench 看到的組合就不保證是實際 render 的組合，預覽等於白看。
2. **變體是獨立命名的身份，不是逐次覆寫。** 暖色火把和冷色火把是兩筆目錄，不是一筆加參數。代價是目錄變長，換來所有在用的組合都被人組過也看過。
3. **為什麼非要即時預覽。** 第一張畫出來的 authored floor，鑰匙拾取物大約兩倍大、浮在視線高度。造成它的那個數值通過了 review、type check 和每一道自動化關卡——它只在唯一能顯示它的媒介裡是錯的。這就是這幾個 Workbench 存在的全部理由。
4. **每個 authored 數值都要可編輯且會存檔**，不能只活在 renderer 常數裡。只能靠改原始碼調的數字，等於永遠不會被調。招式、裝飾、body、pickup、carried 都已經照這條搬出來了，Map 是同一條路上的下一個。
5. **預覽只讀。** 預覽消費的是已經定案的內容，對它沒有權威。作者在預覽裡看到的任何東西都不能變成遊戲真實的來源；要寫入內容只能走跟編輯器同一條 mutation。

---

## 開放問題

沒有自己填，需要決定。四題全部擋第 5 階及其之後。

1. **抽籤池存在哪。** Workbench 存的是一張 Map，但設計文件說手工地圖「有機率被抽到」。那個機率、那個池子、哪些 Map 在池裡，是另一個檔案還是 Map 自己帶的欄位？
2. **敵人上限與深度怎麼疊。** 上限與重生速度是大 Map 的屬性，但「越下層敵人等級越高、數值越強」是深度的屬性。同一張大 Map 出現在 B2 和 B7 時，上限一樣、等級不同？還是大 Map 自己就綁定深度區間？
3. **小 Map 貼哪一邊、洞開在哪。** runtime 現在是每層抽一邊，破磚牆的洞由組裝時打通。authored Map 要不要能指定可接合的邊、能不能指定洞的位置，是這一題要答的。
4. **裝飾預設集要不要做成組合體**（一個身份含裝飾＋光＋特效，各帶自己的偏移），還是維持現在的扁平一層、之後再合併？舊 plan 主張前者，但那是為它自己的內容遷移寫的，不是為這裡。

還有一題不擋任何事，先記著：**slime 要不要也做成八方向的 authored body。** Entity Workbench 的缺口矩陣已經把「blob 沒有方向也沒有 walk」變成一格看得見的空白，而 `TODO.md` 的 `A Real 3D Layer Instead Of Baked Sprite Sheets` 草稿已經記下第二具 authored body 的代價。這兩件事會在同一個畫面上碰頭。

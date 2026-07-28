# Demo 工具鏈改造計畫

給作者自己看的。設計依據是 `dev/docs/design/pantry_demo_core.design.md`，那份文件的「嚴禁私自參考」同樣適用於這裡：本文只寫已經決定的東西，沒決定的列進最後的開放問題，不自己填。

取代 `pantry_scene_authoring.plan.md` 與 `pantry_scene_06_start_and_end_markers.sketch.md`。那兩份寫給 FloorSet 契約，契約要沒了。

## 已定案的前提

- Workbench 存出來的單位是**一張 Map**，不是一個 Level。Level（1 大 3 小）是 runtime 組裝出來的，不是編輯器的儲存單位。
- `dev/tools/floor-set/generator.ts` 留著當新 Map 產生器的骨架。
- `src/harness/` 與平衡報告那條線收掉。
- 裝飾與實體是**同一個工具的兩個分頁**，不是兩個工具。
- 先做可嵌入的 render 面板。

## 一件更正

`pantry_scene_authoring.plan.md` 說 renderer 假設自己獨佔全視窗、自跑 frame loop、自己觀察 resize、自管 asset 生命週期，並把「把它塞進面板」列為整份計畫唯一的真實風險。**那份描述已經過期。**

現在的 `CanvasGameplayRenderer`：canvas 由建構子傳入、圖片由外面載好傳入、`resize()` 由呼叫端傳三個數字、`render()` 由呼叫端每幀呼叫。frame loop 在 `demo-surface.ts`。鎖死視窗與隱藏捲軸的是 `demo.css`，不是 renderer。

所以嵌入是小事。真正的工作量在後面：**要有東西可以 render**——把 authored Map 投影成 `RenderScene`，等同於 `demo-scene.ts` 為 demo world 做的事。

---

## 第 0 階　收掉舊的回合制那條線

刪除：

- `src/harness/` 六個檔案（action-scenario、balance-analysis、floor-scenario、provisional-route、route-replay、route-scenario），約 560 行
- `src/runtime/game-session.ts`——只有 harness 用它
- `dev/tools/generate-balance-report.ts`、`dev/tools/balance/report-html.ts` 與對應的 npm script
- `test/unit/harness/` 兩個測試、`test/unit/dev/tools/balance/report-html.test.ts`、`test/fixtures/balance-scenario.ts`
- `dev/docs/reports/pantry_depths_balance.html`（產生物）

刪完之後的連帶狀態，先記著不處理：

- `src/content/floor/floor-catalog.ts` 與 `src/content/floors/provisional-floor-set.json` 會變成只有測試在用。它們在第 2 階跟舊 schema 一起死。
- `src/core/run-state.ts` 靠 `content/floor/` 續命，同樣在第 2 階了結。
- `src/content/combat/enemies.ts` 目前是 demo 拿 `EnemyAppearanceId` 的地方，而它 import `@/core/combat`。也就是說 demo 透過一個型別把整套回合制戰鬥數學拖著。這是之後的事，不在本計畫範圍。

## 第 1 階　可嵌入的 render 面板

一個共用模組，Map Workbench 的預覽和 Asset Workbench 兩個分頁都用它。

它負責的：建立 canvas、載入圖片、建構 renderer、跑自己的 rAF、每幀 `resize()` + `render()`、關閉時停掉迴圈。

它不負責的：場景內容。呼叫端每幀給它一個 `RenderScene`。

兩點要注意：

- 同一頁可能開兩個實例（例如編輯中的地圖預覽 + 資產預覽）。圖片載入要共用快取，不要各載一份。
- 程序貼圖是在建構子裡建的，每個實例一份。多開一個實例就是多一份記憶體，先接受，量測到痛再說。

## 第 2 階　Map 契約與 Map Workbench

### Map 契約

一張 Map 就是一個檔案。內容：

- 身份與種類：大 Map，或四種小 Map 之一（祭壇／溫泉／任務祭壇／血祭壇）
- 尺寸：大 21×21，小 7×7
- 格子：沿用 demo `maze.ts` 現有的 tile 種類（open / border / stone / wood / water / barricade / filled），不要再發明第二套
- 大 Map 專屬：下層樓梯位置、敵人數量上限、重生速度
- 小 Map 專屬：它承載的那個設施

**Key and Door Generator 砍掉**，鑰匙與門是設計文件「待加內容」裡的東西，等它真的要做的時候再回來。

### 驗證縮到剩兩條

舊的 `floor-validation.ts` 有 862 行，絕大部分是鑰匙順序、門順序、樓梯連結、出口可達性的拓樸搜尋。新模型下不需要。剩下的保證只有：

1. 水坑不能圍成圓——設計文件點名的唯一卡死危險點。
2. 大 Map 保證有一條到樓梯的路，可以是要劈過去的。

這是幾十行的事。

### Workbench 本身

不要就地改舊的。舊的 `floor-authoring.ts` 每個 mutation 都吃 `floorId` 加一個要被換掉的 entity union，`floor-map.ts` 的圖例、鑰匙計數、樓層切換鈕全是為「一組樓層」寫的。並排寫新的，能用了再刪舊的。

可以直接搬的：

- `debug-shell.ts` 頁面與面板外殼，原封不動
- `dev/tools/floor-set/authoring-api.ts` 與 `run-floor-authoring-request.ts` 存檔端點，只要改指向新目錄
- 「草稿 → 修改 → 驗證 → 匯出／存檔」這個流程形狀
- 「畫網格、點格子、右邊出 Cell Editor」這個互動模式

## 第 3 階　在 Map 裡試玩

`generateDemoMaze()` 旁邊加一條路：吃一張 authored Map 而不是現生一張。Workbench 按一個鍵，就在第 1 階那個面板裡直接玩這張圖。

這一階同時回答了預覽的問題——最好的預覽就是能走進去。編輯中的靜態預覽和可試玩之間的差別，只是要不要跑 simulation。

敵人這裡有一個接縫：上限與重生速度是大 Map 的屬性，但敵人可以走進貼在旁邊的小 Map。也就是說試玩時的盤面是拼接後的，spawn 卻是大 Map 的。單張 Map 試玩時小 Map 不存在，這個差異要在試玩模式裡講清楚，不要讓作者以為試玩等於實戰。

## 第 4 階　Asset Workbench

一個工具，兩個分頁，共用第 1 階的面板。

**裝飾分頁**：火把、藤蔓這類貼在牆上或地上的東西。可調大小、在 tile 或 wall 上的位置、貼附的面。旁邊即時看到結果。

**實體分頁**：敵人、Wall、祭壇、拒馬。切換動畫狀態，預覽損壞階段。

兩個分頁的骨架相同——選一個資產、調參數、旁邊看結果——差別只在主題和參數集。

## 第 5 階　新 Map 產生器

拿 `generator.ts` 當骨架。抽掉鑰匙門配置那一層，保留網格開鑿、決定論的種子處理、以及「產出前先驗證」的形狀。產出的單位同樣是一張 Map。

---

## 從舊 plan 搬過來的五條原則

`pantry_scene_authoring.plan.md` 的文件本身不留，但這五條想法要帶走。

1. **擺放與組裝分家。** 「哪些元件組成這個裝飾、各自偏移多少」屬於預設集；「這個裝飾放在哪一格、原點在哪」屬於擺放。擺放可以移動原點，不能移動、增減或重設任何元件。少了這條，你在 Asset Workbench 看到的組合就不保證是實際 render 的組合，預覽等於白看。
2. **變體是獨立命名的身份，不是逐次覆寫。** 暖色火把和冷色火把是兩筆目錄，不是一筆加參數。代價是目錄變長，換來所有在用的組合都被人組過也看過。
3. **為什麼非要即時預覽。** 第一張畫出來的 authored floor，鑰匙拾取物大約兩倍大、浮在視線高度。造成它的那個數值通過了 review、type check 和每一道自動化關卡——它只在唯一能顯示它的媒介裡是錯的。這就是這兩個 Workbench 存在的全部理由。
4. **每個 authored 數值都要可編輯且會存檔**，不能只活在 renderer 常數裡。只能靠改原始碼調的數字，等於永遠不會被調。
5. **預覽只讀。** 預覽消費的是已經定案的內容，對它沒有權威。作者在預覽裡看到的任何東西都不能變成遊戲真實的來源；要寫入內容只能走跟編輯器同一條 mutation。

---

## 開放問題

沒有自己填，需要決定：

1. **抽籤池存在哪。** Workbench 存的是一張 Map，但設計文件說手工地圖「有機率被抽到」。那個機率、那個池子、哪些 Map 在池裡，是另一個檔案還是 Map 自己帶的欄位？
2. **敵人上限與深度怎麼疊。** 上限與重生速度是大 Map 的屬性，但「越下層敵人等級越高、數值越強」是深度的屬性。同一張大 Map 出現在 B2 和 B7 時，上限一樣、等級不同？還是大 Map 自己就綁定深度區間？
3. **小 Map 貼哪一邊、洞開在哪。** 是隨機挑邊，還是小 Map 自己指定可接合的邊？破磚牆的洞是產生時決定，還是 Map 作者指定？
4. **裝飾預設集要不要一開始就做成組合體**（一個身份含裝飾＋光＋特效，各帶自己的偏移），還是先做扁平的一層、之後再合併？舊 plan 主張前者，但那是為它自己的內容遷移寫的，不是為這裡。

---

## 順序

第 0 階跟第 1 階彼此無關，誰先都行。第 2 階要等第 1 階，因為 Map Workbench 一開始就該有預覽。第 3 階要等第 2 階。第 4 階只等第 1 階，可以跟第 2、3 階並行。第 5 階最後。

# Demo 工具鏈改造計畫

給作者自己看的。設計依據是 `dev/docs/design/pantry_demo_core.design.md`，那份文件的「嚴禁私自參考」同樣適用於這裡：本文只寫已經決定的東西，沒決定的列進最後的開放問題，不自己填。

這份文件用中文寫、而且滿是檔案路徑，兩件事都違反 `plan_standard.md`。這是一條登記過的 deviation，理由寫在 `dev/standards/work_lifecycle.addendum.md`，不是漏掉。

取代 `pantry_scene_authoring.plan.md` 與 `pantry_scene_06_start_and_end_markers.sketch.md`。那兩份寫給 FloorSet 契約，契約要沒了。

## 已定案的前提

- Workbench 存出來的單位是**一張 Map**，不是一個 Level。Level（1 大 3 小）是 runtime 組裝出來的，不是編輯器的儲存單位。
- `dev/tools/floor-set/generator.ts` 留著當新 Map 產生器的骨架。
- `src/harness/` 與平衡報告那條線收掉。
- 裝飾與實體是**同一個工具的兩個分頁**，不是兩個工具。
- 先做可嵌入的 render 面板。
- **所有 authored 數值走同一條存檔路徑。** 一個開發期端點、一張白名單、一個目標一個驗證器。Map、招式、裝飾預設集都是它的目標，不是各自長一套。
- **HUD 模組留在 `src/demo/`，`src/ui/` 刪掉。** 理由寫在第 3 階。

## 一件更正

`pantry_scene_authoring.plan.md` 說 renderer 假設自己獨佔全視窗、自跑 frame loop、自己觀察 resize、自管 asset 生命週期，並把「把它塞進面板」列為整份計畫唯一的真實風險。**那份描述已經過期。**

現在的 `CanvasGameplayRenderer`：canvas 由建構子傳入、圖片由外面載好傳入、`resize()` 由呼叫端傳三個數字、`render()` 由呼叫端每幀呼叫。frame loop 在 `demo-surface.ts`。鎖死視窗與隱藏捲軸的是 `demo.css`，不是 renderer。

所以嵌入是小事。真正的工作量在後面：**要有東西可以 render**——把 authored Map 投影成 `RenderScene`，等同於 `demo-scene.ts` 為 demo world 做的事。

---

## 進度

**第 0 階（收掉舊的回合制那條線）已經做完**，`8228fc1`。`src/harness/`、`src/runtime/game-session.ts`、`dev/tools/generate-balance-report.ts`、`dev/tools/balance/`、對應的測試與 fixture、產生出來的 HTML 報告，全部不在了。

同一段時間 `d57e61c` 退掉了四個唯讀 debug 工具，所以 `DEBUG_TOOLS` 現在只剩兩筆：`melee-viewmodel-lab` 與 `floor-workbench`。後者是舊的 FloorSet 工具，第 5 階才處理。

刪剩下的連帶狀態，維持原判：`src/content/floor/floor-catalog.ts`、`src/content/floors/provisional-floor-set.json`、`src/core/run-state.ts` 目前只有測試在用，它們跟舊 schema 一起死在第 5 階。`src/content/combat/enemies.ts` 讓 demo 透過 `EnemyAppearanceId` 拖著整套回合制戰鬥數學，這件事不在本計畫範圍。

**第 1 階起全部未開始。**

## 階段順序

| 階  | 內容                                            | 依賴 |
| --- | ----------------------------------------------- | ---- |
| 1   | 可嵌入的 render 面板                            | —    |
| 2   | Entity Workbench（含 Entities Animation Check） | 1    |
| 3   | HUD and Attack Workbench                        | 1    |
| 4   | 裝飾分頁                                        | 1    |
| 5   | Map 契約與 Map Workbench                        | 1    |
| 6   | 在 Map 裡試玩                                   | 5    |
| 7   | 新 Map 產生器                                   | 5    |

第 2、3、4 階彼此無關，順序隨意，但建議照號碼走。

第 5 階排在後面不是因為它不重要，是因為它下面那四個開放問題還沒答，而第 2、3 階一個都不欠。原本的排序（Map 契約排第 2）會讓整份計畫卡在一個沒人回答的問題上。

---

## 第 1 階　可嵌入的 render 面板

一個共用模組，後面每一個 workbench 都用它。

它負責的：建立 canvas、載入圖片、建構 renderer、跑自己的 rAF、每幀 `resize()` + `render()`、關閉時停掉迴圈。

它不負責的：場景內容。呼叫端每幀給它一個 `RenderScene`。

兩點要注意：

- 同一頁可能開兩個實例（例如編輯中的地圖預覽 + 資產預覽）。圖片載入要共用快取，不要各載一份。
- 程序貼圖是在建構子裡建的，每個實例一份。多開一個實例就是多一份記憶體，先接受，量測到痛再說。

## 第 2 階　Entity Workbench

吃掉原第 4 階的「實體分頁」，並擴寫成一份完整的動作與死法檢查。

### 現在有什麼

**Skeleton Swordsman**——十個 clip，每個 8 方向 × 8 幀，烘成十張 2048 見方的 atlas：`idle` `walk` `attack` `hurt` `block` `death` `deathSeverRight` `deathBlasted` `deathImpaled` `deathDrowned`。

**三隻 slime**——完全不是 sprite。`enemyBlob()` 產出的是程序化的環堆疊，狀態是 `squash` / `leanX,leanY` / `wobbleAmp,wobblePhase` / `sink` / `droop` / `flash` / `alpha`，加三種表情 `normal` `hurt` `attack`，再加一個死後才有的 `split`。

**六種死因**，`DemoDeathCause` = `slain` `cleaved` `drowned` `splattered` `blasted` `impaled`。骨頭那邊映射時 **`splattered` 與 `impaled` 共用 `deathImpaled`**——這是一個已經做掉的合併決定，但目前沒有任何地方能讓人確認它可不可接受。

**被釘飛**：`carriedSkeletonSprite()`。一根 stick 串著整排屍體飛，每具凍在 `deathImpaled` 的 0.62 幀，往後退 `0.3 + index * 0.3`，`verticalAnchor` 跟著 `projectileHeight()` 走。

**撞牆**：`bodyLanding()` 判到 `hitWall` 就走 `splattered`，屍體不落地，改成牆面上一張 decal，貼哪一面由 `snapToFace()` 從飛行方向回推。

**拒馬**：`checkHazards()` 偵到 barricade 格 → `impale()` → 血花加火星 → `impaled`。

**溺水**：`checkHazards()` 設 `drowningSeconds = DROWN_SECONDS`（1.1 秒），`stepDrowning()` 倒數完才 `killEnemy(..., "drowned")`。

### 要能一鍵重現的清單

這張表就是這個工具的驗收標準。

1. 每個 archetype × 每個 clip，**方向轉盤 + 逐幀 scrubber + 播放速度**。
2. 每個 archetype × 每個死因，完整播放。六種都要，並且讓共用 `deathImpaled` 的那兩種能並排看。
3. **被串飛**：可調串幾具、飛行仰角、速度。這是最容易把 `verticalAnchor` 算錯的地方，因為它是唯一一個把 sprite 的錨點跟拋物線綁在一起的路徑。
4. **撞牆濺開**：選牆面方向，看 decal 貼在哪一面、有沒有貼進牆裡。
5. **拒馬**：把敵人推進 barricade 格。
6. **溺水**：看完整 1.1 秒的下沉。
7. **缺口矩陣**：一張「archetype × 狀態」的表。blob 沒有八方向也沒有 walk，skeleton 沒有 blob 的 squash 與 droop。缺的格子要顯示 placeholder，**不是靜默掉回 idle**。

第 7 條才是這個工具真正的價值。其餘六條是「把已經有的東西看清楚」，第 7 條是「知道哪裡還沒有東西」——現在沒有任何地方會告訴你這件事。

### 怎麼做

**A 為主**：lab 自己造假的 `DemoEnemy` / `DemoDeath`，直接呼叫實體投影，把結果畫進第 1 階的面板。能跳到任意狀態、任意幀、任意角度。

**B 為輔**：真 world 加作弊觸發，用來核對 A 造出來的假資料沒有偏離真的。demo 已經有 `T`（測試競技場）和 `P`（凍結敵人）當前例。

代價是 `demo-scene.ts` 裡的 `skeletonSprite`、`skeletonDeathSprite`、`carriedSkeletonSprite`、`enemyBlob`、`deathBlobs` 目前都是私有的，要切出一條窄介面：**給一隻 enemy 或一具 death，回一組 `RenderBlob` 與 `RenderSprite`**。

這條縫不是為 lab 一次性挖的——第 6 階「在 Map 裡試玩」需要的是同一條。

## 第 3 階　HUD and Attack Workbench

一個工具，兩個分頁。原本的 `melee-viewmodel-lab` 是它的 Attack 分頁的前身。

### Attack 分頁

現在的 lab 有四樣東西是假的，而每一樣正好都是想調的那樣：

| 現況                                       | 要改成                                          |
| ------------------------------------------ | ----------------------------------------------- |
| `drawDungeon()` 手繪的假走廊               | 第 1 階的真面板，真牆真地板，擺幾個靶           |
| `connected: false`，沒有 aim               | 餵一個假的 swing target，讓弧線真的移到命中點上 |
| 沒有 `world.impact` 頓挫、沒有 camera kick | 接上。命中反饋有一半在這裡                      |
| `MELEE_ATTACKS` 是寫死的常數               | authored JSON，調了就存                         |

第二列要講清楚：demo 呼叫 `drawMeleeAttack()` 時帶著這一刀落在哪裡，弧線會移過去；lab 註解自己承認「lab 裡沒有東西可以打，所以每條弧都停在被 author 的位置」。也就是說**現在 lab 看到的那條弧，跟遊戲裡看到的不是同一條**，而 lab 存在的唯一理由就是看到遊戲裡的那條。

還有一件現在完全沒地方看的事：`4f22fe3` 讓一次揮砍打到弧內所有東西，**那個判定弧從來沒被畫出來過**。分頁要把它疊在畫面上，擺一排靶確認誰被打到。

### 招式參數怎麼 data-drive

`MELEE_ATTACKS` 從常數變成 `src/content/viewmodel/melee-attacks.json`。`melee-viewmodel.ts` 從「定義 + 繪製」縮成「繪製」，定義從 JSON 來，遊戲跟 lab 讀同一份。

**為什麼是 `src/content/` 而不是 `src/demo/`**：`.dependency-cruiser.cjs` 的 `tooling-imports-only-its-measured-set` 只准 `dev/tools/` import `src/core/` 與 `src/content/`。存檔端點要驗證它寫出去的東西，就必須讀得到 schema；schema 放 `src/demo/` 的話端點讀不到，boundary 直接擋。這條規則替我們選好了，Map 的 JSON 之後也落在同一個地方，理由一樣。

存檔端點本身：`dev/tools/run-floor-authoring-request.ts` 現在是為 floor-set 寫死的。改成吃一個 target id，每個 target 對應一個白名單路徑加一個驗證器。第一批 target 是 `meleeAttacks`，第 5 階加 `map`，第 4 階加 `decor`。不要為每個 workbench 長一個新端點。

### HUD 分頁

現況：HUD 整個埋在 `demo-surface.ts` 裡，是 DOM 加 `demo.css`，直接讀 `DemoWorld` 現推。血條、readout、bless bar、minimap、message、card、overlay 全在同一個 `mountDemo()` 的閉包裡。想確認「HP 剩三點時那條血條的紅夠不夠紅」，就得真的被打到剩三點。

要做的是抽一個純資料的 HUD model：HP 與 maxHp、depth、held、面前那面牆、altar、enemies、kills、walls broken、bless icons、message、pending card、minimap 需要的那幾組座標。`demo-surface` 負責從 world 推導它，HUD 模組只吃 model。分頁就是一排欄位餵 model，旁邊即時看，並且能疊在真的 render 面板上檢查對比度。

**HUD 模組留在 `src/demo/`。** `src/ui/` 那條 boundary 規則禁止它 import `@/demo/`，而且 `src/ui/` 不在「禁止測試 demo 半邊」的名單裡（禁的只有 `src/demo/` 和 `src/presentation/`）。把 HUD 放進去會意外地讓它變成可測的，那跟「demo 靠玩來驗」是兩套規矩。

所以 `src/ui/` 刪掉——它現在只有一個 `.gitkeep`，而它本來要裝的那個 HUD 已經跟著舊方向一起消失了。連帶要動的三處：`.dependency-cruiser.cjs` 的 `ui-imports-within-its-measured-set` 規則、`dev/standards/project_structure.addendum.md` 的 Layer Status 表、`TODO.md` 的 `DOM Component Test Layer` 草稿（它現在寫著「`src/ui/` ships player-facing DOM」，已經不成立）。

## 第 4 階　裝飾分頁

火把、藤蔓這類貼在牆上或地上的東西。可調大小、在 tile 或 wall 上的位置、貼附的面。旁邊即時看到結果。

骨架跟第 2 階的實體分頁相同——選一個資產、調參數、旁邊看結果——差別只在主題和參數集。存檔走第 3 階那個端點的 `decor` target。

## 第 5 階　Map 契約與 Map Workbench

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

不要就地改舊的。舊的 `floor-authoring.ts` 每個 mutation 都吃 `floorId` 加一個要被換掉的 entity union，`floor-map.ts` 的圖例、鑰匙計數、樓層切換鈕全是為「一組樓層」寫的。並排寫新的，能用了再刪舊的——`floor-workbench.ts`、`floor-authoring.ts`、`floor-map.ts`、`floor-viewer.ts` 加起來約 2800 行，以及它們的測試與 e2e spec。

可以直接搬的：

- `debug-shell.ts` 頁面與面板外殼，原封不動
- `dev/tools/floor-set/authoring-api.ts` 的形狀，接到第 3 階那個多目標端點上
- 「草稿 → 修改 → 驗證 → 匯出／存檔」這個流程形狀
- 「畫網格、點格子、右邊出 Cell Editor」這個互動模式

## 第 6 階　在 Map 裡試玩

`generateDemoMaze()` 旁邊加一條路：吃一張 authored Map 而不是現生一張。Workbench 按一個鍵，就在第 1 階那個面板裡直接玩這張圖。

這一階同時回答了預覽的問題——最好的預覽就是能走進去。編輯中的靜態預覽和可試玩之間的差別，只是要不要跑 simulation。

敵人這裡有一個接縫：上限與重生速度是大 Map 的屬性，但敵人可以走進貼在旁邊的小 Map。也就是說試玩時的盤面是拼接後的，spawn 卻是大 Map 的。單張 Map 試玩時小 Map 不存在，這個差異要在試玩模式裡講清楚，不要讓作者以為試玩等於實戰。

## 第 7 階　新 Map 產生器

拿 `generator.ts` 當骨架。抽掉鑰匙門配置那一層，保留網格開鑿、決定論的種子處理、以及「產出前先驗證」的形狀。產出的單位同樣是一張 Map。

---

## 從舊 plan 搬過來的五條原則

`pantry_scene_authoring.plan.md` 的文件本身不留，但這五條想法要帶走。

1. **擺放與組裝分家。** 「哪些元件組成這個裝飾、各自偏移多少」屬於預設集；「這個裝飾放在哪一格、原點在哪」屬於擺放。擺放可以移動原點，不能移動、增減或重設任何元件。少了這條，你在 Asset Workbench 看到的組合就不保證是實際 render 的組合，預覽等於白看。
2. **變體是獨立命名的身份，不是逐次覆寫。** 暖色火把和冷色火把是兩筆目錄，不是一筆加參數。代價是目錄變長，換來所有在用的組合都被人組過也看過。
3. **為什麼非要即時預覽。** 第一張畫出來的 authored floor，鑰匙拾取物大約兩倍大、浮在視線高度。造成它的那個數值通過了 review、type check 和每一道自動化關卡——它只在唯一能顯示它的媒介裡是錯的。這就是這幾個 Workbench 存在的全部理由。
4. **每個 authored 數值都要可編輯且會存檔**，不能只活在 renderer 常數裡。只能靠改原始碼調的數字，等於永遠不會被調。第 3 階把 `MELEE_ATTACKS` 搬出來就是這一條的第一次執行。
5. **預覽只讀。** 預覽消費的是已經定案的內容，對它沒有權威。作者在預覽裡看到的任何東西都不能變成遊戲真實的來源；要寫入內容只能走跟編輯器同一條 mutation。

---

## 開放問題

沒有自己填，需要決定。四題全部只擋第 5 階及其之後，第 1 到 4 階不欠任何一題。

1. **抽籤池存在哪。** Workbench 存的是一張 Map，但設計文件說手工地圖「有機率被抽到」。那個機率、那個池子、哪些 Map 在池裡，是另一個檔案還是 Map 自己帶的欄位？
2. **敵人上限與深度怎麼疊。** 上限與重生速度是大 Map 的屬性，但「越下層敵人等級越高、數值越強」是深度的屬性。同一張大 Map 出現在 B2 和 B7 時，上限一樣、等級不同？還是大 Map 自己就綁定深度區間？
3. **小 Map 貼哪一邊、洞開在哪。** 是隨機挑邊，還是小 Map 自己指定可接合的邊？破磚牆的洞是產生時決定，還是 Map 作者指定？
4. **裝飾預設集要不要一開始就做成組合體**（一個身份含裝飾＋光＋特效，各帶自己的偏移），還是先做扁平的一層、之後再合併？舊 plan 主張前者，但那是為它自己的內容遷移寫的，不是為這裡。

第 2 階會逼出第五題，但它不擋任何事，先記著：**slime 要不要也做成八方向的 authored body。** 缺口矩陣會把「blob 沒有方向也沒有 walk」變成一格看得見的空白，而 `TODO.md` 的 `A Real 3D Layer Instead Of Baked Sprite Sheets` 草稿已經記下第二具 authored body 的代價。這兩件事會在同一個畫面上碰頭。

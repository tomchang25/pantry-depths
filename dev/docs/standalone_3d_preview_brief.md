# Pantry Depths Standalone 3D Preview

## 文件用途

這份文件描述一個獨立的 Three.js 3D 實驗場，用來判斷 Pantry Depths 是否值得採用 runtime 3D 人物、骨架動畫、可拆解角色、程序化場景物件與彈道效果。

它是保留完整資訊的 execution brief，不是正式 plan 或 implementation spec。文件本身不代表 3D 技術已獲准進入正式 gameplay；它的任務是建立一個能親手操作、觀看與比較的 proof of concept，讓後續決策建立在實際畫面，而不是建立在架構推測。

## 背景

目前 Pantry Depths 的即時畫面由 Canvas 2D raycaster 繪製。骷髏敵人是預先烘焙的方向性 sprite atlas，不是 runtime 3D 模型：

- 每個角色動作包含多方向、多影格的圖片。
- 動作切換是選擇 atlas frame，不會在瀏覽器中更新骨架。
- 牆面、地板、霧、角色遮擋與特效都由 Canvas renderer 負責。
- 現有正式 runtime 沒有 Three.js dependency。

研究 `tomchang25/skate-threejs` 後，可確認其最有價值的部分不是生成資產本身，而是：

- 明確的 transform ownership。
- 人物 root motion、局部骨架姿勢與道具 transform 分離。
- quaternion 動畫與分層姿勢。
- 每幀只有一個主要 writer 擁有骨架。
- 從動畫切換到 ragdoll 或破壞狀態時，先擷取當前 world pose，再交接 ownership。
- 骨架、腳底、接觸物與可動道具之間使用實際量測，而不是只依賴動畫看起來大致正確。

本實驗場會採用這些設計原則，但不直接搬運滑板專案的程式、Core27 資料、角色資產或滑板專用修正。

參考來源：

- <https://github.com/tomchang25/skate-threejs>
- <https://github.com/tomchang25/skate-threejs/blob/main/src/motion/rigs.js>
- <https://github.com/tomchang25/skate-threejs/blob/main/src/motion/anim-runtime.js>
- <https://github.com/tomchang25/skate-threejs/blob/main/src/skate/skater-anim.ts>
- <https://github.com/tomchang25/skate-threejs/blob/main/src/skate/skater-rig.ts>
- <https://github.com/tomchang25/skate-threejs/blob/main/src/skate/ragdoll.ts>

## 核心目標

建立一個完全獨立、development-only 的 Three.js preview，讓使用者可以在同一個頁面中切換並操作五個 3D showcase：

1. 骷髏劍士攻擊動畫。
2. 骷髏劍士被劈成兩半。
3. 骷髏劍士被炸成四散骨頭。
4. 程序化祭壇模型。
5. 臼炮瞄準、發射、彈道與爆炸動畫。

完成後，使用者應能直接回答：

- 低模 3D 骷髏是否適合 Pantry Depths 的視覺語言。
- runtime 骨架動畫是否比 sprite atlas 更容易調整與擴充。
- 死亡拆解是否值得使用 3D，而不是繼續烘焙更多死亡 atlas。
- 程序化祭壇與臼炮是否有足夠的體積感、動態感與可讀性。
- 下一步應該走完整 runtime 3D、Canvas/Three.js 混合，或只用 3D 離線產生 2D atlas。

## 專案邊界與入口

建議的實作根目錄：

```text
src/app/debug/three-preview/
```

建議開發入口：

```text
/debug/three-preview
```

這個位置符合以下需求：

- 所有 3D preview 實作集中在單一 standalone folder。
- 透過既有 debug catalog 進入。
- 只在 development route 動態載入。
- 不讓 Three.js preview 進入 production-reachable module graph。
- 不修改現有 Canvas renderer、demo simulation 或正式 gameplay。

除了下列必要整合點，實作不應散落到其他資料夾：

- `package.json` 與 lockfile：加入 Three.js dependency。
- debug tool catalog：註冊 `/debug/three-preview`。
- 必要時更新共享的 debug CSS，但優先讓 preview 自己持有樣式。

不得為了 prototype 修改正式遊戲的 `RenderScene`、`CanvasGameplayRenderer`、敵人資料格式或現有 sprite assets。

## 建議目錄

```text
src/app/debug/three-preview/
├─ three-preview.ts
├─ three-preview.css
├─ preview-runtime.ts
├─ preview-controls.ts
├─ preview-contracts.ts
├─ model/
│  ├─ skeleton-swordsman.ts
│  ├─ sword.ts
│  ├─ altar.ts
│  └─ mortar.ts
├─ animation/
│  ├─ motion-player.ts
│  ├─ skeleton-poses.ts
│  └─ sword-attack.ts
├─ effect/
│  ├─ bisect.ts
│  ├─ bone-explosion.ts
│  ├─ projectile.ts
│  ├─ impact.ts
│  └─ particle-system.ts
└─ scene/
   ├─ sword-attack-scene.ts
   ├─ bisect-scene.ts
   ├─ bone-explosion-scene.ts
   ├─ altar-scene.ts
   └─ mortar-scene.ts
```

目錄可以因實際程式量合併，但所有權需保持清楚：

- `model/` 建立物件和 hierarchy。
- `animation/` 擁有姿勢資料、時間與 quaternion sampling。
- `effect/` 擁有動畫交接後的碎片、彈道與粒子。
- `scene/` 只組合每一個 showcase，不重複底層模型或物理公式。
- preview shell 只管理 UI、選場景、resize、render loop 與 dispose。

## 技術選擇

### Renderer

第一版使用 `THREE.WebGLRenderer`。

不在 proof of concept 階段使用 WebGPU、TSL、自訂 shader pipeline 或完整 post-processing。Renderer 需要：

- 啟用 antialias。
- 啟用陰影。
- 正確處理 resize。
- 對 device pixel ratio 設上限，避免 preview 在高 DPR 裝置浪費大量 GPU 資源。
- 提供低解析度／pixelated 顯示切換，協助判斷與 Pantry Depths 現有畫面的相容性。

### Camera

使用 `PerspectiveCamera` 與 `OrbitControls`：

- 滑鼠左鍵旋轉。
- 滾輪縮放。
- 右鍵或中鍵平移。
- 每個 showcase 提供合理的預設觀察角度。
- Reset 同時還原場景與相機。

### Assets

第一版不依賴外部 GLB、Genex、Meshy、Blender export 或遠端 CDN。

所有物件使用 Three.js primitive geometry、`BufferGeometry` 或少量程式化 mesh 建立。原因是這一版要先判斷 runtime 技術與動作表現，避免模型下載、授權、骨架格式和資產品質變成阻塞因素。

如果第一版證明方向成立，第二版才加入：

- rigged GLB。
- `GLTFLoader`。
- bind-pose retarget。
- 共用 humanoid skeleton profile。
- Blender 或其他工具輸出的 animation clips。

### 物理

第一版不加入 Rapier、Ammo、Cannon 或其他物理引擎。

碎片、炮彈與簡單碰撞採固定、可控的小型 integrator：

- position。
- linear velocity。
- quaternion orientation。
- angular velocity。
- gravity。
- ground-plane collision。
- restitution。
- friction／sleep threshold。

這樣可以直接看出 ownership handoff 是否正確，也避免把「物理引擎是否調得好」誤判成「3D 技術是否適合」。

## Preview Shell

頁面至少包含：

- 場景選擇。
- Play。
- Pause。
- Reset。
- 動畫速度：`0.25×`、`0.5×`、`1×`。
- Auto replay。
- Skeleton helper 顯示。
- Wireframe 顯示。
- Ground grid 顯示。
- Pixelated／normal rendering 切換。
- FPS、draw calls、triangles 顯示。
- 當前 animation phase／state 顯示。

場景切換時必須完整 dispose：

- geometry。
- material。
- texture。
- renderer-owned scene resources。
- animation frame callbacks。
- DOM listeners。
- OrbitControls。

重複切換 showcase 不應留下前一個場景的物件、光源或持續運行的 update callback。

## 共用骨架與人物模型

### 骨架

建立精簡 humanoid hierarchy：

```text
root
└─ hips
   ├─ spine
   │  └─ chest
   │     ├─ neck
   │     │  └─ head
   │     ├─ leftShoulder
   │     │  └─ leftUpperArm
   │     │     └─ leftForeArm
   │     │        └─ leftHand
   │     └─ rightShoulder
   │        └─ rightUpperArm
   │           └─ rightForeArm
   │              └─ rightHand
   ├─ leftUpperLeg
   │  └─ leftLowerLeg
   │     └─ leftFoot
   └─ rightUpperLeg
      └─ rightLowerLeg
         └─ rightFoot
```

建議以真實的 `THREE.Bone` hierarchy 表示姿勢節點，同時將獨立的低模骨頭 mesh 掛到對應 bone。這提供：

- `SkeletonHelper` 可視化。
- 正常 quaternion hierarchy。
- 每根骨頭可獨立 detach。
- 未來可替換成 SkinnedMesh，而不必重寫 motion state。

第一版不需要連續蒙皮。骷髏本來就是分節結構，使用 rigid bone meshes 可以避開即時切割 skinned geometry，並更接近需要的死亡效果。

### 骷髏外觀

模型應維持：

- 低面數。
- 清楚的頭骨、胸腔、骨盆、上臂、前臂、大腿與小腿輪廓。
- 稍微誇張的比例，以便在遠距離仍看得出姿勢。
- `flatShading` 或相近的硬面低模效果。
- 暖色主光、冷色補光和接地陰影。
- 骨頭不必寫實，但不能只用沒有輪廓意義的白色長方體。

劍必須是獨立模型並固定在右手 socket。它在死亡與爆炸時可以獨立飛出。

## Animation Runtime

建立小型 motion player，而不是把動作邏輯直接散落在 scene update。

每個 pose 儲存需要控制的 bone local quaternion。Clip 儲存：

- duration。
- phases／keyframes。
- bone rotations。
- 可選的 root position。
- loop 或 one-shot。

Sampling 使用 quaternion slerp。骨頭未被 clip 寫入時維持 base pose，不能意外回到任意 bind pose。

Writer 順序保持明確：

```text
base stance
→ lower-body stance/step
→ upper-body attack
→ procedural correction
→ destruction override
```

同一幀只有一個主要 writer 可以提交最終 skeleton pose。死亡或爆炸發生時：

1. 先更新並保存當前 animation pose。
2. 更新 world matrices。
3. 擷取需要交接的 world position、world quaternion 和最近速度。
4. 停止 animation writer 對已 detach 物件的控制。
5. 將 ownership 交給 destruction simulation。

禁止在交接時先把人物 reset 回 idle 或 bind pose。

## Showcase 1：骷髏劍士攻擊

### 行為

循環播放：

```text
idle
→ windup
→ forward step
→ slash
→ follow-through
→ recovery
→ idle
```

### 姿勢要求

- Idle 時身體不能完全對稱，劍放在可讀的預備位置。
- Windup 必須在劍真正揮出前清楚可辨識。
- 下半身維持穩定站姿，攻擊時前腳踏出或承重。
- Hips 和 chest 參與扭轉，不能只轉右手。
- Shoulder、upper arm、forearm 與 wrist 形成連續揮砍。
- 左手負責平衡，不應完全靜止。
- Strike 應是最短、最快的 phase。
- Recovery 必須與 idle 明顯不同，形成可攻擊窗口。
- 劍尖軌跡可選擇性顯示，協助觀察弧線。

### 可觀察資料

- 當前 phase。
- normalized clip time。
- root displacement。
- sword-tip world position。
- 每幀最大 bone angular delta。

## Showcase 2：被劈成兩半

### 行為

```text
站立或攻擊
→ 命中提示
→ 在腰部／脊椎交界斷開
→ 上半身與下半身取得不同速度
→ 上半身翻轉落地
→ 下半身跪倒或側倒
→ 骨頭與劍逐漸停止
```

### 實作方向

- 將角色分為 upper-body assembly 與 lower-body assembly。
- 斷開前保留完整 hierarchy 和 animation。
- 命中時從當前 pose 擷取兩半的 world transforms。
- 斷開後兩半不再由同一 skeleton writer 控制。
- 上半身保留 head、spine、chest 和雙臂。
- 下半身保留 hips 和雙腿。
- 劍可繼續留在手中短暫飛出，也可在第一次撞擊後脫手。
- 加入少量骨屑、魔法碎片或塵霧，不強制使用血液。

### 成功判準

- 斷開瞬間不跳 pose。
- 上下半身從命中前的姿勢延續運動。
- 斷點清楚而不需要 skinned-mesh slicing。
- 落地後不持續抖動或穿過地面。

## Showcase 3：骨頭爆炸飛濺

### 行為

```text
站立
→ 爆炸中心出現
→ 全身 bone meshes detach
→ 骨頭、頭骨與劍沿不同方向飛出
→ 落地彈跳
→ 摩擦減速
→ sleep
```

### 實作方向

- 每個可見骨頭 mesh 變成一個 fragment body。
- 初速由爆炸中心到 fragment 中心的方向決定。
- 增加受限制的隨機散布，不讓結果完全一致，也不讓骨頭全部飛向鏡頭。
- 頭骨、胸腔、骨盆、劍與四肢使用不同質量或 impulse scale。
- angular velocity 由 fragment shape 和 impulse 決定。
- 可使用 deterministic seed，讓 Reset 後容易比較調整。
- 地面 collision 需有 restitution、friction 和 sleep。
- 爆炸中心加入 flash、expanding ring、dust 與少量亮色粒子。

### 成功判準

- 爆炸瞬間仍延續角色當前 pose。
- 骨頭不是從 bind pose 或世界原點生成。
- 不同部位具有可辨識的重量感。
- 所有 fragment 最終停止，scene 可乾淨 reset。

## Showcase 4：祭壇

### 模型

建立一個程序化低模祭壇：

- 三層石製基座。
- 可登高或清楚讀出高度的階梯。
- 中央石盆、碑體或祭台。
- 骷髏、骨柱、尖刺或符文裝飾。
- 發光核心或液體。
- 四周火盆、靈魂火焰或煙霧。
- 明確的正面與攻擊／互動方向。

模型需要在 silhouette 上成立，不能只依靠材質細節。

### 動態

- Emissive 呼吸。
- 浮動符文或環形能量。
- 火焰／靈魂粒子。
- 可切換 dormant 與 active。
- Active 時光色、粒子密度和核心高度改變。

### Preview

- Turntable。
- Free orbit。
- Wireframe。
- 日光與地城光照切換。
- 顯示 object hierarchy 和 draw-call 資訊。

### 成功判準

- 不使用外部模型也能讀成祭壇。
- 近看有結構，遠看有清楚 silhouette。
- Active 狀態不只靠 UI 文字才能辨認。
- 模型可作為未來 boss、房間目標或互動物件的基礎。

## Showcase 5：臼炮炮擊

### Transform hierarchy

```text
root
└─ base
   └─ yawPivot
      └─ pitchPivot
         └─ recoilSlide
            └─ barrel
```

每個節點只擁有一個職責：

- `root`：整座臼炮的位置。
- `yawPivot`：水平瞄準。
- `pitchPivot`：炮管仰角。
- `recoilSlide`：後座和復位。
- `barrel`：模型與 muzzle socket。

### 動畫

```text
idle
→ acquire target
→ yaw/pitch aim
→ short charge
→ muzzle flash
→ recoil
→ smoke
→ projectile arc
→ ground impact
→ shockwave/debris
→ barrel recovery
→ idle
```

### 彈道

- 炮彈使用明確的拋物線。
- Preview 可顯示 trajectory line。
- 炮口位置必須從 muzzle socket 的 world transform 取得。
- 發射速度和 gravity 需集中在場景設定，不散落在 update code。
- Impact point 必須與可視 trajectory 一致。
- Camera 可選擇跟隨炮彈，但預設以固定廣角同時看見炮與落點。

### 整合展示

臼炮場景可以在落點放置一個骷髏 dummy。炮彈命中時重用 bone-explosion system，證明：

- Projectile 和 destruction 沒有互相複製。
- 同一個骨架能從動畫交給爆炸 fragments。
- 祭壇或 boss 未來可以共用同一套攻擊／命中效果。

### 成功判準

- 瞄準、發射、彈道、命中和復位形成完整 sequence。
- 後座發生在正確的 local axis。
- 炮彈從炮口生成，不從 root 或任意固定座標生成。
- 命中點與 trajectory line 對得上。
- 重播不累積炮彈、煙霧、listener 或 fragment。

## 視覺方向

第一版目標不是寫實，而是判斷 3D 是否能與 Pantry Depths 共存：

- 低面數。
- 硬邊、flat-shaded。
- 高對比 silhouette。
- 暖橘色主光、冷藍紫色環境光。
- 深色地面與地城背景。
- 克制的 emissive。
- 可選的低解析度 upscale／pixelated mode。
- 透明背景模式可以保留為診斷選項，但不是正式 compositing 解法。

Preview 需要同時提供：

- 一個較自然的 normal 3D view。
- 一個接近目前遊戲像素密度的 pixelated view。

只有兩者都實際看過，才能判斷應該採 runtime 3D 還是 3D-to-sprite。

## 不在第一版範圍

- 不把 Three.js renderer 疊到現有 Canvas gameplay。
- 不解決 Canvas depth buffer 與 WebGL depth buffer compositing。
- 不替換現有骷髏 sprite。
- 不修改正式敵人 AI、combat 或 death state。
- 不匯入外部人物或動畫。
- 不做 Core27 retarget。
- 不做不同 GLB bind pose 的通用校正。
- 不做 continuous skin。
- 不做即時 skinned mesh 切割。
- 不做完整 ragdoll constraint solver。
- 不加入大型物理 engine。
- 不使用 WebGPU。
- 不建立 production 3D architecture。
- 不把 prototype 的數值提前寫進正式 content schema。

## 建議實作順序

### Step 1：獨立 shell

- 加入 Three.js。
- 建立 debug route 和 lazy-loaded tool。
- 建立 renderer、camera、lights、ground、controls、resize、render loop 與 dispose。
- 建立場景 selector 和 diagnostics。

### Step 2：共用骷髏

- 建立 `THREE.Bone` hierarchy。
- 建立 rigid bone meshes。
- 建立劍與 hand socket。
- 建立 skeleton helper。
- 建立 base stance。

### Step 3：Motion player 與攻擊

- 建立 pose／clip 資料。
- 實作 quaternion sampling。
- 完成 windup、slash、follow-through、recovery。
- 加入 sword-tip trail 與 phase diagnostics。

### Step 4：Destruction handoff

- 擷取 live pose。
- 完成 bisect。
- 完成 bone explosion。
- 建立共用 fragment integrator、ground collision 與 reset。

### Step 5：祭壇

- 建模。
- 加入 dormant／active。
- 加入 emissive 與粒子。
- 加入 turntable 和 light mode。

### Step 6：臼炮

- 建模與 transform hierarchy。
- 瞄準、recoil、smoke。
- Projectile arc、trajectory debug、impact。
- 重用 skeleton bone explosion。

### Step 7：實際觀看與收斂

- 在 normal 與 pixelated view 分別檢視。
- 重播並切換每個場景。
- 記錄 FPS、draw calls、triangles。
- 不把「頁面成功打開」當成視覺驗證。
- 由使用者親自判斷動作、造型、重量和可讀性。

## 驗證方式

這是一個 manual visual preview，不新增自動化畫面測試。

完成實作後：

- 執行 repository 要求的 `npm run verify`。
- 依規範執行需要的 governance check。
- 開啟 `/debug/three-preview`。
- 逐一操作五個場景。
- 每個場景至少 Reset 和 replay 三次。
- 場景之間往返切換，確認 cleanup。
- 分別檢視 normal 與 pixelated mode。
- 記錄看見的結果，而不是只記錄 console 沒有錯誤。

Manual review 至少回答：

- 攻擊有沒有清楚的 windup、strike 和 recovery。
- 劈成兩半是否從 live pose 連續發生。
- 爆炸骨頭是否有重量，而不是粒子噴射。
- 祭壇是否在遠距離仍讀得出來。
- 臼炮是否能從姿勢看出瞄準、發射和後座。
- 整體是否值得繼續投資 runtime 3D。

## 完成判準

這個 proof of concept 完成時：

- `/debug/three-preview` 可以從 debug hub 開啟。
- Five showcase 都可選擇、播放、暫停、重設。
- 場景共用同一套 preview runtime，而不是五個互相複製的 render loop。
- 攻擊動畫使用階層骨架與 quaternion interpolation。
- Bisect 從當前動畫 pose 分離成上下兩半。
- Bone explosion 從當前動畫 pose 分離成獨立 fragments。
- 祭壇是程序化、可環繞觀察的 3D 模型。
- 臼炮具有瞄準、炮口、後座、彈道、命中和復位。
- Mortar impact 可以重用 skeleton destruction。
- Reset 和場景切換不留下可見殘骸或持續 callback。
- Normal 與 pixelated rendering 都能比較。
- 現有 gameplay、Canvas renderer 和正式 content 沒有被修改。
- 使用者能依實際畫面決定下一個方向。

## 最後要做的決策

這個 preview 不自動得出結論。看過後，由使用者在以下方向中選擇：

### A. 正式 runtime 3D

適用於人物、祭壇、臼炮和未來 boss 的 3D 表現明顯優於 sprite，而且效能與美術一致性可接受。

下一步才研究：

- Canvas／WebGL compositing。
- 共同 camera projection。
- Depth ownership。
- Lighting ownership。
- 正式 GLB pipeline。
- 動畫 retarget。
- 多敵人的 animation LOD。

### B. 3D 製作，2D runtime

適用於 3D 動畫和建模有價值，但直接放進遊戲與 Canvas 世界不協調。

下一步建立：

- 離線 Three.js 或 Blender atlas renderer。
- 8 方向／指定 frame 數的自動輸出。
- 共用 rig 和 clips。
- 自動產生目前 `SkeletonClipDefinition` 相容的 assets。

### C. 保持現有 2D pipeline

適用於 3D preview 沒有帶來足夠的可讀性或效率改善。

保留這個 debug tool 作為研究結果，正式 gameplay 不採用其 runtime。

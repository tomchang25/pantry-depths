# 合成音效

## 這份文件是什麼

這是一份 **brief**，規則見 `dev/standards/work_lifecycle.addendum.md`。

- **它不授權任何實作。**
- 它要開的討論是：**demo 要一整套合成的 placeholder 音效，架構長什麼樣、掛在哪裡、覆蓋到什麼程度。** 產出應該是一份 plan；plan 存在的那一刻這份 brief 就刪掉。
- 這份文件不是權威。裡面對 `E:\Code\tickstrike-web` 的描述是 2026-07-31 的閱讀結果，不是那個專案的規格。

---

## 一句話現況

**整個 `src/` 沒有一行音訊程式。** 搜遍 `AudioContext`、`new Audio`、`oscillator`、`gain`、`volume`、`mute`，零命中（唯一的 `ambient` 命中是 workbench 的環境**光**）。

`CHANGELOG.md` 的 `pantry_presentation` 條目提過 "synthesized ambience"，那是舊表現層時期的東西，已經隨著 demo 重寫一起消失。所以這是**從零開始**，沒有要移除的舊實作，也沒有相容包袱。

---

## 使用者的要求（原話轉述）

> Very simple synthesis SFX，我懶得再建一整套 workflow，所以只要 sfx manager 加上非常簡單的 placeholder，覆蓋「所有」需要音效的地方。**數量比品質重要，盡量覆蓋所有地方而且每個都不一樣。**

三個判斷都值得照做：

1. **合成而非資產**：不需要檔案、不需要授權、不需要烘焙管線、不增加 bundle 體積。這正是「不想再建 workflow」的解。
2. **數量優先**：一個聽起來廉價但**存在**的聲音，比一個不存在的聲音好非常多。空白處是玩家唯一會注意到的地方。
3. **每個都不一樣**：這是關鍵約束。五十個不同的難聽聲音是可用的遊戲；五個好聽的聲音重複五十次是折磨。

---

## 讀 `E:\Code\tickstrike-web` 的結果

那個專案是同一套 governance foundation 的另一個 consumer，音訊在 `src/presentation/audio/`，五個檔共約 730 行。它是**用檔案資產**的（`.wav` / `.mp3`），但**分層方式可以整套照抄**，只有最底下那層要換。

### 四層職責

| 層                                                              | 行數 | 職責                                                                                      |
| --------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------- |
| `audio-mixer.ts`                                                | 304  | 唯一擁有 `AudioContext` 的地方。固定的 gain graph、播放、限流、聲部上限、暫停／恢復、銷毀 |
| `cue-library.ts`                                                | 181  | 音效的**資料表**：每個 cue 的來源、音量、限流參數、音高範圍                               |
| `audio-director.ts`                                             | 140  | 語意事件 → cue 的**對應表**。不持有 `AudioContext`，不讀遊戲狀態，射後不理                |
| `rate-limiter.ts`                                               | 46   | 純粹的 per-key sliding window，時鐘可注入                                                 |
| （`music-director.ts` 56 行，單一循環背景樂，本專案暫時用不到） |

### 值得直接抄的設計決定

- **Mixer 的 context 是 lazy 的**，第一次 `unlock()` 才建立，因為瀏覽器擋 user gesture 之前的 context。建構 mixer 本身沒有任何音訊副作用。**Pantry Depths 天生有 gesture** —— 進遊戲要點擊鎖定指標 —— 所以這件事在這裡比在那裡更簡單。
- **沒有 `AudioContext` 建構子時退化成靜音 no-op，永不 throw。** 一個音效系統絕不該讓遊戲開不起來。
- **固定 gain graph**：`effect` / `music` 兩條匯流排 → `master` → destination。音量是從外面**推**進來的（`setVolumes`），mixer 自己不讀設定、不持有遊戲狀態。
- **聲部上限**（預設 24 個同時發聲）與**每個 key 的視窗限流**（預設每 0.3–0.5 秒 4–8 次）。這兩個是「數量優先」策略的安全帶：五十種聲音全部掛上去之後，一顆炸彈在人群裡爆開會同時觸發幾十個 cue，沒有這兩層就是一聲爆音。
- **音高隨機**：每次播放在 0.95–1.05 之間抖動 playback rate。**這一條對本專案特別重要** —— 它是「同一個聲音聽起來不像複製貼上」最便宜的手段。
- **多音源避免重複**：一個 cue 可以有多個來源，每次挑一個，且不挑上一次挑過的那個。
- **音量以 dB 授權**，`fromDb(db) = 10 ** (db / 20)` 轉成線性增益。混音時人耳想的是 dB，不是 0.0–1.0。
- **Director 有兩張表，不是一張**：一張是「一個事件一個 cue」，另一張是「同一次結算會同時噴好幾個事件（擋下 + 破防 + 傷害），每個目標只准最高優先的那個發聲」。**這個折疊規則是本專案一定會撞到的** —— demo 的一次揮擊可以同時造成傷害、擊退、粒子、破石。
- **Director 匯出一個「有聲事件型別集合」** 供覆蓋率檢查使用，這樣「哪些事件是刻意沉默的」是可查詢的事實，而不是靠讀對應表推論。對「盡量覆蓋所有地方」這個目標，這是唯一能回答「還差哪些」的東西。

### 唯一要換掉的一層

`cue-library.ts` 現在長這樣：

```ts
{
  id: "action_whoosh",
  urls: [whoosh001Url, whoosh002Url, ...],  // ← 檔案
  limiterKey: "action_whoosh",
  maxPerWindow: 8,
  windowSec: 0.3,
  volume: fromDb(-20),
  pitchMin: 0.95,
  pitchMax: 1.05,
}
```

把 `urls` 換成**合成配方**（波形、頻率、包絡、雜訊量、濾波、時長），其他欄位一字不改。

**強烈建議的做法：在 unlock 當下用 `OfflineAudioContext` 把每個配方離線算成一個 `AudioBuffer`，之後照舊走 buffer source 播放。** 這樣做的好處是整條下游 —— 聲部上限、限流、音高抖動、匯流排、銷毀 —— **完全不用改**，合成只是換掉 buffer 的來源。每次播放才組 node graph 的做法會讓 mixer 的每一條規則都要重寫一次。

明確**不要**搬的東西：tickstrike 的資產檔、它的 cue 值（那些是從 Godot preset 逐字搬過來的，對應的是另一個遊戲的節奏）、以及 `music-director.ts`。

---

## Pantry Depths 這邊的難處：沒有事件匯流排

**這是最大的落差，接手的 Agent 必須先面對它。**

tickstrike 的 `AudioDirector` 吃的是一份現成的 `CombatEvent[]` —— 語意事件清單本來就存在，音訊只是它的第二個消費者。**Pantry Depths 的 demo 沒有這個東西。** 全 demo 搜不到任何語意事件型別；回饋是在**發生的地方直接呼叫**的。

現有的漏斗（也就是唯一接近事件匯流排的東西）：

| 漏斗                             | 位置                             | 規模                                                                                                                  |
| -------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `announce(world, message, secs)` | `src/demo/world.ts` 約 890 行    | **39 個呼叫點**，橫跨 8 個檔。訊息列 —— 任務、撿取、撤離、狀態                                                        |
| `burst(...)`                     | `src/demo/particles.ts` 約 58 行 | 粒子七種：blood / stoneChip / woodChip / dust / ember / splash / bone                                                 |
| `addVfx(world, spec)`            | `src/demo/world.ts` 約 917 行    | 世界級特效：blast、arc                                                                                                |
| `impacts.ts` 的具名函式          | `src/demo/impacts.ts`            | `chainLightning`、`detonate`、`shellImpact`、`rockImpact`、`bargeInto`、`bodyLanding`、`checkHazards`、`stepDrowning` |

兩條路，**建議走第二條**：

**路 A：先建語意事件清單，再讓音訊消費它。** 架構乾淨，跟 tickstrike 一模一樣。但這正是「把 demo port 進 codebase 並資料化」那條大線的工作，把它綁在音效上等於用音效當藉口開一個大重構。

**路 B：掛在現有漏斗上。** `burst()` 一個函式就涵蓋了幾乎每個值得出聲的瞬間（見血、碎石、碎木、揚塵、火星、水花、碎骨），`announce()` 涵蓋所有介面層級的事件，`impacts.ts` 的具名函式涵蓋大場面。這三處加起來大概十幾個掛點就能覆蓋到五十種以上的聲音。**代價是 director 不再是「一張純粹的事件對應表」，而是散在幾個呼叫點上。** 這個代價在 demo 半邊是可接受的 —— 那半邊本來就是「先做出來再說」的紀律，而且將來 port 的時候這些掛點會跟著被整理。

---

## 覆蓋清單（規模感，不是規格）

要「每個都不一樣」，粗估需要 **50–70 個 cue**。分類起點：

- **近戰**：揮空、命中肉、命中骨、被擋、破石、最後一擊崩塌
- **投擲**：擲出（依重量三種）、飛行、命中、彈開、用壞、撿起
- **敵人**：起手（三種預告符號各一）、衝鋒蓄力、衝鋒撞牆、砲擊發射、砲彈落地、被擊暈、每種死法（cleaved / collapse / drowning / impaled / slammed）
- **玩家**：受擊（依方向）、瀕死、治療、死亡
- **環境**：踩水、溺水、溫泉、蒸氣、火星、門開、樓梯開啟
- **獎勵與流程**：祝福獲得（依層級兩種）、詛咒祭壇、封印獎勵入手、撤離、任務達成、下樓
- **介面**：暫停進出、卡片出現、訊息列、重開

每一項都要一個**不同**的配方。這是這件工作真正花時間的地方，也是「數量比品質重要」這句話的實際意思。

---

## 還沒有答案的問題（給討論用，不要自己填）

1. **cue 表放哪裡？** 專案所有 authored 數值都走 `src/content/` + validator + 那條統一存檔端點（`dev/tools/run-authoring-request.ts`），這樣之後能長出 SFX workbench 來即時調參。但音效表放進 `src/content/` 就脫離了「demo 半邊不寫測試」的保護傘，而 `src/content/` 那半邊是有測試的。**這一題會決定這件工作要不要寫測試。**
2. **空間感要做到什麼程度？** 遊戲是第一人稱、有朝向、有距離。完全不做（每個聲音都是 2D）最便宜；只做音量隨距離衰減是中間值；做完整的 panning 需要 mixer 多一層。
3. **背景環境音要不要？** tickstrike 有獨立的 music bus 和 `MusicDirector`。本專案可以先不做，但 mixer 的匯流排要不要先留好是個決定。
4. **靜音與音量給不給玩家調？** 要推 itch 的話至少要一個靜音鍵。給滑桿就需要一個設定的儲存位置，而 demo 目前沒有設定系統。
5. **分頁切走要不要暫停？** tickstrike 的 mixer 有 `suspend()` / `resume()` 給分頁可見性用。demo 的指標鎖定解除已經是一個天然的暫停時機。

---

## 給接手 Agent 的操作提醒

- 讀 `CLAUDE.md` 的啟動鏈。
- `src/demo/` 與 `src/presentation/` **不寫測試**，機器檢查的硬規則，見 `dev/agent_rules/test_operations.md`。上面第 1 題如果答成「表放 `src/content/`」，測試的問題要單獨向使用者確認，因為「新增測試預設禁止，必須使用者逐次明確要求」。
- 參考來源是 `E:\Code\tickstrike-web\src\presentation\audio\`，五個檔全部值得讀完，總共不到 730 行。
- 產出的 plan 若要被 `/goal` 一路跑完，上面五題必須在 plan 寫成之前全部答完。

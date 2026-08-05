# SFX 音源取用（sfx_sourcing）

新增或替換遊戲音效前讀這份。它描述本專案與音效庫之間的完整管線：從「需要一個聲音」到「cue 在遊戲裡響起」，以及專案端判斷如何回流音庫。

## 音庫是什麼、鐵律是什麼

音庫分兩層，都不在本 repo 裡：

| 位置                    | 身分                                                                         |
| ----------------------- | ---------------------------------------------------------------------------- |
| `D:/Audio/Raw/`         | 採購音效包原始檔。**唯讀，永遠**。                                           |
| `D:/Audio/SFX/`         | 處理過的成品，按事件分類（`hit_bone/`、`break_stone/`…）。**只增不改**。     |
| `E:/Code/audio-library` | 目錄工具 repo：索引、搜尋、試聽、promote。有自己的 `CLAUDE.md`，動它前先讀。 |

任何操作都不得移動、改名、覆寫庫內既有檔案。工具唯一的寫入是 `promote` 新增一個檔，且拒絕重名。

## 取音管線

全部指令在 `E:/Code/audio-library` 下執行，需要 Node 22+ 與 `ffmpeg`/`ffprobe`。

1. **搜尋候選**：`npm run search -- "<描述>" --maxDuration <秒>`，或 `--tags a,b`（tags 是精確匹配）。有星等（人審聽過）的候選優先；agent 依 tags、時長、星等挑選即可——**審聽是人的工作**，之後玩的人聽不對再換，不必每個音先過耳朵。
2. **promote**（候選還在 `Raw/` 時）：`npm run promote -- <catalog路徑> --as <category>/<name>`。路徑用 catalog 相對形式（`Raw/...`，可從 search 結果照抄）；有多種取樣率版本時挑最高的當母帶。產出自動修剪、mono、-1dBFS、48kHz/16-bit，並寫入 lineage metadata。分類必須已存在，`--new-category` 才會新建。promote 後若 audition server 開著要重啟它。
3. **拷進專案**：`cp D:/Audio/SFX/<category>/<name>.wav src/content/sfx/assets/<cueId>.wav`。檔名就是 cue id。
4. **接線**（三個檔案，缺一個 build 或載入就會大聲失敗）：
   - `src/content/sfx/sfx-cue-schema.ts` 的 `SFX_CUE_IDS` 加 id
   - `src/content/sfx/sfx-cues.json` 加一列（`volumeDb`、限流、pitch 抖動）
   - `src/content/sfx/sfx-cue-definitions.ts` 加 import 與 `SAMPLE_URLS` 對映
5. **驗證**：一般 edit 與 commit 不自動跑驗證；只有 branch merge 前依 `dev/agent_rules/test_operations.md` 跑 `npm run verify`。若使用者或 approved spec 明確要求較早檢查，才跑指定的窄層；聲音對不對只能靠玩。
6. **提醒使用者重啟 dev server**。`vite.config.ts` 刻意不 watch canonical authored 檔（`sfx-cues.json` 在白名單裡），workbench 經 authoring endpoint 存檔會自行 invalidate，但直接改檔繞過了它——開著的 dev server 會繼續供應快取的舊表，配上已更新的 schema，載入驗證器就會以 `must name a cue` 大聲失敗。這是驗證器盡責，不是壞掉；重啟即恢復一致。

## 授權原則

- **響度**：檔案一律 -1dBFS 峰值，相對音量只在 cue 表的 `volumeDb` 授權。混音判斷不進音檔。
- **共用 take**:兩個 cue 可以指同一份 wav（例:`detonation`/`shellLand` 共用 `bomb.wav`）——cue 列分開是為了各自的音量與限流,檔案不必重複。
- **高頻事件不配音**：粒子、訊息列這類每秒多次的觸發點刻意無聲。加音效前先問這個 cue 一分鐘會響幾次。
- 曾經的 cue ↔ 庫檔案完整對映經驗記錄在音庫的 annotations（promote lineage）與本 repo 的 git 歷史，不在這份文件裡重抄。

## 專案判斷回流（projects 檔契約）

「聲音本身好不好」與「這個 take 適不適合本專案某個 cue」是兩個判斷，分開存：

- 聲音層（星等、tags）屬於音庫 annotations，主詞是聲音本身；品質差就是 1 星。
- 專案層主詞是 `(catalogId, cueId)` 對，記 `status: shipped | trial | misfit`、評語、專案 tags。正本留在本專案，匯出副本放 `audio-library/catalog/projects/pantry-depths.json`，供音庫定期整審（LLM 分揀、人裁決）決定是否回寫聲音層。每個未來專案照同一格式各佔一檔。

整條迴路的工具都已就位：

- **編輯**：debug hub 的 **SFX Workbench**（`/debug/sfx-workbench`）——每個 cue 走真實管線試聽，音量/pitch 存回 `sfx-cues.json`，fit/評語/tags 存回 `sfx-review.json`，兩者都經 authoring endpoint 驗證後寫入。
- **匯出**：`npm run sfx:export`（本 repo）——驗證後把 review 檔快照寫到 `audio-library/catalog/projects/pantry-depths.json`。
- **整審**：`npm run review:projects`（audio-library）——走訪所有 projects 檔，印出 markdown 提案清單；套用提案是人工編輯 `annotations.json`，改完重啟 audition server。

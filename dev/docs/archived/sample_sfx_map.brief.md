# 52 個 cue 的真音效對映

這是一份 **brief**（規則見 `dev/standards/work_lifecycle.addendum.md`）：不授權任何實作，存在的目的是餵給「把合成 placeholder 換成真音效」的 plan。對映由 audio-library 的搜尋引擎按 derivedTags 排序產生、逐檔驗證存在（2026-08-02），路徑相對於 `D:\Audio\SFX\`。

品質標記：**好** = tags 全中且語意正確；**可用** = 頂得住但有妥協；**弱** = 勉強；**缺** = 庫裡沒有。同資料夾多個 cue 一律取不同 take，維持「每個 cue 都不一樣」。

## 對映表

| Cue               | 檔案                                                        | 品質                   |
| ----------------- | ----------------------------------------------------------- | ---------------------- |
| particleBlood     | `hit_flesh/guts-punch-body-impact-fight-1.wav`              | 好                     |
| particleStoneChip | `hit_stone/bullet-sfx-noleadin-concrete-10.wav`             | 好                     |
| particleWoodChip  | `hit_wood/bullet-sfx-leadin-wood-1-01.wav`                  | 好                     |
| particleDust      | —                                                           | **缺**                 |
| particleEmber     | —                                                           | **缺**                 |
| particleSplash    | `water/bullet-sfx-leadin-water-1-10.wav`                    | 好                     |
| particleBone      | `hit_bone/bone-break-crunch-12.wav`                         | 好                     |
| deathSlain        | `hit_flesh/thick-kick-body-impact-fight-12.wav`             | 好                     |
| deathCleaved      | `stab/stab_flesh.wav`                                       | 好                     |
| deathDrowned      | `water/bullet-sfx-leadin-water-1-01.wav`                    | 可用（子彈入水代溺水） |
| deathSplattered   | `hit_flesh/body-penetrate-bow-and-arrow-01.wav`             | 好                     |
| deathBlasted      | `explosion/sci-fi-explosion-blast-bomb-9.wav`               | 可用（3.1s 尾長）      |
| deathImpaled      | `hit_flesh/body-penetrate-bow-and-arrow-07.wav`             | 好（穿刺即釘死）       |
| uiMessage         | `ui/snappy-modern-ui-01.wav`                                | 好                     |
| vfxBlast          | `explosion/explosion-blast-bomb-1.wav`                      | 可用（尾長）           |
| vfxArc            | `energy/short-taser-zap-electric-shock-voltage-spark-2.wav` | 好                     |
| meleeSwing        | `weapon_swing/whoosh-001.wav`                               | 好                     |
| meleeHitFlesh     | `hit_flesh/guts-punch-body-impact-fight-5.wav`              | 好                     |
| meleeHitBone      | `hit_bone/bone-break-crunch-1.wav`                          | 好                     |
| meleeHitWall      | `hit_stone/wall-impact-1.wav`                               | 好                     |
| meleeHitAltar     | `hit_metal/hit_pot-02.wav`                                  | 可用                   |
| throwLight        | `weapon_swing/quick-swish-swoosh-whoosh-1.wav`              | 好                     |
| throwMedium       | `weapon_swing/whoosh-002.wav`                               | 好                     |
| throwHeavy        | `weapon_swing/bright-swoosh-whoosh-1.wav`                   | 可用                   |
| throwEnemy        | `weapon_swing/bright-swoosh-whoosh-5.wav`                   | 可用                   |
| shootBolt         | `shoot/03-arrow-release-snap-1.wav`                         | 好                     |
| propPickup        | `pickup_item/item_pickup.wav`                               | 好                     |
| propDrop          | `drop_item/drop_clothes.wav`                                | 好                     |
| enemyWindupBlade  | `foley/knife-unsheath-leather-cover-1.wav`                  | 好                     |
| enemyWindupShot   | `shoot/05-crossbow-trigger-tighten-1.wav`                   | 好（上弦聲）           |
| enemyWindupCharge | `energy/sparkly-shimmer-charged-particles-1.wav`            | 好                     |
| enemyChargeLaunch | `shoot/04-crossbow-flyby-1.wav`                             | 可用                   |
| enemyChargeSlam   | `hit_stone/wall-impact-5.wav`                               | 好                     |
| enemyShotFire     | `shoot/03-arrow-release-snap-5.wav`                         | 好                     |
| playerHurt        | `hit_flesh/guts-punch-body-impact-fight-9.wav`              | 好                     |
| playerDeath       | `body_fall/body-roll-landing-fall-1.wav`                    | 可用                   |
| waterEntry        | `water/bullet-sfx-leadin-water-1-03.wav`                    | 好                     |
| rockLand          | `hit/ground-hit-bow-and-arrow-01.wav`                       | 好                     |
| bodyBarge         | `hit_flesh/thick-kick-body-impact-fight-1.wav`              | 好                     |
| bodyLand          | `body_fall/body-roll-landing-fall-10.wav`                   | 好                     |
| detonation        | `explosion/explosion-blast-bomb-14.wav`                     | 可用（尾長）           |
| shellFire         | —                                                           | **缺**                 |
| shellLand         | `explosion/sci-fi-explosion-blast-bomb-2.wav`               | 可用（尾長）           |
| chainHop          | `energy/short-taser-zap-electric-shock-voltage-spark-4.wav` | 好                     |
| blessGain         | `pickup_item/crystal_pling.wav`                             | 好                     |
| sealedReward      | `pickup_item/ding.wav`                                      | 好                     |
| extractionDone    | `ui/hologram-projector-telemetry-calculation-11.wav`        | 弱                     |
| descend           | —                                                           | **缺**                 |
| uiPause           | `foley/click-button-switch-press-01.wav`                    | 好                     |
| uiResume          | `foley/click-button-switch-press-02.wav`                    | 好                     |
| uiCard            | `ui/snappy-modern-ui-05.wav`                                | 好                     |
| uiRestart         | `ui/display-glitch-malfunction-1.wav`                       | 好                     |

## 四個缺口，與補法

1. **particleDust**（塵土落下的沙沙）——庫裡沒有。最接近的是 foley 的背包摩擦聲，需要耳朵確認哪個 take 像塵土。
2. **particleEmber**（火星劈啪）——`fire` 資料夾是空的。停車清單裡 `FireThrower_Blow` 三類（6 檔）+ `Arcblade_Ignition`（3 檔）批進 `fire` 即有候選。
3. **shellFire**（砲擊發射的深沉「咚」）——庫裡沒有。`15_Bangs`（45 檔，停車中）最可能有；聽過決定歸屬後即可補。
4. **descend**（下樓的低頻隆隆）——`Earthy_Rumble_Rock_Move`（4 檔，未處理）批進 `ambience` 即有候選。

弱項備忘：explosion 全部 3 秒以上尾長（38 檔無一短爆），deathBlasted / vfxBlast / detonation / shellLand 共用此妥協，`15_Bangs` 若是短爆即可全面升級；extractionDone 沒有像樣的「完成」上揚音。

## 接線備忘（給 plan 用，非授權）

引擎端從頭就為此設計：mixer 只認 `AudioBuffer`，合成只是 buffer 的來源之一。接線 = cue schema 加 `source: recipe | sample` 分支、選中的檔案拷進 `src/content/sfx/assets/`、baker 對 sample 來源改走 fetch+decode。聲部上限、限流、音高抖動、距離衰減、音量鍵全部原樣沿用。混音責任不變：檔案統一 -1dBFS 峰值，相對響度由 cue 表的 `volumeDb` 決定。

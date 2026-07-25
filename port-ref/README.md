# Pantry Depths — Web Prototype

純 HTML / CSS / JavaScript 的第一人稱迷宮 prototype，不依賴外部套件或素材。

## 啟動

直接開啟 `index.html` 即可。若瀏覽器限制本機音訊或 Pointer Lock，可在資料夾內啟動簡單伺服器：

```bash
python -m http.server 8080
```

然後開啟 `http://localhost:8080`。

## 操作

- WASD：移動
- 滑鼠：轉向
- 左鍵或 Space：短刃攻擊
- E：打開寶箱／出口
- Shift：奔跑
- 1：喝藥水
- Q / R 或左右方向鍵：鍵盤轉向備援

## Prototype 內容

- Raycasting 第一人稱迷宮與程序化牆面、地面、洞窟天花板材質
- 距離霧、火把暖光、閃爍、暗角、餘燼、鏡頭晃動與武器擺動
- 迷你地圖與探索迷霧
- 寶箱、血鑰、普通敵人、守衛、出口條件
- 簡單追蹤 AI、近戰、生命、藥水、金幣與勝利畫面
- Web Audio 程序化環境音與打擊音

(() => {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  const miniMap = document.getElementById("miniMap");
  const mapCtx = miniMap.getContext("2d");
  const shell = document.getElementById("gameShell");
  const startOverlay = document.getElementById("startOverlay");
  const winOverlay = document.getElementById("winOverlay");
  const startButton = document.getElementById("startButton");
  const restartButton = document.getElementById("restartButton");
  const interactionPrompt = document.getElementById("interactionPrompt");
  const toastEl = document.getElementById("toast");
  const damageFlash = document.getElementById("damageFlash");
  const muteButton = document.getElementById("muteButton");

  const TAU = Math.PI * 2;
  const FOV = Math.PI / 3.05;
  const TEX = 64;
  const RENDER_SCALE = 0.55;
  const MAX_DEPTH = 18;
  const TEST_MODE = new URLSearchParams(location.search).has("test");

  // 0 floor, 1 stone, 2 old masonry, 3 locked exit, 4 iron grate.
  const BASE_MAP = [
    "1111111111111111111",
    "1000000000010000001",
    "1022220222010111101",
    "1000020000010000101",
    "1111020111110200101",
    "1000020100000200001",
    "1011110102220211101",
    "1000000102000200001",
    "1022211102011111201",
    "1000200002000000201",
    "1100201111111010201",
    "1000201000000010001",
    "1022201022222011111",
    "1000001000200000001",
    "1011111110201111101",
    "1000000000201000301",
    "1022222222201000001",
    "1000000000000014001",
    "1111111111111111111"
  ];

  let world = [];
  let player;
  let sprites;
  let doors;
  let game;
  let depthBuffer = new Float32Array(1);
  let keys = Object.create(null);
  let lastTime = performance.now();
  let audio = null;
  let muted = false;
  let toastTimer = 0;
  let damageAlpha = 0;
  let mapPulse = 0;

  const textures = {};
  const spriteArt = {};

  function seededNoise(x, y, seed = 0) {
    const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 31.77) * 43758.5453;
    return n - Math.floor(n);
  }

  function makeCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    return c;
  }

  function createTextures() {
    const stone = makeCanvas(TEX, TEX);
    let g = stone.getContext("2d");
    g.fillStyle = "#6f4b61"; g.fillRect(0, 0, TEX, TEX);
    const rows = 4;
    for (let row = 0; row < rows; row++) {
      const y0 = row * 16;
      const offset = row % 2 ? -11 : 0;
      for (let col = -1; col < 5; col++) {
        const x0 = col * 22 + offset;
        const grad = g.createLinearGradient(x0, y0, x0 + 22, y0 + 16);
        grad.addColorStop(0, "#a77787");
        grad.addColorStop(.48, "#8b6074");
        grad.addColorStop(1, "#69465e");
        g.fillStyle = grad;
        roundedRect(g, x0 + 1, y0 + 1, 20, 14, 3);
        g.fill();
        g.strokeStyle = "#37243c"; g.lineWidth = 2; g.stroke();
        g.strokeStyle = "rgba(255,210,201,.2)"; g.lineWidth = 1;
        g.beginPath(); g.moveTo(x0 + 4, y0 + 3); g.lineTo(x0 + 16, y0 + 3); g.stroke();
      }
    }
    for (let i = 0; i < 18; i++) {
      const x = Math.floor(seededNoise(i, 2, 1) * TEX);
      const y = Math.floor(seededNoise(i, 5, 2) * TEX);
      g.strokeStyle = "rgba(45,23,42,.4)"; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + 4, y + 2); g.lineTo(x + 2, y + 6); g.stroke();
    }
    textures[1] = stone;

    const masonry = makeCanvas(TEX, TEX);
    g = masonry.getContext("2d");
    g.fillStyle = "#39284f"; g.fillRect(0, 0, TEX, TEX);
    for (let y = 0; y < TEX; y += 16) {
      const off = ((y / 16) % 2) * 12;
      for (let x = -24; x < TEX; x += 24) {
        const v = 45 + Math.floor(seededNoise(x, y, 3) * 18);
        g.fillStyle = `rgb(${v + 10},${v - 2},${v + 25})`;
        g.fillRect(x + off + 1, y + 1, 22, 14);
        g.strokeStyle = "#21172f"; g.lineWidth = 2; g.strokeRect(x + off + 1, y + 1, 22, 14);
      }
    }
    textures[2] = masonry;

    const door = makeCanvas(TEX, TEX);
    g = door.getContext("2d");
    const dg = g.createLinearGradient(0, 0, TEX, 0);
    dg.addColorStop(0, "#39211e"); dg.addColorStop(.5, "#744636"); dg.addColorStop(1, "#2b1a1c");
    g.fillStyle = dg; g.fillRect(0, 0, TEX, TEX);
    for (let x = 4; x < TEX; x += 12) {
      g.fillStyle = x % 24 === 4 ? "rgba(255,166,92,.1)" : "rgba(0,0,0,.12)";
      g.fillRect(x, 0, 3, TEX);
    }
    g.strokeStyle = "#130d10"; g.lineWidth = 5; g.strokeRect(2, 2, 60, 60);
    g.strokeStyle = "#b2693b"; g.lineWidth = 3; g.beginPath(); g.arc(32, 31, 20, 0, TAU); g.stroke();
    g.fillStyle = "#d6a348"; g.fillRect(45, 29, 6, 7);
    textures[3] = door;

    const grate = makeCanvas(TEX, TEX);
    g = grate.getContext("2d");
    g.fillStyle = "#251c2c"; g.fillRect(0, 0, TEX, TEX);
    g.strokeStyle = "#14101a"; g.lineWidth = 8;
    for (let x = 8; x < TEX; x += 14) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, TEX); g.stroke(); }
    for (let y = 12; y < TEX; y += 18) { g.beginPath(); g.moveTo(0, y); g.lineTo(TEX, y); g.stroke(); }
    g.strokeStyle = "#66536b"; g.lineWidth = 2;
    for (let x = 8; x < TEX; x += 14) { g.beginPath(); g.moveTo(x - 2, 0); g.lineTo(x - 2, TEX); g.stroke(); }
    textures[4] = grate;

    const floor = makeCanvas(TEX, TEX);
    g = floor.getContext("2d");
    g.fillStyle = "#24192d"; g.fillRect(0, 0, TEX, TEX);
    for (let y = -8; y < TEX + 8; y += 17) {
      for (let x = -16; x < TEX + 16; x += 22) {
        const ox = ((y / 17) & 1) * 10;
        const shade = Math.floor(seededNoise(x, y, 7) * 18);
        g.fillStyle = `rgb(${53 + shade},${38 + shade * .55},${60 + shade})`;
        g.beginPath();
        g.ellipse(x + ox + 10, y + 8, 10, 7, seededNoise(x, y, 8) * .25, 0, TAU);
        g.fill();
        g.strokeStyle = "#19121e"; g.lineWidth = 2; g.stroke();
        g.strokeStyle = "rgba(244,174,135,.12)"; g.lineWidth = 1;
        g.beginPath(); g.arc(x + ox + 8, y + 6, 6, 3.5, 5.4); g.stroke();
      }
    }
    textures.floor = floor;

    const ceil = makeCanvas(TEX, TEX);
    g = ceil.getContext("2d");
    g.fillStyle = "#3d263b"; g.fillRect(0, 0, TEX, TEX);
    for (let i = 0; i < 22; i++) {
      const x = seededNoise(i, 11, 2) * TEX;
      const y = seededNoise(i, 13, 2) * TEX;
      const r = 8 + seededNoise(i, 15, 2) * 13;
      g.fillStyle = i % 2 ? "#563348" : "#482b42";
      g.beginPath(); g.ellipse(x, y, r, r * .55, seededNoise(i, 4, 9) * Math.PI, 0, TAU); g.fill();
      g.strokeStyle = "#2a1b31"; g.lineWidth = 2; g.stroke();
      g.strokeStyle = "rgba(235,137,123,.13)"; g.lineWidth = 1;
      g.beginPath(); g.arc(x - 1, y - 2, r * .6, 3.2, 5.6); g.stroke();
    }
    textures.ceiling = ceil;
  }

  function roundedRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  function createSpriteArt() {
    spriteArt.chest = drawChest(false);
    spriteArt.chestOpen = drawChest(true);
    spriteArt.key = drawKey();
    spriteArt.goblin = drawGoblin("#7fa844", "#ae4c40");
    spriteArt.warden = drawGoblin("#68734b", "#6a2d3b", true);
    spriteArt.torch = drawWallTorch();
    spriteArt.bones = drawBones();
    spriteArt.exit = drawExitGlow();
  }

  function drawChest(open) {
    const c = makeCanvas(128, 128), g = c.getContext("2d");
    g.translate(64, 80);
    g.fillStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.ellipse(0, 34, 42, 11, 0, 0, TAU); g.fill();
    g.lineWidth = 6; g.strokeStyle = "#191016";
    if (open) {
      g.save(); g.translate(0, -23); g.rotate(-.34);
      g.fillStyle = "#7f4430"; roundedRect(g, -40, -25, 80, 34, 8); g.fill(); g.stroke();
      g.fillStyle = "#cc8338"; g.fillRect(-4, -25, 8, 34); g.restore();
      g.fillStyle = "rgba(255,201,93,.28)"; g.beginPath(); g.moveTo(-30,-20); g.lineTo(30,-20); g.lineTo(14,-78); g.lineTo(-14,-78); g.closePath(); g.fill();
    } else {
      g.fillStyle = "#87503a"; roundedRect(g, -41, -34, 82, 39, 13); g.fill(); g.stroke();
    }
    g.fillStyle = "#6e3b2b"; roundedRect(g, -44, -4, 88, 43, 5); g.fill(); g.stroke();
    g.fillStyle = "#d08a35"; g.fillRect(-6, -35, 12, 74); g.fillRect(-44, 8, 88, 8);
    g.strokeStyle = "#191016"; g.strokeRect(-6, -35, 12, 74); g.strokeRect(-44, 8, 88, 8);
    g.fillStyle = "#f2c060"; roundedRect(g, -9, 5, 18, 20, 4); g.fill(); g.stroke();
    return c;
  }

  function drawKey() {
    const c = makeCanvas(96, 128), g = c.getContext("2d");
    g.translate(48, 64); g.rotate(-.2);
    g.shadowColor = "#ff6a57"; g.shadowBlur = 20;
    g.strokeStyle = "#ffb64d"; g.lineWidth = 12; g.lineCap = "round";
    g.beginPath(); g.arc(0, -25, 18, 0, TAU); g.stroke();
    g.beginPath(); g.moveTo(0, -7); g.lineTo(0, 42); g.lineTo(18, 42); g.moveTo(0, 23); g.lineTo(14, 23); g.stroke();
    g.shadowBlur = 0; g.strokeStyle = "#4c1b25"; g.lineWidth = 3;
    g.beginPath(); g.arc(0, -25, 18, 0, TAU); g.stroke();
    return c;
  }

  function drawGoblin(skin, cloth, warden = false) {
    const c = makeCanvas(160, 192), g = c.getContext("2d");
    g.translate(80, 103);
    g.fillStyle = "rgba(0,0,0,.38)"; g.beginPath(); g.ellipse(0, 71, 49, 13, 0, 0, TAU); g.fill();
    g.strokeStyle = "#171019"; g.lineWidth = 7; g.lineJoin = "round";
    g.fillStyle = cloth; g.beginPath(); g.moveTo(-35,18); g.lineTo(35,18); g.lineTo(44,63); g.lineTo(-44,63); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = skin;
    g.beginPath(); g.moveTo(-35,-23); g.lineTo(-73,-5); g.lineTo(-40,8); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(35,-23); g.lineTo(73,-5); g.lineTo(40,8); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.ellipse(0,-13,43,48,0,0,TAU); g.fill(); g.stroke();
    g.fillStyle = warden ? "#552337" : "#9d3434"; g.beginPath(); g.moveTo(-44,-51); g.lineTo(38,-47); g.lineTo(46,-26); g.lineTo(-41,-29); g.closePath(); g.fill(); g.stroke();
    if (warden) {
      g.fillStyle = "#7c604a"; g.fillRect(-46, -56, 92, 12); g.strokeRect(-46,-56,92,12);
      g.fillStyle = "#d5aa55";
      for (let x=-31; x<=31; x+=31) { g.beginPath(); g.moveTo(x,-57); g.lineTo(x+8,-75); g.lineTo(x+16,-57); g.closePath(); g.fill(); g.stroke(); }
    }
    g.fillStyle = "#f2d27c";
    g.beginPath(); g.ellipse(-17,-15,12,9,.15,0,TAU); g.ellipse(17,-15,12,9,-.15,0,TAU); g.fill(); g.stroke();
    g.fillStyle = "#161014"; g.beginPath(); g.arc(-16,-14,4,0,TAU); g.arc(16,-14,4,0,TAU); g.fill();
    g.fillStyle = "#ce6148"; g.beginPath(); g.ellipse(0,2,8,7,0,0,TAU); g.fill(); g.stroke();
    g.strokeStyle = "#211119"; g.lineWidth = 5; g.beginPath(); g.arc(0, 10, 17, .2, Math.PI-.2); g.stroke();
    g.fillStyle = "#e4d5ad"; g.beginPath(); g.moveTo(-14,23); g.lineTo(-8,13); g.lineTo(-3,24); g.moveTo(14,23); g.lineTo(8,13); g.lineTo(3,24); g.fill();
    // arms and cleaver
    g.strokeStyle = "#171019"; g.lineWidth = 14; g.beginPath(); g.moveTo(-31,28); g.lineTo(-54,48); g.moveTo(31,28); g.lineTo(54,43); g.stroke();
    g.strokeStyle = skin; g.lineWidth = 9; g.beginPath(); g.moveTo(-31,28); g.lineTo(-54,48); g.moveTo(31,28); g.lineTo(54,43); g.stroke();
    g.save(); g.translate(54,43); g.rotate(-.65); g.fillStyle="#aa9c8c"; g.strokeStyle="#171019"; g.lineWidth=5; g.beginPath(); g.moveTo(0,-4); g.lineTo(42,-12); g.lineTo(45,8); g.lineTo(0,6); g.closePath(); g.fill(); g.stroke(); g.restore();
    return c;
  }

  function drawWallTorch() {
    const c = makeCanvas(96, 150), g = c.getContext("2d");
    g.translate(48, 100);
    g.fillStyle = "rgba(255,153,58,.18)"; g.beginPath(); g.arc(0,-53,42,0,TAU); g.fill();
    g.strokeStyle = "#1b1318"; g.lineWidth = 7; g.fillStyle = "#695049";
    g.fillRect(-12,-22,24,52); g.strokeRect(-12,-22,24,52);
    g.fillStyle = "#25202b"; g.fillRect(-20,-25,40,10); g.strokeRect(-20,-25,40,10);
    const flame = g.createLinearGradient(0,-100,0,-20); flame.addColorStop(0,"#fff27a"); flame.addColorStop(.45,"#ffb534"); flame.addColorStop(1,"#e9472e");
    g.fillStyle = flame; g.beginPath(); g.moveTo(0,-25); g.bezierCurveTo(-35,-44,-25,-72,-8,-93); g.bezierCurveTo(-6,-73,11,-86,14,-105); g.bezierCurveTo(40,-71,27,-41,0,-25); g.fill(); g.stroke();
    return c;
  }

  function drawBones() {
    const c = makeCanvas(128, 100), g = c.getContext("2d");
    g.translate(64,55); g.strokeStyle="#171017"; g.lineWidth=10; g.lineCap="round";
    g.beginPath(); g.moveTo(-38,14); g.lineTo(35,-10); g.moveTo(-27,-18); g.lineTo(36,20); g.stroke();
    g.strokeStyle="#b8aa9d"; g.lineWidth=6; g.beginPath(); g.moveTo(-38,14); g.lineTo(35,-10); g.moveTo(-27,-18); g.lineTo(36,20); g.stroke();
    g.fillStyle="#aaa093"; g.strokeStyle="#171017"; g.lineWidth=5; g.beginPath(); g.arc(-3,-23,19,0,TAU); g.fill(); g.stroke();
    g.fillStyle="#2a2126"; g.beginPath(); g.arc(-9,-26,5,0,TAU); g.arc(6,-26,5,0,TAU); g.fill();
    return c;
  }

  function drawExitGlow() {
    const c = makeCanvas(128, 192), g = c.getContext("2d");
    const grad = g.createRadialGradient(64,96,4,64,96,64); grad.addColorStop(0,"rgba(255,225,130,.85)"); grad.addColorStop(.35,"rgba(255,125,54,.38)"); grad.addColorStop(1,"rgba(255,60,40,0)");
    g.fillStyle=grad; g.fillRect(0,0,128,192); return c;
  }

  function resetGame() {
    world = BASE_MAP.map(row => row.split("").map(Number));
    player = { x: 1.6, y: 1.55, angle: .03, hp: 88, maxHp: 88, coins: 0, keys: 0, potions: 0, bob: 0, stepPhase: 0, hurt: 0 };
    doors = [{ x: 16, y: 15, open: false }];
    sprites = [
      { type: "chest", x: 9.5, y: 1.5, open: false, solid: true, id: "keyChest" },
      { type: "chest", x: 11.5, y: 13.5, open: false, solid: true, id: "lootChest" },
      { type: "goblin", x: 6.5, y: 5.5, hp: 2, maxHp: 2, alive: true, speed: .62, hurt: 0, attack: 0, aggro: 7 },
      { type: "goblin", x: 6.5, y: 9.5, hp: 2, maxHp: 2, alive: true, speed: .58, hurt: 0, attack: 0, aggro: 7 },
      { type: "goblin", x: 13.5, y: 9.5, hp: 2, maxHp: 2, alive: true, speed: .61, hurt: 0, attack: 0, aggro: 8 },
      { type: "warden", x: 16.5, y: 17.2, hp: 5, maxHp: 5, alive: true, speed: .48, hurt: 0, attack: 0, aggro: 9, id: "warden" },
      { type: "torch", x: 3.72, y: 1.18, decorative: true },
      { type: "torch", x: 10.82, y: 3.45, decorative: true },
      { type: "torch", x: 8.2, y: 9.75, decorative: true },
      { type: "torch", x: 15.18, y: 13.5, decorative: true },
      { type: "bones", x: 5.5, y: 3.5, decorative: true },
      { type: "bones", x: 12.4, y: 7.55, decorative: true },
      { type: "bones", x: 8.7, y: 13.4, decorative: true },
      { type: "exit", x: 16.18, y: 15.5, decorative: true }
    ];
    game = {
      running: false,
      won: false,
      attackTimer: 0,
      attackCooldown: 0,
      elapsed: 0,
      kills: 0,
      currentTarget: null,
      discovered: Array.from({length: world.length}, () => Array(world[0].length).fill(false)),
      lastPathUpdate: 0,
      shake: 0
    };
    updateHud();
    updateObjectives();
    renderMiniMap();
  }

  function resize() {
    const rect = shell.getBoundingClientRect();
    canvas.width = Math.max(480, Math.min(1050, Math.floor(rect.width * devicePixelRatio * RENDER_SCALE)));
    canvas.height = Math.max(320, Math.min(650, Math.floor(rect.height * devicePixelRatio * RENDER_SCALE)));
    depthBuffer = new Float32Array(canvas.width);
    ctx.imageSmoothingEnabled = true;
  }

  function startGame() {
    game.running = true;
    startOverlay.style.display = "none";
    winOverlay.hidden = true;
    initAudio();
    if (shell.requestPointerLock) shell.requestPointerLock();
  }

  function initAudio() {
    if (audio) { if (audio.ctx.state === "suspended") audio.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ac = new AC();
    const master = ac.createGain(); master.gain.value = muted ? 0 : .28; master.connect(ac.destination);
    const hum = ac.createOscillator(); hum.type = "sine"; hum.frequency.value = 47;
    const humGain = ac.createGain(); humGain.gain.value = .035; hum.connect(humGain).connect(master); hum.start();
    const lfo = ac.createOscillator(); lfo.frequency.value = .11; const lfoGain = ac.createGain(); lfoGain.gain.value = 8; lfo.connect(lfoGain).connect(hum.frequency); lfo.start();

    const noiseBuffer = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i=0;i<data.length;i++) data[i] = (Math.random()*2-1) * (Math.random() < .015 ? 1 : .12);
    const noise = ac.createBufferSource(); noise.buffer=noiseBuffer; noise.loop=true;
    const filter=ac.createBiquadFilter(); filter.type="bandpass"; filter.frequency.value=850; filter.Q.value=.8;
    const ng=ac.createGain(); ng.gain.value=.025; noise.connect(filter).connect(ng).connect(master); noise.start();
    audio = { ctx: ac, master, hum, noise };
  }

  function blip(freq=220, duration=.09, type="square", volume=.09) {
    if (!audio || muted) return;
    const t = audio.ctx.currentTime;
    const o = audio.ctx.createOscillator(); const g = audio.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(Math.max(35, freq*.65), t+duration);
    g.gain.setValueAtTime(volume,t); g.gain.exponentialRampToValueAtTime(.001,t+duration);
    o.connect(g).connect(audio.master); o.start(t); o.stop(t+duration);
  }

  function noiseHit(volume=.12) {
    if (!audio || muted) return;
    const len = Math.floor(audio.ctx.sampleRate * .11);
    const b = audio.ctx.createBuffer(1,len,audio.ctx.sampleRate); const d=b.getChannelData(0);
    for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*(1-i/len);
    const s=audio.ctx.createBufferSource(); s.buffer=b; const f=audio.ctx.createBiquadFilter(); f.type="lowpass"; f.frequency.value=900;
    const g=audio.ctx.createGain(); g.gain.value=volume; s.connect(f).connect(g).connect(audio.master); s.start();
  }

  function cellAt(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    if (iy < 0 || iy >= world.length || ix < 0 || ix >= world[0].length) return 1;
    return world[iy][ix];
  }

  function isSolid(x, y) {
    if (cellAt(x,y) !== 0) return true;
    for (const s of sprites) {
      if (!s.solid || s.open || s.alive === false) continue;
      if (Math.hypot(s.x-x, s.y-y) < .42) return true;
    }
    return false;
  }

  function canMoveTo(x, y, radius=.22) {
    return !isSolid(x-radius,y-radius) && !isSolid(x+radius,y-radius) && !isSolid(x-radius,y+radius) && !isSolid(x+radius,y+radius);
  }

  function update(dt) {
    if (!game.running || game.won) return;
    game.elapsed += dt;
    mapPulse += dt;
    game.attackTimer = Math.max(0, game.attackTimer-dt);
    game.attackCooldown = Math.max(0, game.attackCooldown-dt);
    game.shake = Math.max(0, game.shake-dt*5);
    player.hurt = Math.max(0, player.hurt-dt);
    damageAlpha = Math.max(0, damageAlpha-dt*2.8);
    damageFlash.style.opacity = damageAlpha.toFixed(3);

    let move = 0, strafe = 0, turn = 0;
    if (keys.KeyW || keys.ArrowUp) move += 1;
    if (keys.KeyS || keys.ArrowDown) move -= 1;
    if (keys.KeyA) strafe -= 1;
    if (keys.KeyD) strafe += 1;
    if (keys.ArrowLeft || keys.KeyQ) turn -= 1;
    if (keys.ArrowRight || keys.KeyR) turn += 1;
    player.angle = normalizeAngle(player.angle + turn * dt * 2.1);

    const moving = move !== 0 || strafe !== 0;
    const run = keys.ShiftLeft || keys.ShiftRight;
    const speed = (run ? 3.05 : 2.08) * dt;
    if (moving) {
      const len = Math.hypot(move,strafe) || 1; move/=len; strafe/=len;
      const dx = Math.cos(player.angle)*move*speed + Math.cos(player.angle+Math.PI/2)*strafe*speed;
      const dy = Math.sin(player.angle)*move*speed + Math.sin(player.angle+Math.PI/2)*strafe*speed;
      if (canMoveTo(player.x+dx,player.y)) player.x += dx;
      if (canMoveTo(player.x,player.y+dy)) player.y += dy;
      player.bob += dt * (run ? 12 : 8.5);
      player.stepPhase += dt * (run ? 2.5 : 1.8);
      if (player.stepPhase >= 1) { player.stepPhase -= 1; blip(64 + Math.random()*14,.035,"sine",.022); }
    } else {
      player.bob += dt*2.2;
    }

    discoverAroundPlayer();
    updateEnemies(dt);
    updateInteraction();
    updateHud();
    renderMiniMap();
    updateObjectives();

    if (player.hp <= 0) {
      player.hp = player.maxHp;
      player.x = 1.6; player.y = 1.55; player.angle = .03;
      player.coins = Math.max(0, player.coins-12);
      showToast("你被拖回入口，還被摸走了幾枚錢。");
      blip(58,.5,"sawtooth",.13);
    }
  }

  function updateEnemies(dt) {
    for (const e of sprites) {
      if (!e.alive || (e.type !== "goblin" && e.type !== "warden")) continue;
      e.hurt = Math.max(0, e.hurt-dt);
      e.attack = Math.max(0, e.attack-dt);
      const dist = Math.hypot(player.x-e.x, player.y-e.y);
      if (dist > e.aggro) continue;
      if (dist < .82) {
        if (e.attack <= 0) {
          e.attack = e.type === "warden" ? 1.05 : 1.35;
          hurtPlayer(e.type === "warden" ? 16 : 9);
        }
        continue;
      }
      const dir = findNextDirection(e.x,e.y,player.x,player.y);
      if (!dir) continue;
      const dx = dir.x*e.speed*dt, dy=dir.y*e.speed*dt;
      if (canEnemyMove(e,e.x+dx,e.y)) e.x += dx;
      if (canEnemyMove(e,e.x,e.y+dy)) e.y += dy;
    }
  }

  function canEnemyMove(enemy,x,y) {
    if (cellAt(x,y)!==0) return false;
    if (Math.hypot(player.x-x,player.y-y)<.52) return false;
    for(const e of sprites) {
      if(e===enemy || !e.alive || (e.type!=="goblin" && e.type!=="warden")) continue;
      if(Math.hypot(e.x-x,e.y-y)<.45) return false;
    }
    return true;
  }

  function findNextDirection(sx,sy,tx,ty) {
    const start={x:Math.floor(sx),y:Math.floor(sy)}, goal={x:Math.floor(tx),y:Math.floor(ty)};
    if (lineOfSight(sx,sy,tx,ty)) {
      const d=Math.hypot(tx-sx,ty-sy)||1; return {x:(tx-sx)/d,y:(ty-sy)/d};
    }
    const q=[start], seen=new Set([`${start.x},${start.y}`]), parent=new Map();
    const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
    let found=null;
    while(q.length && seen.size<120) {
      const n=q.shift();
      if(n.x===goal.x && n.y===goal.y){found=n;break;}
      for(const [dx,dy] of dirs){const x=n.x+dx,y=n.y+dy,k=`${x},${y}`; if(seen.has(k)||cellAt(x+.5,y+.5)!==0)continue; seen.add(k); parent.set(k,n); q.push({x,y});}
    }
    if(!found) return null;
    let cur=found, prev=found;
    while(true){const p=parent.get(`${cur.x},${cur.y}`); if(!p)break; prev=cur; cur=p; if(cur.x===start.x&&cur.y===start.y)break;}
    const txc=prev.x+.5, tyc=prev.y+.5, d=Math.hypot(txc-sx,tyc-sy)||1;
    return {x:(txc-sx)/d,y:(tyc-sy)/d};
  }

  function lineOfSight(x0,y0,x1,y1) {
    const d=Math.hypot(x1-x0,y1-y0), steps=Math.ceil(d*8);
    for(let i=1;i<steps;i++){const t=i/steps;if(cellAt(x0+(x1-x0)*t,y0+(y1-y0)*t)!==0)return false;} return true;
  }

  function hurtPlayer(amount) {
    player.hp -= amount; player.hurt=.45; damageAlpha=.86; game.shake=.9;
    noiseHit(.13); blip(83,.18,"sawtooth",.08);
  }

  function attack() {
    if (!game.running || game.won || game.attackCooldown>0) return;
    game.attackTimer=.32; game.attackCooldown=.48; noiseHit(.05); blip(290,.08,"triangle",.055);
    let best=null, bestScore=999;
    for(const e of sprites) {
      if(!e.alive || (e.type!=="goblin"&&e.type!=="warden"))continue;
      const dx=e.x-player.x,dy=e.y-player.y,dist=Math.hypot(dx,dy);
      let a=normalizeSigned(Math.atan2(dy,dx)-player.angle);
      const score=dist+Math.abs(a)*1.7;
      if(dist<1.55 && Math.abs(a)<.42 && lineOfSight(player.x,player.y,e.x,e.y) && score<bestScore){best=e;bestScore=score;}
    }
    if(best){
      best.hp--; best.hurt=.24; game.shake=.38; noiseHit(.16); blip(best.type==="warden"?92:126,.12,"square",.075);
      if(best.hp<=0){best.alive=false;game.kills++;player.coins+=best.type==="warden"?35:9;showToast(best.type==="warden"?"守衛倒下了，出口的封印正在鬆動。":"地精化成一團焦黑灰燼。");blip(420,.22,"triangle",.08);}
    }
  }

  function interact() {
    if (!game.currentTarget || !game.running) return;
    const t=game.currentTarget;
    if(t.kind==="chest") {
      const s=t.sprite; if(s.open)return; s.open=true;s.solid=false;
      if(s.id==="keyChest"){player.keys=1;player.coins+=18;showToast("你找到血鑰，以及 18 枚地下錢幣。");blip(680,.22,"triangle",.08);}
      else {player.potions++;player.coins+=23;showToast("找到一瓶燻黑藥水與 23 枚錢幣。");blip(520,.18,"triangle",.07);}
    } else if(t.kind==="exit") {
      const warden=sprites.find(s=>s.id==="warden");
      if(player.keys<1){showToast("門鎖中央有一個血色鑰孔。");blip(90,.16,"square",.06);return;}
      if(warden && warden.alive){showToast("守衛的咒印仍封住門扉。");blip(80,.16,"square",.06);return;}
      world[15][16]=0; doors[0].open = true; winGame();
    }
  }

  function drinkPotion() {
    if(!game.running || player.potions<=0 || player.hp>=player.maxHp)return;
    player.potions--;player.hp=Math.min(player.maxHp,player.hp+32);showToast("苦得像濕襪子，但確實有用。");blip(360,.28,"sine",.07);
  }

  function winGame() {
    game.won=true;game.running=false;
    document.exitPointerLock?.();
    document.getElementById("winStats").textContent=`耗時 ${formatTime(game.elapsed)}　擊倒 ${game.kills} 名敵人　帶走 ${player.coins} 枚錢幣`;
    winOverlay.hidden=false;
    blip(540,.55,"triangle",.1);
  }

  function updateInteraction() {
    let target=null, best=1.55;
    for(const s of sprites) {
      if(s.type!=="chest" || s.open)continue;
      const d=Math.hypot(s.x-player.x,s.y-player.y); if(d>best)continue;
      const a=Math.abs(normalizeSigned(Math.atan2(s.y-player.y,s.x-player.x)-player.angle));
      if(a<.65 && lineOfSight(player.x,player.y,s.x,s.y)){target={kind:"chest",sprite:s};best=d;}
    }
    const exitDist=Math.hypot(15.5-player.x,15.5-player.y);
    if(exitDist<1.65){target={kind:"exit"};}
    game.currentTarget=target;
    if(target){interactionPrompt.textContent=target.kind==="chest"?"[E] 打開寶箱":"[E] 解開出口";interactionPrompt.classList.add("show");}
    else interactionPrompt.classList.remove("show");
  }

  function discoverAroundPlayer() {
    const px=Math.floor(player.x),py=Math.floor(player.y);
    for(let y=py-2;y<=py+2;y++) for(let x=px-2;x<=px+2;x++) if(world[y]?.[x]!==undefined && Math.hypot(x-px,y-py)<2.7) game.discovered[y][x]=true;
  }

  function render() {
    const w=canvas.width,h=canvas.height;
    const shake=game.shake ? (Math.random()-.5)*game.shake*9*devicePixelRatio*RENDER_SCALE : 0;
    ctx.save();ctx.translate(shake,shake*.35);
    renderFloorAndCeiling(w,h);
    renderWalls(w,h);
    renderSprites(w,h);
    renderAtmosphere(w,h);
    renderHands(w,h);
    ctx.restore();
  }

  function renderFloorAndCeiling(w,h) {
    const horizon=Math.floor(h*.49 + Math.sin(player.bob)*h*.006);
    const image=ctx.createImageData(w,h); const data=image.data;
    const floorData=textures.floor.getContext("2d").getImageData(0,0,TEX,TEX).data;
    const ceilData=textures.ceiling.getContext("2d").getImageData(0,0,TEX,TEX).data;
    const dirX=Math.cos(player.angle),dirY=Math.sin(player.angle);
    const planeX=-dirY*Math.tan(FOV/2),planeY=dirX*Math.tan(FOV/2);
    const ray0x=dirX-planeX,ray0y=dirY-planeY,ray1x=dirX+planeX,ray1y=dirY+planeY;
    for(let y=0;y<h;y++) {
      const isFloor=y>horizon; const p=isFloor?(y-horizon):(horizon-y);
      if(p<1)continue;
      const posZ=.54*h; const rowDist=posZ/p;
      let fx=player.x+rowDist*ray0x,fy=player.y+rowDist*ray0y;
      const stepx=rowDist*(ray1x-ray0x)/w,stepy=rowDist*(ray1y-ray0y)/w;
      const fog=Math.max(0,Math.min(1,1-rowDist/MAX_DEPTH));
      const light=Math.min(1, .11 + fog*.78 + (isFloor ? .10 : 0));
      for(let x=0;x<w;x++,fx+=stepx,fy+=stepy){
        const tx=((Math.floor(fx*TEX)%TEX)+TEX)%TEX,ty=((Math.floor(fy*TEX)%TEX)+TEX)%TEX;
        const si=(ty*TEX+tx)*4, di=(y*w+x)*4;
        const src=isFloor?floorData:ceilData;
        const centerGlow=Math.max(0,1-Math.abs(x-w*.48)/(w*.7));
        const warm=isFloor ? centerGlow*.16*fog : centerGlow*.08*fog;
        data[di]=src[si]*light + 45*warm;
        data[di+1]=src[si+1]*light + 18*warm;
        data[di+2]=src[si+2]*light + 8*warm;
        data[di+3]=255;
      }
    }
    ctx.putImageData(image,0,0);
  }

  function renderWalls(w,h) {
    const horizon=h*.49 + Math.sin(player.bob)*h*.006;
    const textureData={};
    for(const k of [1,2,3,4]) textureData[k]=textures[k].getContext("2d").getImageData(0,0,TEX,TEX).data;
    const image=ctx.getImageData(0,0,w,h), data=image.data;
    for(let x=0;x<w;x++) {
      const cameraX=2*x/w-1;
      const rayAngle=player.angle+Math.atan(cameraX*Math.tan(FOV/2));
      const rayDirX=Math.cos(rayAngle),rayDirY=Math.sin(rayAngle);
      let mapX=Math.floor(player.x),mapY=Math.floor(player.y);
      const deltaX=Math.abs(1/(rayDirX||1e-9)),deltaY=Math.abs(1/(rayDirY||1e-9));
      const stepX=rayDirX<0?-1:1,stepY=rayDirY<0?-1:1;
      let sideX=rayDirX<0?(player.x-mapX)*deltaX:(mapX+1-player.x)*deltaX;
      let sideY=rayDirY<0?(player.y-mapY)*deltaY:(mapY+1-player.y)*deltaY;
      let side=0,hit=0,cell=1;
      for(let i=0;i<80&&!hit;i++){
        if(sideX<sideY){sideX+=deltaX;mapX+=stepX;side=0;}else{sideY+=deltaY;mapY+=stepY;side=1;}
        cell=world[mapY]?.[mapX] ?? 1; if(cell!==0)hit=1;
      }
      let perp=side===0?(mapX-player.x+(1-stepX)/2)/(rayDirX||1e-9):(mapY-player.y+(1-stepY)/2)/(rayDirY||1e-9);
      perp=Math.max(.001,perp*Math.cos(rayAngle-player.angle)); depthBuffer[x]=perp;
      const lineH=Math.min(h*2.2,h/perp); let top=Math.floor(horizon-lineH/2),bot=Math.floor(horizon+lineH/2);
      const wallX=side===0?player.y+perp*rayDirY:player.x+perp*rayDirX; let texX=Math.floor((wallX-Math.floor(wallX))*TEX);
      if((side===0&&rayDirX>0)||(side===1&&rayDirY<0)) texX=TEX-texX-1;
      const fog=Math.max(0,Math.min(1,1-perp/MAX_DEPTH));
      const sideShade=side?0.76:1; const flicker=.96+Math.sin(performance.now()*.018)*.035+Math.random()*.012;
      const warm=Math.max(0,1-perp/5.8)*.26;
      const tex=textureData[cell]||textureData[1];
      for(let y=Math.max(0,top);y<Math.min(h,bot);y++){
        const ty=Math.floor(((y-top)/lineH)*TEX)&63,si=(ty*TEX+texX)*4,di=(y*w+x)*4;
        const light=(.08+fog*.92)*sideShade*flicker;
        data[di]=tex[si]*light+56*warm;
        data[di+1]=tex[si+1]*light+22*warm;
        data[di+2]=tex[si+2]*light+4*warm;
        data[di+3]=255;
      }
    }
    ctx.putImageData(image,0,0);
  }

  function renderSprites(w,h) {
    const visible=[];
    for(const s of sprites){
      if(s.alive===false)continue;
      const dx=s.x-player.x,dy=s.y-player.y,dist=Math.hypot(dx,dy);
      let angle=normalizeSigned(Math.atan2(dy,dx)-player.angle);
      if(Math.abs(angle)>FOV*.72 || dist>.4+MAX_DEPTH)continue;
      visible.push({s,dist,angle});
    }
    visible.sort((a,b)=>b.dist-a.dist);
    for(const item of visible) drawSprite(item,w,h);
  }

  function drawSprite(item,w,h) {
    const {s,dist,angle}=item;
    const corrected=dist*Math.cos(angle); const screenX=w/2+Math.tan(angle)/(Math.tan(FOV/2))*w/2;
    let scale=(h/corrected); let art=spriteArt[s.type];
    if(s.type==="chest") art=s.open?spriteArt.chestOpen:spriteArt.chest;
    if(!art)return;
    let factor=1;
    if(s.type==="torch")factor=.66;
    if(s.type==="bones")factor=.43;
    if(s.type==="chest")factor=.58;
    if(s.type==="key")factor=.45;
    if(s.type==="exit")factor=1.1;
    if(s.type==="goblin")factor=.82;
    if(s.type==="warden")factor=1.05;
    const dw=scale*factor*(art.width/art.height),dh=scale*factor;
    const y=h*.49-dh*.5 + Math.sin(player.bob)*h*.006 + (s.type==="torch"?-dh*.18:s.type==="exit"?0:dh*.23);
    const x0=Math.floor(screenX-dw/2),x1=Math.floor(screenX+dw/2);
    const alpha=Math.max(.12,1-dist/MAX_DEPTH);
    ctx.save();ctx.globalAlpha=alpha;
    if(s.hurt){ctx.filter="brightness(1.8) sepia(.5) saturate(2.5) hue-rotate(-35deg)";}
    for(let sx=Math.max(0,x0);sx<Math.min(w,x1);sx+=2){
      if(corrected>depthBuffer[Math.min(w-1,sx)])continue;
      const sourceX=Math.floor((sx-x0)/dw*art.width);
      ctx.drawImage(art,sourceX,0,Math.min(2,art.width-sourceX),art.height,sx,y,2,dh);
    }
    ctx.restore();
    if((s.type==="goblin"||s.type==="warden") && corrected<5.5) {
      const barW=Math.max(20,dw*.65),barX=screenX-barW/2,barY=y-10;
      ctx.fillStyle="rgba(16,9,14,.85)";ctx.fillRect(barX-2,barY-2,barW+4,7);
      ctx.fillStyle=s.type==="warden"?"#c44655":"#d8724c";ctx.fillRect(barX,barY,barW*(s.hp/s.maxHp),3);
    }
  }

  function renderAtmosphere(w,h) {
    const t=performance.now()/1000;
    const flicker=.78+Math.sin(t*17)*.04+Math.sin(t*31)*.025+Math.random()*.03;
    const glow=ctx.createRadialGradient(w*.43,h*.58,0,w*.43,h*.58,w*.55);
    glow.addColorStop(0,`rgba(255,151,57,${.17*flicker})`); glow.addColorStop(.38,`rgba(156,59,42,${.07*flicker})`); glow.addColorStop(1,"rgba(21,5,38,.22)");
    ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
    const fog=ctx.createLinearGradient(0,h*.22,0,h*.72);fog.addColorStop(0,"rgba(19,7,42,.18)");fog.addColorStop(.5,"rgba(16,7,36,.06)");fog.addColorStop(1,"rgba(10,3,18,.17)");ctx.fillStyle=fog;ctx.fillRect(0,0,w,h);
    // Embers
    ctx.save();ctx.globalCompositeOperation="screen";
    for(let i=0;i<18;i++){
      const phase=(t*(.05+(i%5)*.011)+seededNoise(i,4,2))%1;
      const x=w*(.27+seededNoise(i,2,8)*.28)+Math.sin(t+i)*13;
      const y=h*(.84-phase*.64); const a=Math.sin(phase*Math.PI)*.5;
      ctx.fillStyle=`rgba(255,${120+i%4*20},43,${a})`;ctx.beginPath();ctx.arc(x,y,1+(i%3)*.45,0,TAU);ctx.fill();
    }
    ctx.restore();
    const vig=ctx.createRadialGradient(w*.5,h*.49,h*.18,w*.5,h*.49,h*.72);vig.addColorStop(0,"rgba(0,0,0,0)");vig.addColorStop(.63,"rgba(0,0,0,.08)");vig.addColorStop(1,"rgba(3,1,8,.72)");ctx.fillStyle=vig;ctx.fillRect(0,0,w,h);
    // Subtle film grain
    ctx.globalAlpha=.035;ctx.fillStyle="#fff";for(let i=0;i<130;i++)ctx.fillRect(Math.random()*w,Math.random()*h,1,1);ctx.globalAlpha=1;
  }

  function renderHands(w,h) {
    const t=performance.now()/1000; const bobX=Math.sin(player.bob)*w*.008, bobY=Math.abs(Math.cos(player.bob))*h*.013;
    const attackP=game.attackTimer>0?1-game.attackTimer/.32:0;
    const slash=Math.sin(Math.min(1,attackP)*Math.PI);
    ctx.save();
    // Torch arm left
    ctx.translate(bobX, bobY + Math.sin(t*2.3)*2);
    ctx.lineJoin="round";ctx.lineCap="round";
    ctx.strokeStyle="#151014";ctx.lineWidth=h*.025;ctx.strokeStyle="#151014";
    ctx.beginPath();ctx.moveTo(w*.16,h*1.04);ctx.lineTo(w*.27,h*.79);ctx.stroke();
    ctx.strokeStyle="#7c8c49";ctx.lineWidth=h*.016;ctx.beginPath();ctx.moveTo(w*.16,h*1.04);ctx.lineTo(w*.27,h*.79);ctx.stroke();
    ctx.strokeStyle="#151014";ctx.lineWidth=h*.035;ctx.beginPath();ctx.moveTo(w*.27,h*.82);ctx.lineTo(w*.31,h*.48);ctx.stroke();
    const wood=ctx.createLinearGradient(w*.27,h*.82,w*.31,h*.48);wood.addColorStop(0,"#5a3222");wood.addColorStop(1,"#8d5a33");ctx.strokeStyle=wood;ctx.lineWidth=h*.024;ctx.beginPath();ctx.moveTo(w*.27,h*.82);ctx.lineTo(w*.31,h*.48);ctx.stroke();
    ctx.strokeStyle="#2b1b18";ctx.lineWidth=h*.006;for(let j=0;j<5;j++){ctx.beginPath();ctx.moveTo(w*(.273+j*.006),h*(.79-j*.06));ctx.lineTo(w*(.294+j*.005),h*(.77-j*.06));ctx.stroke();}
    drawHeldFlame(ctx,w*.31,h*.44,h*.17,t);
    ctx.restore();

    // Knife arm right
    ctx.save();
    const ax=-slash*w*.11, ay=-slash*h*.18;
    ctx.translate(-bobX+ax,bobY+ay);ctx.rotate(-slash*.48);
    ctx.strokeStyle="#161014";ctx.lineWidth=h*.034;ctx.beginPath();ctx.moveTo(w*.91,h*1.04);ctx.lineTo(w*.82,h*.82);ctx.stroke();
    ctx.strokeStyle="#7f8e4a";ctx.lineWidth=h*.022;ctx.beginPath();ctx.moveTo(w*.91,h*1.04);ctx.lineTo(w*.82,h*.82);ctx.stroke();
    ctx.strokeStyle="#161014";ctx.lineWidth=h*.045;ctx.beginPath();ctx.moveTo(w*.82,h*.84);ctx.lineTo(w*.79,h*.72);ctx.stroke();
    ctx.strokeStyle="#6e472c";ctx.lineWidth=h*.03;ctx.beginPath();ctx.moveTo(w*.82,h*.84);ctx.lineTo(w*.79,h*.72);ctx.stroke();
    ctx.fillStyle="#151014";ctx.beginPath();ctx.moveTo(w*.765,h*.73);ctx.lineTo(w*.812,h*.70);ctx.lineTo(w*.81,h*.735);ctx.closePath();ctx.fill();
    const blade=ctx.createLinearGradient(w*.79,h*.71,w*.73,h*.39);blade.addColorStop(0,"#847c78");blade.addColorStop(.5,"#d5cec2");blade.addColorStop(1,"#f1eadb");
    ctx.fillStyle=blade;ctx.strokeStyle="#171218";ctx.lineWidth=h*.009;ctx.beginPath();ctx.moveTo(w*.785,h*.71);ctx.lineTo(w*.735,h*.42);ctx.lineTo(w*.712,h*.35);ctx.lineTo(w*.77,h*.69);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.strokeStyle="rgba(255,255,255,.4)";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(w*.758,h*.61);ctx.lineTo(w*.724,h*.39);ctx.stroke();
    ctx.restore();

    if(slash>.15){ctx.save();ctx.globalCompositeOperation="screen";ctx.globalAlpha=.36*slash;ctx.strokeStyle="#fff0c0";ctx.lineWidth=8;ctx.beginPath();ctx.arc(w*.56,h*.56,w*.23,-1.2,.25);ctx.stroke();ctx.restore();}
  }

  function drawHeldFlame(g,x,y,size,t) {
    const flick=.9+Math.sin(t*21)*.06+Math.sin(t*37)*.035;
    g.save();g.translate(x,y);g.scale(flick,1/flick*.98);g.shadowColor="#ff7a2e";g.shadowBlur=size*.35;
    const gr=g.createLinearGradient(0,-size*.8,0,size*.3);gr.addColorStop(0,"#fff58d");gr.addColorStop(.42,"#ffbd38");gr.addColorStop(1,"#f0442d");g.fillStyle=gr;g.strokeStyle="#1b1118";g.lineWidth=size*.035;
    g.beginPath();g.moveTo(0,size*.28);g.bezierCurveTo(-size*.45,size*.06,-size*.38,-size*.32,-size*.1,-size*.6);g.bezierCurveTo(-size*.06,-size*.34,size*.17,-size*.48,size*.2,-size*.82);g.bezierCurveTo(size*.53,-size*.35,size*.4,size*.07,0,size*.28);g.fill();g.stroke();g.restore();
  }

  function renderMiniMap() {
    const w=miniMap.width,h=miniMap.height;mapCtx.clearRect(0,0,w,h);
    mapCtx.fillStyle="#2d2021";mapCtx.fillRect(0,0,w,h);
    const size=8.8, ox=(w-world[0].length*size)/2,oy=9;
    for(let y=0;y<world.length;y++)for(let x=0;x<world[0].length;x++){
      if(!game.discovered[y][x])continue;
      const c=world[y][x];
      mapCtx.fillStyle=c===0?"#71594a":c===3?"#aa4b45":c===4?"#514253":c===2?"#3c3047":"#43343c";
      mapCtx.fillRect(ox+x*size,oy+y*size,size-1,size-1);
    }
    for(const s of sprites){
      if(!game.discovered[Math.floor(s.y)]?.[Math.floor(s.x)] || s.alive===false)continue;
      if(s.type==="chest"&&!s.open){mapCtx.fillStyle="#e1a94d";mapCtx.fillRect(ox+s.x*size-3,oy+s.y*size-3,6,6);}
      if(s.type==="warden"){mapCtx.fillStyle="#b95054";mapCtx.beginPath();mapCtx.arc(ox+s.x*size,oy+s.y*size,3.5,0,TAU);mapCtx.fill();}
    }
    const px=ox+player.x*size,py=oy+player.y*size;
    mapCtx.save();mapCtx.translate(px,py);mapCtx.rotate(player.angle);mapCtx.fillStyle="#f4dc75";mapCtx.shadowColor="#ffe96c";mapCtx.shadowBlur=6+Math.sin(mapPulse*5)*2;mapCtx.beginPath();mapCtx.moveTo(7,0);mapCtx.lineTo(-5,-4);mapCtx.lineTo(-3,0);mapCtx.lineTo(-5,4);mapCtx.closePath();mapCtx.fill();mapCtx.restore();
    const grad=mapCtx.createLinearGradient(0,h-45,0,h);grad.addColorStop(0,"rgba(45,32,33,0)");grad.addColorStop(1,"#2d2021");mapCtx.fillStyle=grad;mapCtx.fillRect(0,h-50,w,50);
  }

  function updateHud() {
    document.getElementById("hpText").textContent=`${Math.max(0,Math.ceil(player.hp))} / ${player.maxHp}`;
    document.getElementById("healthBar").style.width=`${Math.max(0,player.hp/player.maxHp*100)}%`;
    document.getElementById("coinText").textContent=player.coins;
    document.getElementById("keyText").textContent=player.keys;
    document.getElementById("potionCount").textContent=player.potions;
    document.getElementById("potionIcon").textContent=player.potions?"⚗":"—";
  }

  function updateObjectives() {
    const warden=sprites.find(s=>s.id==="warden");
    const steps={key:player.keys>0,warden:warden&&!warden.alive,exit:game.won};
    let active=steps.key?(steps.warden?(steps.exit?null:"exit"):"warden"):"key";
    document.querySelectorAll("#objectiveList [data-step]").forEach(el=>{
      const k=el.dataset.step;el.classList.toggle("done",!!steps[k]);el.classList.toggle("active",k===active);
    });
  }

  function showToast(text) {
    toastEl.textContent=text;toastEl.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>toastEl.classList.remove("show"),2400);
  }

  function normalizeAngle(a){a%=TAU;if(a<0)a+=TAU;return a;}
  function normalizeSigned(a){while(a>Math.PI)a-=TAU;while(a<-Math.PI)a+=TAU;return a;}
  function formatTime(sec){const m=Math.floor(sec/60),s=Math.floor(sec%60);return `${m}:${String(s).padStart(2,"0")}`;}

  function loop(now) {
    const dt=Math.min(.034,(now-lastTime)/1000);lastTime=now;
    update(dt);render();if (!TEST_MODE) requestAnimationFrame(loop);
  }

  window.addEventListener("resize",resize);
  window.addEventListener("keydown",e=>{
    keys[e.code]=true;
    if(e.code==="KeyE")interact();
    if(e.code==="Digit1")drinkPotion();
    if(e.code==="Space"){attack();e.preventDefault();}
  });
  window.addEventListener("keyup",e=>keys[e.code]=false);
  window.addEventListener("blur",()=>keys=Object.create(null));
  shell.addEventListener("mousedown",e=>{if(e.button===0){if(document.pointerLockElement!==shell&&game.running)shell.requestPointerLock?.();attack();}});
  document.addEventListener("mousemove",e=>{if(document.pointerLockElement===shell&&game.running){player.angle=normalizeAngle(player.angle+e.movementX*.00235);}});
  startButton.addEventListener("click",startGame);
  restartButton.addEventListener("click",()=>{resetGame();startGame();});
  muteButton.addEventListener("click",()=>{muted=!muted;muteButton.classList.toggle("muted",muted);muteButton.textContent=muted?"×":"♫";if(audio)audio.master.gain.setTargetAtTime(muted?0:.28,audio.ctx.currentTime,.03);});

  createTextures();createSpriteArt();resetGame();resize();discoverAroundPlayer();
  if (TEST_MODE) { game.running = true; startOverlay.style.display = "none"; }
  requestAnimationFrame(loop);
})();

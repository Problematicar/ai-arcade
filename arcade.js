(function () {
  'use strict';

  /* ═══ Constants ═══ */
  const ROOM = { x1: -800, x2: 800, z1: -700, z2: 700 };
  const PLAYER_R = 40;
  const MOVE_SPEED = 240;
  const TURN_SPEED = 2.6;
  const CAM_H = 320; // eye height above the floor
  const FOCUS_ANGLE = 0.56; // rad (~32°) — how far off-center you can aim
  const FOCUS_RANGE = 1400;

  const MACHINE_TYPES = [
    { w: 200, h: 400, d: 90, kind: 'classic' },
    { w: 180, h: 450, d: 80, kind: 'slim' },
    { w: 210, h: 350, d: 100, kind: 'kiosk' }
  ];

  /* ═══ State ═══ */
  let games = [];
  let audioCtx = null;
  let loadOverlay = null;
  let loadTimeout = null;
  let rafId = 0;
  let lastT = 0;

  const cam = { x: 0, z: 430, yaw: 0 };
  const keys = { f: false, b: false, l: false, r: false, tl: false, tr: false };
  let focusedIndex = -1;
  let dragging = false;
  let dragDist = 0;
  let lastPX = 0;
  let suppressClickUntil = 0;

  const machines = []; // rendered machines (focus + click)
  const solids = [];   // collision shapes: machines + gap blockers
  let camEl = null;
  let worldEl = null;

  /* ═══ Audio ═══ */
  function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }

  function playTone(freq, duration, type, vol) {
    try {
      if (!audioCtx) return;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime((vol || 0.08), audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {}
  }

  function playSelect() { playTone(600, 0.08, 'square', 0.05); }
  function playConfirm() {
    playTone(523, 0.1, 'sine', 0.08);
    setTimeout(() => playTone(659, 0.1, 'sine', 0.08), 100);
    setTimeout(() => playTone(784, 0.15, 'sine', 0.08), 200);
  }
  function playAmbient() {
    try {
      if (!audioCtx) return;
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const bufferSize = audioCtx.sampleRate * 4;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.02;
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(120, audioCtx.currentTime);
      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.destination);
      source.start();

      const osc = audioCtx.createOscillator();
      const oscGain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(55, audioCtx.currentTime);
      oscGain.gain.setValueAtTime(0.06, audioCtx.currentTime);
      osc.connect(oscGain);
      oscGain.connect(audioCtx.destination);
      osc.start();
    } catch (e) {}
  }

  /* ═══ Stars ═══ */
  function createStars() {
    const container = document.getElementById('stars') || (function () {
      const el = document.createElement('div');
      el.id = 'stars';
      document.getElementById('arcade').prepend(el);
      return el;
    })();
    for (let i = 0; i < 120; i++) {
      const star = document.createElement('div');
      const size = 1 + Math.random() * 2;
      star.style.cssText = `
        position: absolute;
        left: ${Math.random() * 100}%;
        top: ${Math.random() * 70}%;
        width: ${size}px;
        height: ${size}px;
        background: white;
        border-radius: 50%;
        opacity: ${0.2 + Math.random() * 0.6};
        animation: twinkle ${2 + Math.random() * 4}s ease-in-out infinite;
        animation-delay: ${Math.random() * 4}s;
      `;
      container.appendChild(star);
    }
    const style = document.createElement('style');
    style.textContent = `
      @keyframes twinkle {
        0%, 100% { opacity: 0.2; transform: scale(1); }
        50% { opacity: 0.8; transform: scale(1.3); }
      }
    `;
    document.head.appendChild(style);
  }

  /* ═══ Helpers ═══ */
  function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.round(((n >> 16) & 255) * f);
    const g = Math.round(((n >> 8) & 255) * f);
    const b = Math.round((n & 255) * f);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  /* ═══ Scene construction ═══ */
  function makeFace(w, h, cls, transform) {
    const el = document.createElement('div');
    el.className = 'face ' + cls;
    el.style.width = w + 'px';
    el.style.height = h + 'px';
    el.style.transform = transform;
    return el;
  }

  function buildMachine(game, index, x, z, yawDeg) {
    const t = MACHINE_TYPES[index % 3];
    const W = t.w, H = t.h, D = t.d;
    const m = document.createElement('div');
    m.className = 'machine';
    m.style.transform = 'translate3d(' + x + 'px,0,' + z + 'px) rotateY(' + yawDeg + 'deg)';

    // Floor light pool
    const pool = document.createElement('div');
    pool.className = 'pool';
    pool.style.cssText = 'width:' + W + 'px;height:' + W + 'px;left:' + (-W / 2) + 'px;top:' + (-W / 2) + 'px;' +
      'background: radial-gradient(circle, ' + game.color + '66 0%, ' + game.color + '22 45%, transparent 70%);' +
      'transform: translate3d(0,-2px,0) rotateX(90deg);';
    m.appendChild(pool);

    // Focus halo (soft glow in front of the machine)
    const halo = document.createElement('div');
    halo.className = 'halo';
    halo.style.cssText = 'width:' + (W + 70) + 'px;height:' + (H + 70) + 'px;left:' + (-(W + 70) / 2) + 'px;top:' + (-H - 35) + 'px;' +
      'transform: translateZ(' + (D / 2 + 10) + 'px);' +
      'background: radial-gradient(ellipse at center, transparent 48%, ' + game.color + '2e 78%, ' + game.color + '59 100%);';
    m.appendChild(halo);

    const box = document.createElement('div');
    box.className = 'machine-box';
    box.style.width = W + 'px';
    box.style.height = H + 'px';
    box.style.left = (-W / 2) + 'px';
    box.style.top = (-H) + 'px'; // box hangs from the machine origin, bottom on the floor
    box.style.setProperty('--mc', game.color);
    box.style.setProperty('--mc2', shade(game.color, 0.45));

    // Front face — marquee, screen, panel, base
    const front = makeFace(W, H, 'front', 'translateZ(' + (D / 2) + 'px)');
    front.innerHTML =
      '<div class="marquee"><span class="marquee-emoji">' + escHtml(game.emoji) + '</span><span class="marquee-text">' + escHtml(game.title) + '</span></div>' +
      '<div class="bezel"><div class="screen">' +
        '<div class="s-emoji">' + escHtml(game.emoji) + '</div>' +
        '<div class="s-title">' + escHtml(game.title) + '</div>' +
        '<div class="s-desc">' + escHtml(game.description || '') + '</div>' +
        '<div class="s-ctrl">' + escHtml(game.controls || '') + '</div>' +
        '<div class="s-idle">▼ PLAY ▼</div>' +
      '</div></div>' +
      '<div class="panel"><div class="p-btn"></div><div class="p-stick"></div><div class="p-btn"></div></div>' +
      '<div class="base"><span>● AI ARCADE ●</span></div>';
    box.appendChild(front);

    // Back face
    const back = makeFace(W, H, 'back', 'translateZ(' + (-D / 2) + 'px) rotateY(180deg)');
    box.appendChild(back);

    // Side faces (art)
    const sideArt = '<div class="side-neon"></div><div class="side-neon"></div>' +
      '<div class="side-emoji">' + escHtml(game.emoji) + '</div>' +
      '<div class="side-title">' + escHtml(game.title) + '</div>';
    const left = makeFace(D, H, 'side', 'translateX(' + (-W / 2) + 'px) rotateY(-90deg)');
    left.innerHTML = sideArt;
    box.appendChild(left);
    const right = makeFace(D, H, 'side', 'translateX(' + (W / 2) + 'px) rotateY(90deg)');
    right.innerHTML = sideArt;
    box.appendChild(right);

    // Top face
    const top = makeFace(W, D, 'top', 'translateY(' + (-H / 2) + 'px) rotateX(90deg)');
    box.appendChild(top);

    m.appendChild(box);
    worldEl.appendChild(m);

    m.addEventListener('click', () => {
      if (performance.now() < suppressClickUntil) return;
      if (loadOverlay) return;
      // Don't let a click on the machine's back start a game. The front
      // normal must point toward the camera (opposite to camera→machine).
      const fx = Math.sin(yawDeg * Math.PI / 180);
      const fz = Math.cos(yawDeg * Math.PI / 180);
      if (fx * (x - cam.x) + fz * (z - cam.z) >= 0) return;
      selectFocus(index);
      launchGame(index);
    });

    // Footprint in room coordinates, accounting for the machine's rotation:
    // width runs along the machine's local x, depth along local z. The small
    // margin keeps the camera a hair off the painted faces.
    const yr = yawDeg * Math.PI / 180;
    const halfX = Math.abs(Math.cos(yr)) * (W / 2) + Math.abs(Math.sin(yr)) * (D / 2) + 8;
    const halfZ = Math.abs(Math.sin(yr)) * (W / 2) + Math.abs(Math.cos(yr)) * (D / 2) + 8;

    const rec = { el: m, game, index, x, z, yaw: yr, halfX, halfZ };
    machines.push(rec);
    solids.push(rec);
  }

  function buildScene() {
    worldEl.innerHTML = '';
    machines.length = 0;
    solids.length = 0;

    if (games.length === 0) {
      const msg = document.createElement('div');
      msg.className = 'no-games';
      msg.textContent = 'No games found. Run refresh-games.ps1 to scan for games.';
      msg.style.cssText = 'width:800px;left:-400px;top:-20px;transform:translate3d(0,0,-300px);';
      worldEl.appendChild(msg);
      return;
    }

    // Floor
    const floor = document.createElement('div');
    floor.className = 'floor';
    floor.style.cssText = 'width:1600px;height:1400px;left:-800px;top:-700px;transform:rotateX(90deg);';
    worldEl.appendChild(floor);

    // Carpet runner
    const carpet = document.createElement('div');
    carpet.className = 'carpet';
    carpet.style.cssText = 'width:300px;height:1400px;left:-150px;top:-700px;transform:translate3d(0,-1px,0) rotateX(90deg);';
    worldEl.appendChild(carpet);

    // Walls
    function wall(w, h, x, z, yaw) {
      const el = document.createElement('div');
      el.className = 'wall';
      el.style.cssText = 'width:' + w + 'px;height:' + h + 'px;left:' + (-w / 2) + 'px;top:' + (-h / 2) + 'px;' +
        'transform:translate3d(' + x + 'px,' + (-h / 2) + 'px,' + z + 'px)' + (yaw ? ' rotateY(' + yaw + 'deg)' : '');
      worldEl.appendChild(el);
    }
    wall(1600, 750, 0, -700, 0);
    wall(1600, 750, 0, 700, 180);
    wall(1400, 750, -800, 0, 90);
    wall(1400, 750, 800, 0, -90);

    // Neon strips along the wall tops
    function strip(len, x, z, yaw, color) {
      const el = document.createElement('div');
      el.className = 'neon-strip';
      el.style.cssText = 'width:' + len + 'px;height:8px;left:' + (-len / 2) + 'px;top:-4px;' +
        'transform:translate3d(' + x + 'px,-690px,' + z + 'px)' + (yaw ? ' rotateY(' + yaw + 'deg)' : '') + ';' +
        'background:' + color + ';box-shadow:0 0 28px ' + color + ', 0 0 60px ' + color + '33;';
      worldEl.appendChild(el);
    }
    strip(1600, 0, -696, 0, '#ff6b6b');
    strip(1600, 0, 696, 180, '#c96bff');
    strip(1400, -796, 0, 90, '#6bcbff');
    strip(1400, 796, 0, -90, '#ffd93d');

    // Back-wall neon sign
    const sign = document.createElement('div');
    sign.className = 'neon-sign';
    sign.innerHTML = '<div class="neon-sign-main">AI ARCADE</div><div class="neon-sign-sub">● WALK THE ARCADE ●</div>';
    sign.style.cssText = 'width:1000px;height:180px;left:-500px;top:-90px;transform:translate3d(0px,-380px,-691px);';
    worldEl.appendChild(sign);

    // Wall posters
    function poster(x, z, yaw, emoji, text) {
      const el = document.createElement('div');
      el.className = 'poster';
      el.innerHTML = '<span class="poster-emoji">' + emoji + '</span><span class="poster-text">' + text + '</span>';
      el.style.cssText = 'width:200px;height:120px;left:-100px;top:-60px;' +
        'transform:translate3d(' + x + 'px,-260px,' + z + 'px) rotateY(' + yaw + 'deg);';
      worldEl.appendChild(el);
    }
    poster(-793, -380, 90, '🪙', 'INSERT COIN');
    poster(793, 380, -90, '🕹️', 'PLAY AGAIN');
    poster(-793, 80, 90, '🏆', 'HIGH SCORES');
    poster(793, -80, -90, '⭐', 'BEST SCORES');

    // Machines: featured at the back, rows facing each other along the sides
    const ROW_X = 380;
    const rowZ = [-520, -200, 120, 440];
    const leftTilt = [4, -5, 3, -4];
    const rightTilt = [-4, 5, -3, 4];
    for (let i = 0; i < 4; i++) {
      const gL = games[i + 1];
      if (gL) buildMachine(gL, i + 1, -ROW_X, rowZ[i], 90 + leftTilt[i]);
      const gR = games[i + 5];
      if (gR) buildMachine(gR, i + 5, ROW_X, rowZ[i], -90 + rightTilt[i]);
    }
    // Featured machine sits flush against the back wall (z -700) instead of
    // with its back buried inside it.
    if (games[0]) buildMachine(games[0], 0, 0, -643, 0);

    addGapBlockers(ROW_X);
  }

  // Fill the gaps between machines in each row so the player can't squeeze
  // between cabinets — rows read as a continuous wall, but you can still walk
  // around their ends into the space behind.
  function addGapBlockers(rowX) {
    for (const rx of [rowX, -rowX]) {
      const row = machines.filter((m) => Math.abs(m.x - rx) < 10).sort((a, b) => a.z - b.z);
      for (let i = 0; i < row.length - 1; i++) {
        const a = row[i], b = row[i + 1];
        const gap = (b.z - b.halfZ) - (a.z + a.halfZ);
        if (gap > 0) {
          solids.push({ x: rx, z: (a.z + b.z) / 2, halfX: 16, halfZ: gap / 2 + 10 });
        }
      }
    }
  }

  /* ═══ Focus (keyboard aim) ═══ */
  function computeFocus() {
    let best = -1, bestA = FOCUS_ANGLE, bestD = FOCUS_RANGE;
    const c = Math.cos(cam.yaw), s = Math.sin(cam.yaw);
    for (const m of machines) {
      const relX = m.x - cam.x, relZ = m.z - cam.z;
      const cz = s * relX + c * relZ;           // camera-space depth
      if (cz >= 0) continue;                    // behind the camera
      const cx = c * relX - s * relZ;
      const dist = Math.hypot(relX, relZ);
      if (dist > FOCUS_RANGE) continue;
      const ang = Math.abs(Math.atan2(cx, -cz));
      if (ang > FOCUS_ANGLE) continue;
      // machine front must face the camera (opposite to camera→machine)
      if (Math.sin(m.yaw) * relX + Math.cos(m.yaw) * relZ >= 0) continue;
      if (ang < bestA - 1e-9 || (Math.abs(ang - bestA) < 1e-9 && dist < bestD)) {
        best = m.index; bestA = ang; bestD = dist;
      }
    }
    return best;
  }

  function selectFocus(i) {
    if (i === focusedIndex) return;
    focusedIndex = i;
    machines.forEach((m) => m.el.classList.toggle('focused', m.index === i));
    updateHUD();
    if (i >= 0) playSelect();
  }

  function updateHUD() {
    const gc = document.getElementById('game-count');
    const ft = document.getElementById('focused-title');
    if (focusedIndex >= 0 && games[focusedIndex]) {
      gc.textContent = (focusedIndex + 1) + ' / ' + games.length;
      ft.textContent = games[focusedIndex].title;
    } else {
      gc.textContent = games.length + ' MACHINES';
      ft.textContent = '— LOOK AROUND —';
    }
  }

  /* ═══ Movement & collision ═══ */
  function applyCamera() {
    if (!camEl) return;
    // Camera-space transform on the camera element (which has transform-origin
    // 0 0): stage = R(-yaw) * (point - cam) + (0, eyeHeight, 0). The parent
    // #stage applies the perspective projection.
    camEl.style.transform = 'rotateY(' + (-cam.yaw * 180 / Math.PI) + 'deg) translate3d(' +
      (-cam.x) + 'px,' + CAM_H + 'px,' + (-cam.z) + 'px)';
  }

  // Move the camera one axis at a time, resolving against the room bounds and
  // every solid shape. Per-axis resolution makes the player slide along walls
  // and cabinets instead of snapping to the corner.
  function moveAxis(dx, dz) {
    cam.x += dx;
    cam.x = clamp(cam.x, ROOM.x1 + PLAYER_R, ROOM.x2 - PLAYER_R);
    for (const s of solids) {
      if (cam.z > s.z - s.halfZ - PLAYER_R && cam.z < s.z + s.halfZ + PLAYER_R &&
          cam.x > s.x - s.halfX - PLAYER_R && cam.x < s.x + s.halfX + PLAYER_R) {
        cam.x = (cam.x - (s.x - s.halfX - PLAYER_R) < (s.x + s.halfX + PLAYER_R) - cam.x)
          ? s.x - s.halfX - PLAYER_R : s.x + s.halfX + PLAYER_R;
      }
    }
    cam.z += dz;
    cam.z = clamp(cam.z, ROOM.z1 + PLAYER_R, ROOM.z2 - PLAYER_R);
    for (const s of solids) {
      if (cam.x > s.x - s.halfX - PLAYER_R && cam.x < s.x + s.halfX + PLAYER_R &&
          cam.z > s.z - s.halfZ - PLAYER_R && cam.z < s.z + s.halfZ + PLAYER_R) {
        cam.z = (cam.z - (s.z - s.halfZ - PLAYER_R) < (s.z + s.halfZ + PLAYER_R) - cam.z)
          ? s.z - s.halfZ - PLAYER_R : s.z + s.halfZ + PLAYER_R;
      }
    }
  }

  function step(dt) {
    let dx = 0, dz = 0;
    if (keys.f) { dx -= Math.sin(cam.yaw); dz -= Math.cos(cam.yaw); }
    if (keys.b) { dx += Math.sin(cam.yaw); dz += Math.cos(cam.yaw); }
    if (keys.l) { dx -= Math.cos(cam.yaw); dz += Math.sin(cam.yaw); }
    if (keys.r) { dx += Math.cos(cam.yaw); dz -= Math.sin(cam.yaw); }
    const len = Math.hypot(dx, dz);
    if (len > 0) moveAxis(dx / len * MOVE_SPEED * dt, dz / len * MOVE_SPEED * dt);
    if (keys.tl) cam.yaw += TURN_SPEED * dt;
    if (keys.tr) cam.yaw -= TURN_SPEED * dt;
  }

  function clearKeys() {
    keys.f = keys.b = keys.l = keys.r = keys.tl = keys.tr = false;
  }

  /* ═══ Launch ═══ */
  function cancelLaunch() {
    if (loadOverlay) {
      loadOverlay.remove();
      loadOverlay = null;
    }
    if (loadTimeout) {
      clearTimeout(loadTimeout);
      loadTimeout = null;
    }
    clearKeys();
  }

  function launchGame(index) {
    if (!games[index]) return;
    cancelLaunch();
    playConfirm();
    const game = games[index];
    const path = game.path || game.folder + '/index.html';

    loadOverlay = document.createElement('div');
    loadOverlay.style.cssText = `
      position: fixed; inset: 0; z-index: 200;
      background: #0a0a12;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      opacity: 0;
      transition: opacity 0.5s;
      color: ${game.color || '#44cc44'};
      font-family: 'Courier New', monospace;
    `;
    loadOverlay.innerHTML = `
      <div style="position:absolute;top:1.5rem;left:1.5rem;font-size:0.8rem;color:#666;cursor:pointer;padding:8px 16px;border:1px solid #444;border-radius:4px;transition:color 0.2s,border-color 0.2s;" id="back-btn">← BACK</div>
      <div style="font-size:2rem;font-weight:800;letter-spacing:0.2em;text-shadow:0 0 30px currentColor;">
        NOW LOADING
      </div>
      <div style="margin-top:1rem;font-size:0.9rem;color:#888;">
        ${escHtml(game.title)}
      </div>
      <div style="margin-top:2rem;width:200px;height:3px;background:#222;border-radius:2px;overflow:hidden;">
        <div style="height:100%;width:0%;background:${game.color || '#44cc44'};border-radius:2px;transition:width 0.8s;" id="load-bar"></div>
      </div>
    `;
    document.body.appendChild(loadOverlay);

    const backBtn = loadOverlay.querySelector('#back-btn');
    backBtn.addEventListener('click', cancelLaunch);
    backBtn.addEventListener('mouseenter', () => {
      backBtn.style.color = '#aaa';
      backBtn.style.borderColor = '#888';
    });
    backBtn.addEventListener('mouseleave', () => {
      backBtn.style.color = '#666';
      backBtn.style.borderColor = '#444';
    });

    requestAnimationFrame(() => {
      // The overlay can be cancelled (Escape / another launch) before this
      // frame fires — bail out instead of touching a removed node.
      if (!loadOverlay) return;
      loadOverlay.style.opacity = '1';
      const bar = document.getElementById('load-bar');
      if (bar) bar.style.width = '100%';
    });

    loadTimeout = setTimeout(() => {
      if (loadOverlay) window.location.href = path;
    }, 1200);
  }

  /* ═══ Init ═══ */
  function dismissSplash() {
    const splash = document.getElementById('splash');
    if (!splash || splash.classList.contains('hidden')) return;
    splash.classList.add('hidden');
    document.getElementById('stage').classList.add('visible');
    initAudio();
    playAmbient();
    init();
  }

  function init() {
    cancelAnimationFrame(rafId);
    machines.length = 0;
    buildScene();
    cam.x = 0; cam.z = 500; cam.yaw = 0;
    focusedIndex = -1;
    lastT = 0;
    applyCamera();
    updateHUD();
    rafId = requestAnimationFrame(loop);
  }

  function loop(t) {
    const dt = Math.min(0.05, lastT ? (t - lastT) / 1000 : 0.016);
    lastT = t;
    if (!loadOverlay) {
      step(dt);
      applyCamera();
      const fi = computeFocus();
      if (fi !== focusedIndex) {
        focusedIndex = fi;
        updateHUD();
        if (fi >= 0) playSelect();
      }
      machines.forEach((m) => m.el.classList.toggle('focused', m.index === focusedIndex));
    }
    rafId = requestAnimationFrame(loop);
  }

  /* ═══ Input ═══ */
  function handleKey(e) {
    const splash = document.getElementById('splash');
    if (splash && !splash.classList.contains('hidden')) {
      e.preventDefault();
      dismissSplash();
      return;
    }

    if (loadOverlay) {
      if (e.key === 'Escape') cancelLaunch();
      return;
    }

    switch (e.key) {
      case 'Escape': cancelLaunch(); break;
      case 'ArrowUp': case 'w': case 'W': keys.f = true; e.preventDefault(); break;
      case 'ArrowDown': case 's': case 'S': keys.b = true; e.preventDefault(); break;
      case 'ArrowLeft': case 'q': case 'Q': keys.tl = true; e.preventDefault(); break;
      case 'ArrowRight': case 'e': case 'E': keys.tr = true; e.preventDefault(); break;
      case 'a': case 'A': keys.l = true; break;
      case 'd': case 'D': keys.r = true; break;
      case 'Enter': case ' ':
        e.preventDefault();
        if (focusedIndex >= 0) launchGame(focusedIndex);
        break;
    }
  }

  function handleKeyUp(e) {
    switch (e.key) {
      case 'ArrowUp': case 'w': case 'W': keys.f = false; break;
      case 'ArrowDown': case 's': case 'S': keys.b = false; break;
      case 'ArrowLeft': case 'q': case 'Q': keys.tl = false; break;
      case 'ArrowRight': case 'e': case 'E': keys.tr = false; break;
      case 'a': case 'A': keys.l = false; break;
      case 'd': case 'D': keys.r = false; break;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    worldEl = document.getElementById('world');
    camEl = document.getElementById('camera');
    games = window.ARCADE_GAMES || [];

    createStars();
    updateHUD();

    document.addEventListener('keydown', handleKey);
    document.addEventListener('keyup', handleKeyUp);
    document.addEventListener('click', () => {
      const splash = document.getElementById('splash');
      if (splash && !splash.classList.contains('hidden')) dismissSplash();
    });

    // Suppress the click that ends a drag-look gesture
    document.addEventListener('click', (e) => {
      if (performance.now() < suppressClickUntil) {
        e.stopPropagation();
        e.preventDefault();
      }
    }, true);

    window.addEventListener('pointerdown', (e) => {
      if (loadOverlay) return;
      if (e.button !== 0) return;
      dragging = true;
      dragDist = 0;
      lastPX = e.clientX;
    });
    window.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastPX;
      lastPX = e.clientX;
      dragDist += Math.abs(dx);
      cam.yaw -= dx * 0.005; // drag right → turn right
      applyCamera();
    });
    window.addEventListener('pointerup', () => {
      if (dragging && dragDist > 8) suppressClickUntil = performance.now() + 250;
      dragging = false;
    });
    window.addEventListener('blur', () => {
      clearKeys();
      dragging = false;
    });
  });

})();

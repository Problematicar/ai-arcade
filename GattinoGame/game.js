/* ============================================================
   Gattino — A cozy 2-player co-op puzzle
   P1 (ginger)  : follows the MOUSE
   P2 (gray)    : WASD / Arrow keys
   Goal each level: collect all fish, then both kittens sit on
   their own food bowl at the same time.
   ============================================================ */

const canvas = document.getElementById('game');
const ctx    = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;     // logical size

/* ---------- Grid ---------- */
const TILE = 48;
const COLS = W / TILE;   // 20
const ROWS = H / TILE;   // 12 (50 remainder used as padding via offset)

const OX = 0, OY = 0; // grid origin (we keep it full-bleed)

/* ---------- Palette ---------- */
const COL = {
  floorA: '#fff3e0',
  floorB: '#fbe6cc',
  wall:   '#7a5b46',
  wallTop:'#9c7a60',
  p1:     '#f08a3c',
  p1d:    '#d36f25',
  p2:     '#8a93a3',
  p2d:    '#6b7587',
  plate:  '#c98a4b',
  plateOn:'#5fbf8a',
  door:   '#b56b3e',
  doorOpen:'#e9d9c6',
  fish:   '#6cc6d6',
  bowlP1: '#f6a546',
  bowlP2: '#9aa6b6',
  ink:    '#5b4636',
};

/* ---------- Levels ----------
   Legend (grid chars, COLS=20 x ROWS=12):
     .  floor
     #  wall
     1  P1 (ginger) spawn  — MOUSE controlled; ONLY P1 can press buttons
     2  P2 (gray) spawn    — KEYBOARD (WASD/Arrows); ONLY P2 can push boxes
     A  button that opens door a (lowercase)  — pressed by P1 standing on it,
        or held down by a box sitting on it
     a  door controlled by button A
     B/b ... E/e more pairs
     F  fish (shared, collect all)
     X  box (pushable by P2; holds buttons down)
     o  P1 bowl            e  P2 bowl
   Note: buttons/doors are paired by letter case-insensitively (A->a etc.)
*/
const LEVELS = [
  // 1 — Tutorial: just collect the fish, then sit on bowls.
  [
    "####################",
    "#..................#",
    "#........F.........#",
    "#..................#",
    "#..................#",
    "#..1.....F......2..#",
    "#..................#",
    "#..................#",
    "#........F.........#",
    "#..................#",
    "#..o............e..#",
    "####################",
  ],
  // 2 — Button & door: P1 holds the button so P2 can reach the fish.
  [
    "####################",
    "#......F......F....#",
    "#..................#",
    "#......F...........#",
    "#####aaaaa##########",
    "#..1...........2...#",
    "#..................#",
    "#.........A........#",
    "#..................#",
    "#..................#",
    "#..o............e..#",
    "####################",
  ],
  // 3 — Box: P2 pushes the box onto button A to hold the door open.
  [
    "####################",
    "#..................#",
    "#..1...........2...#",
    "#..................#",
    "#.......X....A.....#",
    "#..................#",
    "#####aaaaa##########",
    "#......F...........#",
    "#..................#",
    "#..................#",
    "#..o............e..#",
    "####################",
  ],
  // 4 — Two doors: P1 swaps between buttons to open each alcove for P2.
  [
    "####################",
    "#.F............F...#",
    "#..................#",
    "#..................#",
    "##aaa########bbb####",
    "#..................#",
    "#.........F........#",
    "#..1..A.....B...2..#",
    "#..................#",
    "#..................#",
    "#..o............e..#",
    "####################",
  ],
  // 5 — Combine: box holds one door, P1's cursor holds the other.
  [
    "####################",
    "#..F....##....F....#",
    "#........##........#",
    "####bbbb##aaaa######",
    "#..................#",
    "#..1.....X.....2...#",
    "#..................#",
    "#.........A..B.....#",
    "#.........F........#",
    "#..o............e..#",
    "#..................#",
    "####################",
  ],
  // 6 — Relay: P1 holds the button while P2 fetches four fish from the lower
  //     room, then returns. Bowls stay on P1's side so nobody gets stranded.
  [
    "####################",
    "#..1...2...A.......#",
    "#..................#",
    "#......o....e......#",
    "########a###########",
    "#..................#",
    "#..F...........F...#",
    "#..................#",
    "#..................#",
    "#..F...........F...#",
    "#..................#",
    "####################",
  ],
  // 7 — Two boxes: P2 pushes each box onto its matching button to open both
  //     doors permanently, then everyone explores the lower room.
  [
    "####################",
    "#..................#",
    "#..1...X....X...2..#",
    "#..................#",
    "#..A...........B...#",
    "########a###b#######",
    "#..................#",
    "#......F....F......#",
    "#..................#",
    "#..................#",
    "#..o............e..#",
    "####################",
  ],
  // 8 — Sequential: P1 holds A so P2 can get through door a and push the box
  //     onto B. Door b opens permanently. P2 grabs fish below b; P1 walks to
  //     its own bowl up top (P1 never needs to cross a).
  [
    "####################",
    "#..1...2...A...o...#",
    "#..................#",
    "#####aaaaa##########",
    "#..................#",
    "#......X.....B.....#",
    "#..................#",
    "#####bbbbb##########",
    "#......F....F......#",
    "#..................#",
    "#..............e...#",
    "####################",
  ],
  // 9 — Double relay: P1 holds A so P2 can raid the top alcove, then swaps
  //     to B so P2 can raid the bottom alcove. Bowls and buttons in the middle.
  [
    "####################",
    "#......F.....F.....#",
    "#..................#",
    "##aaa###############",
    "#..1...2...A...B...#",
    "#......o....e......#",
    "#############bbb####",
    "#..................#",
    "#..............F...#",
    "#..................#",
    "#..................#",
    "####################",
  ],
  // 10 — Box the exit: both kittens start locked in the top room. P2 pushes
  //      the box onto button A to open the only door permanently, then both
  //      escape down to the fish and bowls.
  [
    "####################",
    "#..................#",
    "#..1...2...X..A....#",
    "#..................#",
    "#####aaaaa##########",
    "#..................#",
    "#..................#",
    "#..................#",
    "#..................#",
    "#..F....F....F.....#",
    "#..o............e..#",
    "####################",
  ],
  // 11 — Crossover: box holds the left door open, P1's cursor holds the right.
  //      Fish are tucked in both upper wings; bowls and free fish in the middle.
  [
    "####################",
    "#..F....##....F....#",
    "#........##........#",
    "####bbbb##aaaa######",
    "#..................#",
    "#..1...X..A....B.2.#",
    "#..................#",
    "#.........F........#",
    "#..................#",
    "#..................#",
    "#..o............e..#",
    "####################",
  ],
  // 12 — Three doors, two boxes: P2 spends both boxes on doors a and b, P1
  //      holds button C for door c. All three fish lie beyond the door wall.
  [
    "####################",
    "#..................#",
    "#..1...X....X...2..#",
    "#..................#",
    "#..A...........B...#",
    "#####aaa###bbb######",
    "#..................#",
    "#.........C....F...#",
    "##########ccc#######",
    "#......F....F......#",
    "#..o............e..#",
    "####################",
  ],
  // 13 — Deep boxes: two doors in series, two boxes to hold them both open.
  //      P2 pushes each box onto its button, opening the way to the fish room.
  [
    "####################",
    "#..................#",
    "#..1...2...X..A..o.#",
    "#..................#",
    "#####aaaaa##########",
    "#..................#",
    "#......X....B..e...#",
    "#..................#",
    "#####bbbbb##########",
    "#..................#",
    "#..F....F....F.....#",
    "####################",
  ],
  // 14 — Gauntlet: four fish behind layered doors. P1 must juggle buttons A
  //      and B so P2 can dash through both doors to collect every fish, then
  //      return to the bowls. (P2 has no box here — pure relay timing.)
  [
    "####################",
    "#.F............F...#",
    "#..................#",
    "##aaa###############",
    "#..1...2...A...B...#",
    "#......o....e......#",
    "###############bbb##",
    "#..................#",
    "#.........F....F...#",
    "#..................#",
    "#..................#",
    "####################",
  ],
  // 15 — Grand finale: three doors, two boxes, four fish. P2 boxes doors a and
  //      b permanently, P1 holds button C for door c. Fish spread across all wings.
  [
    "####################",
    "#.F......##......F.#",
    "#........##........#",
    "####aaaa##aaaa######",
    "#..................#",
    "#..1.X.A...B.X.2...#",
    "#..................#",
    "########bbbb########",
    "#..F.....C....F....#",
    "#####cccccccc#######",
    "#..o............e..#",
    "####################",
  ],
];

// Friendly intro line shown when each level loads.
const LEVEL_INTROS = [
  "Catch all the fish, then both sit on your bowls!",
  "P1: hold the button. P2: grab the fish behind the door.",
  "P2: push the box onto the button to hold the door open.",
  "Two doors — P1 swaps buttons so P2 can raid both alcoves.",
  "Combine! Box one door, hold the other with the cursor.",
  "Relay: P1 holds the door while P2 collects four fish below.",
  "Two boxes, two doors — P2 sets both, then everyone explores.",
  "Sequential: P1 holds A so P2 can reach and box button B.",
  "Double relay: P1 swaps A then B so P2 can raid top and bottom.",
  "Locked in! P2 must box the button to open the only way out.",
  "Crossover: box the left door, hold the right with the cursor.",
  "Three doors, two boxes — spend them, P1 holds the third.",
  "Nested: P1 holds the outer door while P2 boxes the inner button.",
  "Gauntlet: four fish behind layered doors — juggle and dash!",
  "Grand finale! Three doors, three boxes, four fish. Good luck!",
];

/* ---------- Game state ---------- */
let levelIndex = 0;
let walls = [];        // {x,y}
let buttons = [];      // {gx,gy,id}
let doors = [];        // {gx,gy,id, open}
let fish = [];         // {gx,gy,taken}
let boxes = [];        // {gx,gy}
let bowls = [];        // {gx,gy, owner}
let players = [];      // [p1, p2]
let totalFish = 0;
let takenFish = 0;
let particles = [];
let levelDone = false;
let gameComplete = false;

/* ---------- Input ---------- */
const keys = Object.create(null);
const mouse = { x: W/2, y: H/2, inside: false };

window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  keys[k] = true;
  // prevent page scroll on arrows/space
  if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)) e.preventDefault();
  // quick restart
  if (k === 'r') restartLevel();
  if (k === 'n' && levelDone) nextLevel();
});
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

function canvasPos(ev) {
  const r = canvas.getBoundingClientRect();
  const sx = canvas.width / r.width;
  const sy = canvas.height / r.height;
  return { x: (ev.clientX - r.left) * sx, y: (ev.clientY - r.top) * sy };
}
canvas.addEventListener('mousemove', e => {
  const p = canvasPos(e);
  mouse.x = p.x; mouse.y = p.y; mouse.inside = true;
});
canvas.addEventListener('mouseleave', () => { mouse.inside = false; });
canvas.addEventListener('mouseenter', () => { mouse.inside = true; });

/* ---------- Helpers ---------- */
const gx2px = gx => OX + gx * TILE;
const gy2py = gy => OY + gy * TILE;
const clamp = (v,a,b) => v < a ? a : v > b ? b : v;

function isWallCell(gx, gy) {
  if (gx < 0 || gy < 0 || gx >= COLS || gy >= ROWS) return true;
  return walls.some(w => w.x === gx && w.y === gy);
}
function closedDoorAt(gx, gy) {
  return doors.find(d => d.gx === gx && d.gy === gy && !d.open);
}
function boxAt(gx, gy) { return boxes.find(b => b.gx === gx && b.gy === gy); }

/* ---------- Level load ---------- */
function loadLevel(idx) {
  const map = LEVELS[idx];
  walls = []; buttons = []; doors = []; fish = []; boxes = []; bowls = [];
  players = []; particles = [];
  levelDone = false; gameComplete = false;

  // First pass: register doors & buttons by letter
  const doorIds = new Set();
  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[y].length; x++) {
      const c = map[y][x];
      if ('abcdef'.includes(c)) doorIds.add(c);
    }
  }

  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[y].length; x++) {
      const c = map[y][x];
      const cx = OX + x*TILE + TILE/2;
      const cy = OY + y*TILE + TILE/2;
      switch (c) {
        case '#': walls.push({x, y}); break;
        case '1': players[0] = makeCat(0, cx, cy); break;
        case '2': players[1] = makeCat(1, cx, cy); break;
        case 'F': fish.push({gx:x, gy:y, taken:false, t:Math.random()*6}); break;
        case 'X': boxes.push({gx:x, gy:y, drawX:cx, drawY:cy}); break;
        case 'o': bowls.push({gx:x, gy:y, owner:0}); break;
        case 'e': bowls.push({gx:x, gy:y, owner:1}); break;
        default:
          if ('ABCDEF'.includes(c)) {
            buttons.push({gx:x, gy:y, id:c.toLowerCase()});
          } else if ('abcdef'.includes(c)) {
            doors.push({gx:x, gy:y, id:c, open:false});
          }
      }
    }
  }

  // Ensure both players exist even if a level omitted one spawn char
  if (!players[0]) players[0] = makeCat(0, TILE*1.5, TILE*1.5);
  if (!players[1]) players[1] = makeCat(1, TILE*1.5, TILE*2.5);

  totalFish = fish.length;
  takenFish = 0;
  updateHUD();
  setMessage(`Level ${idx+1} — ${LEVEL_INTROS[idx] || ''}`);
  setTimeout(() => setMessage(''), 2200);
}

function makeCat(owner, x, y) {
  return {
    owner,
    x, y, r: TILE*0.34,
    dir: {x:0, y:0},
    facing: 1,            // -1 left, 1 right
    bob: Math.random()*6,
    onBowl: false,
  };
}

/* ---------- Movement ---------- */
const SPEED_KEY = 3.0 * (TILE/48);   // px per frame @60fps for keyboard cat
const SPEED_MOUSE = 0.18;            // lerp factor toward cursor

function tryStep(cat, dx, dy) {
  // Attempt to move the cat by (dx,dy). Handles box pushing and collisions.
  const nx = cat.x + dx, ny = cat.y + dy;

  // Box push: ONLY P2 (owner 1) can push boxes. P1 walks around them.
  // Use grid cells the cat would enter.
  const targetGx = Math.round((nx - OX) / TILE - 0.5);
  const targetGy = Math.round((ny - OY) / TILE - 0.5);
  const box = boxAt(targetGx, targetGy);
  if (box) {
    if (cat.owner !== 1) {
      // P1 can't push — blocked by the box
      return;
    }
    // figure push direction from cat facing / dominant axis
    const axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    let bgx = box.gx, bgy = box.gy;
    if (axis === 'x') bgx += dx > 0 ? 1 : -1;
    else              bgy += dy > 0 ? 1 : -1;
    if (canBoxEnter(bgx, bgy)) {
      box.gx = bgx; box.gy = bgy;
      blip(180, 0.04, 'square');
    } else {
      return; // blocked
    }
  }

  // Wall collision (circle vs cell): sample center destination against nearby walls
  if (hitsWall(nx, ny, cat.r)) return;
  if (hitsClosedDoor(nx, ny, cat.r)) return;

  cat.x = nx; cat.y = ny;
  if (Math.abs(dx) > 0.1) cat.facing = dx > 0 ? 1 : -1;
}

function canBoxEnter(gx, gy) {
  if (isWallCell(gx, gy)) return false;
  if (closedDoorAt(gx, gy)) return false;
  if (boxAt(gx, gy)) return false;
  return true;
}

function hitsWall(x, y, r) {
  // check the few wall cells near (x,y)
  const minGx = Math.floor((x - r - OX) / TILE);
  const maxGx = Math.floor((x + r - OX) / TILE);
  const minGy = Math.floor((y - r - OY) / TILE);
  const maxGy = Math.floor((y + r - OY) / TILE);
  for (let gy = minGy; gy <= maxGy; gy++) {
    for (let gx = minGx; gx <= maxGx; gx++) {
      if (!isWallCell(gx, gy)) continue;
      // closest point on the cell rect to circle center
      const rx = OX + gx*TILE, ry = OY + gy*TILE;
      const cxp = clamp(x, rx, rx+TILE);
      const cyp = clamp(y, ry, ry+TILE);
      const dx = x - cxp, dy = y - cyp;
      if (dx*dx + dy*dy < r*r) return true;
    }
  }
  return false;
}
function hitsClosedDoor(x, y, r) {
  for (const d of doors) {
    if (d.open) continue;
    const rx = OX + d.gx*TILE, ry = OY + d.gy*TILE;
    const cxp = clamp(x, rx, rx+TILE);
    const cyp = clamp(y, ry, ry+TILE);
    const dx = x - cxp, dy = y - cyp;
    if (dx*dx + dy*dy < r*r) return true;
  }
  return false;
}

/* ---------- Per-frame update ---------- */
let lastT = performance.now();
function update(now) {
  const dt = Math.min(33, now - lastT) / 16.6667; // ~1 at 60fps
  lastT = now;

  if (!levelDone) {
    // ---- P2 (keyboard) ----
    const p2 = players[1];
    let dx = 0, dy = 0;
    if (keys['w'] || keys['arrowup'])    dy -= 1;
    if (keys['s'] || keys['arrowdown'])  dy += 1;
    if (keys['a'] || keys['arrowleft'])  dx -= 1;
    if (keys['d'] || keys['arrowright']) dx += 1;
    if (dx || dy) {
      const len = Math.hypot(dx, dy);
      dx /= len; dy /= len;
      tryStep(p2, dx * SPEED_KEY * dt, dy * SPEED_KEY * dt);
      p2.dir.x = dx; p2.dir.y = dy;
    } else { p2.dir.x = 0; p2.dir.y = 0; }

    // ---- P1 (mouse) ----
    const p1 = players[0];
    if (mouse.inside) {
      const ddx = mouse.x - p1.x, ddy = mouse.y - p1.y;
      const dist = Math.hypot(ddx, ddy);
      if (dist > 2) {
        const step = Math.min(dist, dist * SPEED_MOUSE * dt * 3.2 + 1.2*dt);
        const ux = ddx / dist, uy = ddy / dist;
        tryStep(p1, ux * step, uy * step);
        p1.dir.x = ux; p1.dir.y = uy;
        if (Math.abs(ux) > 0.05) p1.facing = ux > 0 ? 1 : -1;
      } else { p1.dir.x = 0; p1.dir.y = 0; }
    }

    // ---- Buttons / doors ----
    updateButtons();

    // ---- Fish pickup ----
    for (const f of fish) {
      if (f.taken) continue;
      for (const p of players) {
        if (Math.hypot(p.x - (OX+f.gx*TILE+TILE/2), p.y - (OY+f.gy*TILE+TILE/2)) < TILE*0.5) {
          f.taken = true; takenFish++;
          spawnSparkle(OX+f.gx*TILE+TILE/2, OY+f.gy*TILE+TILE/2, COL.fish);
          blip(720, 0.05, 'sine');
          updateHUD();
        }
      }
    }

    // ---- Bowl check (both required, all fish first) ----
    checkWin();
  }

  // ---- Animate boxes toward their grid cell ----
  for (const b of boxes) {
    const tx = OX + b.gx*TILE + TILE/2, ty = OY + b.gy*TILE + TILE/2;
    b.drawX += (tx - b.drawX) * 0.3;
    b.drawY += (ty - b.drawY) * 0.3;
  }
  // ---- Particles ----
  for (const pt of particles) {
    pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.15; pt.life -= 1;
  }
  particles = particles.filter(p => p.life > 0);

  // ---- Bob animation ----
  for (const p of players) p.bob += 0.15 * dt;
  for (const f of fish) f.t += 0.05 * dt;
}

function updateButtons() {
  // Determine which buttons are pressed.
  // P1 (mouse, owner 0) is the ONLY cat who can press buttons.
  // A box on a button also holds it down (any box, regardless of who pushed it).
  for (const b of buttons) {
    let pressed = false;
    // only P1 can press by standing on it
    const p1 = players[0];
    const gx = Math.round((p1.x - OX) / TILE - 0.5);
    const gy = Math.round((p1.y - OY) / TILE - 0.5);
    if (gx === b.gx && gy === b.gy) pressed = true;
    // boxes
    if (boxAt(b.gx, b.gy)) pressed = true;
    b.pressed = pressed;
  }
  // Doors open if any of their matching buttons is pressed
  for (const d of doors) {
    const open = buttons.some(b => b.id === d.id && b.pressed);
    if (open && !d.open) { d.open = true; blip(420, 0.06, 'triangle'); }
    if (!open && d.open) { d.open = false; blip(300, 0.05, 'triangle'); }
  }
}

function checkWin() {
  if (takenFish < totalFish) { return; }
  // Each cat must be on its own bowl
  let p1ok = false, p2ok = false;
  for (const bowl of bowls) {
    const cx = OX + bowl.gx*TILE + TILE/2, cy = OY + bowl.gy*TILE + TILE/2;
    const p = players[bowl.owner];
    const onIt = Math.hypot(p.x - cx, p.y - cy) < TILE*0.45;
    if (bowl.owner === 0) p1ok = onIt;
    if (bowl.owner === 1) p2ok = onIt;
  }
  if (p1ok && p2ok) {
    levelDone = true;
    celebrate();
  }
}

function celebrate() {
  for (let i=0;i<60;i++) {
    particles.push({
      x: W/2, y: H/2,
      vx: (Math.random()-0.5)*8,
      vy: (Math.random()-0.9)*7,
      life: 50 + Math.random()*30,
      color: [COL.p1, COL.p2, COL.fish, COL.plateOn][Math.floor(Math.random()*4)],
      size: 3+Math.random()*3,
    });
  }
  blip(880, 0.12, 'triangle');
  setTimeout(()=>blip(1100, 0.14, 'triangle'), 120);
  setTimeout(()=>blip(1320, 0.18, 'triangle'), 240);
  setTimeout(showLevelCompleteOverlay, 600);
}

/* ---------- Rendering ---------- */
function draw() {
  // floor
  for (let gy=0; gy<ROWS; gy++) {
    for (let gx=0; gx<COLS; gx++) {
      ctx.fillStyle = (gx+gy)%2 ? COL.floorA : COL.floorB;
      ctx.fillRect(OX+gx*TILE, OY+gy*TILE, TILE, TILE);
    }
  }

  // bowls (under cats)
  for (const bowl of bowls) drawBowl(bowl);

  // buttons
  for (const b of buttons) drawButton(b);

  // doors
  for (const d of doors) drawDoor(d);

  // walls
  for (const w of walls) drawWall(w);

  // boxes
  for (const b of boxes) drawBox(b);

  // fish
  for (const f of fish) if (!f.taken) drawFish(f);

  // particles (under cats? put above)
  drawParticles();

  // cats
  drawCat(players[0], COL.p1, COL.p1d);
  drawCat(players[1], COL.p2, COL.p2d);

  // mouse cursor indicator (P1)
  if (mouse.inside && !levelDone) drawCursor();
}

function drawWall(w) {
  const x = OX + w.x*TILE, y = OY + w.y*TILE;
  ctx.fillStyle = COL.wall;
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = COL.wallTop;
  ctx.fillRect(x, y, TILE, TILE*0.22);
  ctx.fillStyle = 'rgba(0,0,0,0.10)';
  ctx.fillRect(x, y+TILE-4, TILE, 4);
}

function drawButton(b) {
  const cx = OX + b.gx*TILE + TILE/2;
  const cy = OY + b.gy*TILE + TILE/2;
  const s = TILE*0.34;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = b.pressed ? COL.plateOn : COL.plate;
  ctx.beginPath(); ctx.arc(0,0,s,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath(); ctx.arc(-s*0.25,-s*0.25,s*0.45,0,Math.PI*2); ctx.fill();
  // letter
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.floor(TILE*0.34)}px Trebuchet MS`;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(b.id.toUpperCase(), 0, 1);
  ctx.restore();
}

function drawDoor(d) {
  const x = OX + d.gx*TILE, y = OY + d.gy*TILE;
  if (d.open) {
    ctx.fillStyle = COL.doorOpen;
    ctx.fillRect(x+2, y+2, TILE-4, TILE-4);
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.strokeRect(x+2, y+2, TILE-4, TILE-4);
  } else {
    ctx.fillStyle = COL.door;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let i=0;i<TILE;i+=8) ctx.fillRect(x, y+i, TILE, 3);
    ctx.fillStyle = '#7a4525';
    ctx.fillRect(x, y, TILE, 4);
    ctx.fillRect(x, y+TILE-4, TILE, 4);
  }
}

function drawBox(b) {
  const s = TILE*0.78;
  const x = b.drawX - s/2, y = b.drawY - s/2;
  ctx.fillStyle = '#c69a5b';
  roundRect(x, y, s, s, 6); ctx.fill();
  ctx.fillStyle = '#b08343';
  roundRect(x, y, s, s*0.2, 6); ctx.fill();
  ctx.strokeStyle = '#8a5f2e'; ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(b.drawX, y+3); ctx.lineTo(b.drawX, y+s-3);
  ctx.moveTo(x+3, b.drawY); ctx.lineTo(x+s-3, b.drawY);
  ctx.stroke();
}

function drawFish(f) {
  const cx = OX + f.gx*TILE + TILE/2;
  const cy = OY + f.gy*TILE + TILE/2 + Math.sin(f.t)*2;
  const s = TILE*0.28;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = COL.fish;
  // body
  ctx.beginPath();
  ctx.ellipse(0,0, s*1.1, s*0.7, 0, 0, Math.PI*2);
  ctx.fill();
  // tail
  ctx.beginPath();
  ctx.moveTo(-s*1.0, 0);
  ctx.lineTo(-s*1.6, -s*0.6);
  ctx.lineTo(-s*1.6,  s*0.6);
  ctx.closePath(); ctx.fill();
  // eye
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(s*0.45, -s*0.1, s*0.18, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = COL.ink;
  ctx.beginPath(); ctx.arc(s*0.5, -s*0.1, s*0.09, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

function drawBowl(bowl) {
  const cx = OX + bowl.gx*TILE + TILE/2;
  const cy = OY + bowl.gy*TILE + TILE/2;
  const base = bowl.owner === 0 ? COL.bowlP1 : COL.bowlP2;
  const s = TILE*0.4;
  ctx.save(); ctx.translate(cx, cy);
  // saucer
  ctx.fillStyle = base;
  ctx.beginPath(); ctx.ellipse(0, s*0.45, s*1.15, s*0.32, 0, 0, Math.PI*2); ctx.fill();
  // bowl
  ctx.beginPath();
  ctx.moveTo(-s*0.85, -s*0.1);
  ctx.quadraticCurveTo(0, s*0.95, s*0.85, -s*0.1);
  ctx.lineTo(-s*0.85, -s*0.1);
  ctx.fill();
  // food bits
  ctx.fillStyle = bowl.owner===0 ? '#d9701d' : '#6f7b8c';
  for (let i=0;i<5;i++) {
    ctx.beginPath();
    ctx.arc((i-2)*s*0.22, s*0.05 + (i%2)*3, 3, 0, Math.PI*2); ctx.fill();
  }
  // owner dot indicator
  ctx.fillStyle = bowl.owner===0 ? COL.p1d : COL.p2d;
  ctx.font = `bold ${Math.floor(TILE*0.22)}px Trebuchet MS`;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(bowl.owner===0 ? '1' : '2', 0, -s*0.55);
  ctx.restore();
}

function drawCat(cat, main, dark) {
  if (!cat) return;
  const x = cat.x, y = cat.y + Math.sin(cat.bob)*1.5;
  const r = cat.r;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(cat.facing, 1);

  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.beginPath(); ctx.ellipse(0, r*0.95, r*0.9, r*0.28, 0, 0, Math.PI*2); ctx.fill();

  // tail
  ctx.strokeStyle = dark; ctx.lineWidth = r*0.32; ctx.lineCap='round';
  ctx.beginPath();
  const tw = Math.sin(cat.bob*1.4)*r*0.25;
  ctx.moveTo(-r*0.7, r*0.2);
  ctx.quadraticCurveTo(-r*1.3, -r*0.1 + tw, -r*1.15, -r*0.7 + tw);
  ctx.stroke();

  // body
  ctx.fillStyle = main;
  ctx.beginPath();
  ctx.ellipse(0, r*0.2, r*0.95, r*0.8, 0, 0, Math.PI*2);
  ctx.fill();

  // head
  ctx.beginPath();
  ctx.ellipse(r*0.25, -r*0.35, r*0.78, r*0.7, 0, 0, Math.PI*2);
  ctx.fill();

  // ears
  ctx.beginPath();
  ctx.moveTo(-r*0.25, -r*0.9);
  ctx.lineTo(-r*0.05, -r*1.4);
  ctx.lineTo(r*0.25, -r*0.85);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(r*0.45, -r*0.95);
  ctx.lineTo(r*0.7, -r*1.4);
  ctx.lineTo(r*0.85, -r*0.75);
  ctx.closePath(); ctx.fill();
  // inner ears
  ctx.fillStyle = '#f3b6a0';
  ctx.beginPath();
  ctx.moveTo(-r*0.15, -r*0.95);
  ctx.lineTo(-r*0.05, -r*1.22);
  ctx.lineTo(r*0.12, -r*0.9);
  ctx.closePath(); ctx.fill();

  // eyes
  ctx.fillStyle = COL.ink;
  const blinking = (Math.sin(cat.bob*0.5 + cat.owner) > 0.97);
  if (!blinking) {
    ctx.beginPath(); ctx.ellipse(r*0.02, -r*0.4, r*0.1, r*0.14, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(r*0.5, -r*0.4, r*0.1, r*0.14, 0, 0, Math.PI*2); ctx.fill();
    // glints
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(r*0.05, -r*0.45, r*0.04, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(r*0.53, -r*0.45, r*0.04, 0, Math.PI*2); ctx.fill();
  } else {
    ctx.strokeStyle = COL.ink; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-r*0.08,-r*0.4); ctx.lineTo(r*0.12,-r*0.4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r*0.4,-r*0.4); ctx.lineTo(r*0.6,-r*0.4); ctx.stroke();
  }

  // nose
  ctx.fillStyle = '#e07a66';
  ctx.beginPath();
  ctx.moveTo(r*0.22, -r*0.18); ctx.lineTo(r*0.32, -r*0.18); ctx.lineTo(r*0.27, -r*0.1);
  ctx.closePath(); ctx.fill();
  // mouth
  ctx.strokeStyle = COL.ink; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(r*0.27, -r*0.1); ctx.quadraticCurveTo(r*0.2, 0, r*0.15, -r*0.05);
  ctx.moveTo(r*0.27, -r*0.1); ctx.quadraticCurveTo(r*0.34, 0, r*0.39, -r*0.05);
  ctx.stroke();

  // whiskers
  ctx.beginPath();
  ctx.moveTo(r*0.1, -r*0.12); ctx.lineTo(r*0.55, -r*0.18);
  ctx.moveTo(r*0.1, -r*0.05); ctx.lineTo(r*0.55, -r*0.02);
  ctx.stroke();

  ctx.restore();

  // owner badge floating above
  ctx.fillStyle = cat.owner===0 ? COL.p1d : COL.p2d;
  ctx.font = `bold 12px Trebuchet MS`;
  ctx.textAlign='center';
  ctx.fillText(cat.owner===0 ? 'P1' : 'P2', x, y - r*1.7);
}

function drawCursor() {
  ctx.save();
  ctx.strokeStyle = 'rgba(240,138,60,0.7)';
  ctx.setLineDash([4,4]); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(mouse.x, mouse.y, TILE*0.34, 0, Math.PI*2); ctx.stroke();
  ctx.setLineDash([]);
  // little paw
  ctx.fillStyle = 'rgba(240,138,60,0.9)';
  ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 4, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = clamp(p.life/30, 0, 1);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function spawnSparkle(x, y, color) {
  for (let i=0;i<12;i++) {
    particles.push({
      x, y,
      vx:(Math.random()-0.5)*4, vy:(Math.random()-0.8)*4,
      life: 25+Math.random()*15, color, size: 2+Math.random()*2,
    });
  }
}

function roundRect(x,y,w,h,r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}

/* ---------- Audio (tiny WebAudio blips) ---------- */
let actx = null;
function blip(freq, dur, type='sine') {
  try {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.18, actx.currentTime+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime+dur);
    o.connect(g); g.connect(actx.destination);
    o.start(); o.stop(actx.currentTime+dur+0.02);
  } catch(e) {}
}

/* ---------- HUD / overlay ---------- */
const elP1 = document.getElementById('p1-fish');
const elP2 = document.getElementById('p2-fish');
const overlay = document.getElementById('overlay');
const ovTitle = document.getElementById('ov-title');
const ovSub   = document.getElementById('ov-sub');
const ovHint  = document.getElementById('ov-hint');
const ovBtn   = document.getElementById('ov-btn');
const msgEl   = document.getElementById('msg');

function updateHUD() {
  elP1.textContent = `${takenFish}/${totalFish}`;
  elP2.textContent = `${takenFish}/${totalFish}`;
}

let msgTimer = null;
function setMessage(text) {
  if (!text) { msgEl.classList.remove('show'); return; }
  msgEl.textContent = text;
  msgEl.classList.add('show');
  clearTimeout(msgTimer);
  msgTimer = setTimeout(()=>msgEl.classList.remove('show'), 2600);
}

function showStartOverlay() {
  ovTitle.textContent = 'Gattino';
  ovSub.textContent = 'A cozy co-op puzzle for two kittens.';
  ovHint.innerHTML = 'Collect <b>all the fish</b>, then both kittens sit on their own <b>food bowl</b> (marked 1 &amp; 2). P1 is the only one who can <b>press buttons</b>; P2 is the only one who can <b>push boxes</b> (a box on a button holds it down).';
  ovBtn.textContent = 'Play';
  ovBtn.onclick = () => { hideOverlay(); ensureAudio(); };
  showOverlay();
}

function showLevelCompleteOverlay() {
  const last = levelIndex === LEVELS.length - 1;
  ovTitle.textContent = last ? 'You did it!' : `Level ${levelIndex+1} clear!`;
  ovSub.textContent = last
    ? 'All fish collected. The kittens are very full and very happy.'
    : (takenFish > 0 ? `Fishies gathered: ${takenFish}/${totalFish}` : 'Nice teamwork!');
  ovHint.innerHTML = last
    ? 'Thanks for playing Gattino. 🐱'
    : 'Press <b>N</b> or click below for the next level.';
  ovBtn.textContent = last ? 'Play again' : 'Next level';
  ovBtn.onclick = () => {
    if (last) { levelIndex = 0; loadLevel(0); }
    else nextLevel();
    hideOverlay();
  };
  showOverlay();
}

function showOverlay() { overlay.classList.add('show'); }
function hideOverlay() { overlay.classList.remove('show'); }
function ensureAudio() { try { if (!actx) actx = new (window.AudioContext||window.webkitAudioContext)(); if (actx.state==='suspended') actx.resume(); } catch(e){} }

function nextLevel() {
  levelIndex = (levelIndex + 1) % LEVELS.length;
  loadLevel(levelIndex);
}
function restartLevel() {
  loadLevel(levelIndex);
  setMessage('Restarted');
}

/* ---------- Main loop ---------- */
function loop(now) {
  update(now);
  // clear
  ctx.clearRect(0,0,W,H);
  draw();
  requestAnimationFrame(loop);
}

/* ---------- Boot ---------- */
loadLevel(0);
showStartOverlay();
requestAnimationFrame(loop);

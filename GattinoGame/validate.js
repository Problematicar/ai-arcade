// Validator for the level maps in game.js.
// Checks: dimensions, single spawns/bowls, sealed borders, button/door pairing,
// AND iterative reachability — repeatedly opens doors whose buttons are
// reachable, flooding outward until stable. Catches items that can NEVER be
// reached no matter how the puzzle is played.
const fs = require('fs');
const src = fs.readFileSync('./game.js', 'utf8');

const start = src.indexOf('const LEVELS = [');
const end = src.indexOf('\n];', start);
const block = src.slice(start, end + 3);
const LEVELS = eval(block.replace('const LEVELS = ', ''));

// Doors are a-d only (e is the P2 bowl char, never a door).
const isDoor    = c => /[a-d]/.test(c);
const isButton  = c => /[A-D]/.test(c);
const isWall    = c => c === '#';
const isBowl    = c => c === 'o' || c === 'e';

let problems = 0;
LEVELS.forEach((map, i) => {
  const width = map[0].length;
  const rows  = map.length;
  const bad   = [];

  // --- dimensions ---
  map.forEach((row, y) => {
    if (row.length !== width) bad.push(`row ${y} width ${row.length} != ${width}`);
  });

  const flat = map.join('');
  const p1 = (flat.match(/1/g) || []).length;
  const p2 = (flat.match(/2/g) || []).length;
  const fish = (flat.match(/F/g) || []).length;
  const b1 = (flat.match(/o/g) || []).length;
  const b2 = (flat.match(/e/g) || []).length;
  if (p1 !== 1) bad.push(`P1 spawns = ${p1}`);
  if (p2 !== 1) bad.push(`P2 spawns = ${p2}`);
  if (b1 !== 1) bad.push(`P1 bowls = ${b1}`);
  if (b2 !== 1) bad.push(`P2 bowls = ${b2}`);
  if (fish < 1) bad.push(`no fish`);

  // --- sealed borders ---
  for (let x = 0; x < width; x++) {
    if (map[0][x] !== '#')        bad.push(`top border hole x=${x}`);
    if (map[rows-1][x] !== '#')   bad.push(`bottom border hole x=${x}`);
  }
  for (let y = 0; y < rows; y++) {
    if (map[y][0] !== '#')        bad.push(`left border hole y=${y}`);
    if (map[y][width-1] !== '#')  bad.push(`right border hole y=${y}`);
  }

  // --- button/door pairing ---
  const uppers = [...new Set((flat.match(/[A-D]/g) || []))];
  const lowers = [...new Set((flat.match(/[a-d]/g) || []))];
  for (const u of uppers) if (!lowers.includes(u.toLowerCase())) bad.push(`button ${u} has no door`);
  for (const l of lowers) if (!uppers.includes(l.toUpperCase())) bad.push(`door ${l} has no button`);

  // --- iterative reachability ---
  // Build button->door map.
  const doorCellsFor = {}; // buttonId -> list of [x,y]
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < width; x++)
      if (isDoor(map[y][x])) {
        (doorCellsFor[map[y][x]] = doorCellsFor[map[y][x]] || []).push([x,y]);
      }

  let opened = new Set();  // door ids that are open
  let reach;
  let stable = false;
  while (!stable) {
    stable = true;
    reach = Array.from({length: rows}, () => Array(width).fill(false));
    const stack = [];
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < width; x++)
        if (map[y][x] === '1' || map[y][x] === '2') { reach[y][x] = true; stack.push([x,y]); }
    while (stack.length) {
      const [x, y] = stack.pop();
      for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = x+dx, ny = y+dy;
        if (nx<0||ny<0||nx>=width||ny>=rows) continue;
        if (reach[ny][nx]) continue;
        const c = map[ny][nx];
        if (isWall(c)) continue;
        if (isDoor(c) && !opened.has(c)) continue;  // closed door blocks
        reach[ny][nx] = true; stack.push([nx,ny]);
      }
    }
    // Open doors whose buttons are now reachable.
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < width; x++)
        if (isButton(map[y][x]) && reach[y][x]) {
          const id = map[y][x].toLowerCase();
          if (!opened.has(id)) { opened.add(id); stable = false; }
        }
  }

  // After all possible doors open, everything must be reachable.
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < width; x++) {
      const c = map[y][x];
      if (c === 'F' && !reach[y][x])  bad.push(`fish at (${x},${y}) never reachable`);
      if (c === 'X' && !reach[y][x])  bad.push(`box at (${x},${y}) never reachable`);
      if (isBowl(c) && !reach[y][x])  bad.push(`bowl ${c} at (${x},${y}) never reachable`);
      if (isButton(c) && !reach[y][x]) bad.push(`button ${c} at (${x},${y}) never reachable`);
    }
  }

  console.log(`Level ${i+1}: ${width}x${rows}, fish=${fish}, bowls=${b1}/${b2}, btns=[${uppers}] doors=[${lowers}]`);
  if (bad.length) { problems++; console.log('   x ' + bad.join('\n   x ')); }
  else console.log('   ok');
});
console.log(problems ? `\n${problems} level(s) with issues.` : '\nAll levels valid.');
process.exit(problems ? 1 : 0);

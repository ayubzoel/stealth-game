// Lorong Senja — world.js
// Definisi 3 level: peta grid, cover, lampion, dokumen, exit, spawn.
//
// Legenda peta (32 kolom x 18 baris, tile 40 px):
//   # dinding   C peti    K kios    T tong    L lampion (lantai + cahaya)
//   D dokumen   E pintu keluar   P spawn pemain   G spawn guard   . lantai
//   B semak (bisa dilewati, sembunyi)   O lemari (padat, E masuk/keluar)
//   S sakelar lampu (E: matikan/nyalakan lampion terdekat)

import { CONFIG } from './config.js';

const TILE = CONFIG.TILE;

function parseMap(rows, waypoints, cameras) {
  const walls = new Set();
  const covers = []; // { x, y, w, h, kind }
  const lanterns = [];
  const documents = [];
  const bushes = []; // { x, y, w, h, cx, cy } — bisa dilewati
  const lockers = []; // { x, y, w, h, cx, cy } — padat
  const switches = []; // { x, y, on, lantern } — E untuk toggle
  let exit = null;
  let playerSpawn = { x: 60, y: 60 };
  const guardSpawns = [];

  rows.forEach((row, ty) => {
    for (let tx = 0; tx < row.length; tx++) {
      const ch = row[tx];
      const px = tx * TILE;
      const py = ty * TILE;
      if (ch === '#') walls.add(tx + ',' + ty);
      else if (ch === 'C' || ch === 'K' || ch === 'T') {
        covers.push({ x: px, y: py, w: TILE, h: TILE, kind: ch });
      } else if (ch === 'L') {
        lanterns.push({ x: px + TILE / 2, y: py + TILE / 2, on: true });
      } else if (ch === 'D') {
        documents.push({ x: px + TILE / 2, y: py + TILE / 2, taken: false });
      } else if (ch === 'B') {
        bushes.push({ x: px, y: py, w: TILE, h: TILE, cx: px + TILE / 2, cy: py + TILE / 2 });
      } else if (ch === 'O') {
        lockers.push({ x: px, y: py, w: TILE, h: TILE, cx: px + TILE / 2, cy: py + TILE / 2 });
      } else if (ch === 'S') {
        switches.push({ x: px + TILE / 2, y: py + TILE / 2, on: true, lantern: null });
      } else if (ch === 'E') {
        exit = { x: px, y: py, w: TILE, h: TILE, cx: px + TILE / 2, cy: py + TILE / 2 };
      } else if (ch === 'P') {
        playerSpawn = { x: px + TILE / 2, y: py + TILE / 2 };
      } else if (ch === 'G') {
        guardSpawns.push({ x: px + TILE / 2, y: py + TILE / 2 });
      }
    }
  });

  // Tiap sakelar mengendalikan lampion terdekat (maks 260 px).
  for (const s of switches) {
    let best = null;
    let bd = 260;
    for (const l of lanterns) {
      const d = Math.hypot(l.x - s.x, l.y - s.y);
      if (d < bd) { bd = d; best = l; }
    }
    s.lantern = best;
  }

  return { walls, covers, lanterns, documents, bushes, lockers, switches, exit, playerSpawn, guardSpawns, waypoints, cameras };
}

function isSolidTile(level, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= CONFIG.COLS || ty >= CONFIG.ROWS) return true;
  if (level.walls.has(tx + ',' + ty)) return true;
  for (const c of level.covers) {
    if (tx * TILE === c.x && ty * TILE === c.y) return true;
  }
  for (const o of level.lockers) {
    if (tx * TILE === o.x && ty * TILE === o.y) return true;
  }
  return false;
}

// Apakah titik (x,y) berada di dalam semak (tempat sembunyi)?
export function isInBush(level, x, y) {
  for (const b of level.bushes) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true;
  }
  return false;
}

// Raycast garis pandang: true bila ada dinding/cover di antara a dan b.
export function hasLineOfSight(level, ax, ay, bx, by) {
  const dist = Math.hypot(bx - ax, by - ay);
  const steps = Math.max(1, Math.ceil(dist / 6));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t;
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    if (isSolidTile(level, tx, ty)) return false;
  }
  return true;
}

// Jarak raycast ke dinding terdekat sepanjang arah (untuk menggambar cone).
export function raycastDistance(level, ox, oy, angle, maxDist) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const step = 6;
  for (let d = step; d <= maxDist; d += step) {
    const x = ox + dx * d;
    const y = oy + dy * d;
    if (isSolidTile(level, Math.floor(x / TILE), Math.floor(y / TILE))) return d;
  }
  return maxDist;
}

// Tingkat cahaya 0..1 di sebuah titik (lampion hangat = terang = berbahaya).
// Lampion yang dimatikan lewat sakelar tidak memberi cahaya.
export function lightAt(level, x, y) {
  let light = 0.12; // cahaya ambien malam
  for (const l of level.lanterns) {
    if (l.on === false) continue;
    const d = Math.hypot(x - l.x, y - l.y);
    if (d < 200) light = Math.max(light, 1 - d / 200);
  }
  return Math.min(1, light);
}

// Cek tabrakan lingkaran (x,y,r) dengan semua tile padat; kembalikan posisi
// yang sudah dikoreksi per sumbu (gerak sumbu-x lalu sumbu-y).
export function collideCircle(level, x, y, r, dx, dy) {
  let nx = x + dx;
  if (circleHitsSolid(level, nx, y, r)) nx = x;
  let ny = y + dy;
  if (circleHitsSolid(level, nx, ny, r)) ny = y;
  return { x: nx, y: ny };
}

function circleHitsSolid(level, x, y, r) {
  const minTx = Math.floor((x - r) / TILE);
  const maxTx = Math.floor((x + r) / TILE);
  const minTy = Math.floor((y - r) / TILE);
  const maxTy = Math.floor((y + r) / TILE);
  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      if (!isSolidTile(level, tx, ty)) continue;
      const rx = tx * TILE;
      const ry = ty * TILE;
      const cx = Math.max(rx, Math.min(x, rx + TILE));
      const cy = Math.max(ry, Math.min(y, ry + TILE));
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < r * r) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// LEVEL 1 — Gudang Senja (3 guard, 3 dokumen)
// ---------------------------------------------------------------------------
const LEVEL_1_ROWS = [
  '################################',
  '#P....#......#........#.......D#',
  '#.....#..C...#....C...#....C..O#',
  '#..C..#......#........#........#',
  '#.....#...D..#....C...#........#',
  '#.....######.######.######.#####',
  '#......LS...........B..........#',
  '#..C......C......C.......C.....#',
  '#.........L.............GB.....#',
  '#######.######.######.#######..#',
  '#......#.......#......#........#',
  '#..D...#...C...#..C...#....E...#',
  '#......#.......#......#........#',
  '#..C...#.......#..C...#....C...#',
  '#......#.......#......#.......O#',
  '#...G..#...G...#......#........#',
  '#....B....B.........B....B.....#',
  '################################',
];

// Waypoint guard dalam koordinat tile (tengah tile).
// Urutan mengikuti urutan spawn di peta (baris atas ke bawah):
// guard koridor (baris 8), lalu guard bawah (baris 15).
const LEVEL_1_WAYPOINTS = [
  [[17, 8], [29, 8]],
  [[4, 10], [4, 16]],
  [[9, 15], [14, 15]],
];

// ---------------------------------------------------------------------------
// LEVEL 2 — Lorong Lampion (5 guard + 1 kamera, 4 dokumen)
// ---------------------------------------------------------------------------
const LEVEL_2_ROWS = [
  '################################',
  '#P...L#......#........#......D.#',
  '#.O...#..C...#....C...#..C.....#',
  '#..C..#......#........#........#',
  '#..L..#...D..#....L...#........#',
  '#.....######.######.######.#####',
  '#..............S....B..........#',
  '#.C.......C......C.......C...L.#',
  '#.......................GB.....#',
  '#######.######.######.#######..#',
  '#......#.......#......#........#',
  '#..D...#...K...#..C...#....E...#',
  '#..L...#.......#......#........#',
  '#......#...C...#..K...#...D...O#',
  '#..C...#.......#......#........#',
  '#...G..#...G...#..G...#........#',
  '#....B..G.B.........B....B.....#',
  '################################',
];

// Kamera pengawas di tengah koridor atas, menyapu kiri-kanan.
const LEVEL_2_CAMERAS = [
  { x: 16 * TILE + 20, y: 6 * TILE + 20, baseAngle: Math.PI / 2, sweepArc: (70 * Math.PI) / 180 },
];

// Urutan spawn: guard koridor (baris 8), guard bawah (baris 15), guard baris 16.
const LEVEL_2_WAYPOINTS = [
  [[24, 6], [24, 8]],
  [[4, 10], [4, 16]],
  [[9, 15], [14, 15]],
  [[17, 15], [21, 15]],
  [[2, 16], [14, 16]],
];

// ---------------------------------------------------------------------------
// LEVEL 3 — Pasar Tengah Malam (7 guard, patroli silang, 5 dokumen)
// ---------------------------------------------------------------------------
const LEVEL_3_ROWS = [
  '################################',
  '#P...L#..C...#........#..C...D.#',
  '#.....#......#....C...#.......O#',
  '#..C..#..D...#........#....K...#',
  '#..L..#......#....L...#........#',
  '#.....######.######.######.#####',
  '#..............S....B..........#',
  '#.K.....D.C......K.......C...L.#',
  '#.......................GB.....#',
  '#######.######.######.#######..#',
  '#......#.......#......#........#',
  '#..D...#...K...#..C...#....E...#',
  '#..L...#.......#......#........#',
  '#......#...C...#..K...#...D....#',
  '#..C...#.......#......#.......O#',
  '#...G..#...G...#..G...#....G...#',
  '#..G.B....B.........GB.B.......#',
  '################################',
];

// Urutan spawn: guard koridor silang (baris 8), guard bawah (baris 15),
// guard baris 16. Guard koridor berpatroli vertikal (menyilang arus koridor).
const LEVEL_3_WAYPOINTS = [
  [[24, 6], [24, 8]],
  [[4, 10], [4, 16]],
  [[11, 14], [11, 16]],
  [[17, 15], [21, 15]],
  [[24, 15], [30, 15]],
  [[2, 16], [12, 16]],
  [[14, 16], [29, 16]],
];

export const LEVELS = [
  {
    name: 'Gudang Senja',
    parTime: 90,
    ...parseMap(LEVEL_1_ROWS, LEVEL_1_WAYPOINTS, []),
  },
  {
    name: 'Lorong Lampion',
    parTime: 120,
    ...parseMap(LEVEL_2_ROWS, LEVEL_2_WAYPOINTS, LEVEL_2_CAMERAS),
  },
  {
    name: 'Pasar Tengah Malam',
    parTime: 150,
    ...parseMap(LEVEL_3_ROWS, LEVEL_3_WAYPOINTS, []),
  },
];

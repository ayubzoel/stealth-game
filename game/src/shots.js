// Lorong Senja — shots.js
// Mode deterministik untuk screenshot (?shot=start|play|alarm|end&seed=1).
// Dipanggil sekali setelah game dibuat; mengatur scene yang sama setiap run.
//
//   start : layar judul (default).
//   play  : level 1 berjalan, Raka di balik peti, cone guard di dekatnya.
//   alarm : level 1, meter deteksi tinggi, cone merah (near-miss / kejar).
//   end   : layar menang level 1.

export function applyShot(game) {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (!shot) return shot;

  const seed = parseInt(params.get('seed') || '1', 10) || 1;
  // RNG deterministik (mulberry32) — dipakai untuk variasi kecil yang stabil.
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  void rand;

  if (shot === 'start') {
    game.showTitle();
  } else if (shot === 'play') {
    game.startLevel(0);
    // Raka bersembunyi tepat di balik peti (tile 3,7), di koridor baris 8.
    game.teleport(3 * 40 + 20, 8 * 40 + 20);
    game.player.sneaking = true;
    // Guard koridor tepat di atas peti, cone-nya mengarah ke bawah dan
    // tertahan peti — Raka aman di balik cover, cone sangat dekat.
    const g = game.guards[0];
    g.x = 3 * 40 + 20;
    g.y = 6 * 40 + 20;
    g.angle = Math.PI / 2; // menghadap bawah, ke arah pemain
    g.state = 'patrol';
    g.waypoints = [{ x: g.x, y: g.y }]; // diam di tempat untuk shot deterministik
    g.wpIndex = 0;
    game.detection = 12;
  } else if (shot === 'alarm') {
    game.startLevel(0);
    // Pemain terlihat di koridor terbuka, guard mengejar.
    game.teleport(16 * 40 + 20, 8 * 40 + 20);
    const g = game.guards[1];
    g.x = 11 * 40 + 20;
    g.y = 8 * 40 + 20;
    g.angle = 0; // menghadap kanan, ke arah pemain
    g.state = 'chase';
    g.lastSeen = { x: game.player.x, y: game.player.y };
    game.detection = 92;
    game.nearMisses = 1;
    game.banner('Hampir terlihat!', 999);
  } else if (shot === 'end') {
    game.startLevel(0);
    game.giveDocuments();
    game.winLevel();
  }
  return shot;
}

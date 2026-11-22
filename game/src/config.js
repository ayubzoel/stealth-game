// Lorong Senja — config.js
// Semua konstanta permainan di satu tempat.

export const CONFIG = {
  // Canvas logis (ukuran internal; CSS yang mengatur tampilan di layar).
  CANVAS_W: 1280,
  CANVAS_H: 720,

  // Grid dunia: 32 kolom x 18 baris, tiap tile 40 px.
  TILE: 40,
  COLS: 32,
  ROWS: 18,

  // Pemain (px/detik) — Walk sunyi (default), Run cepat+bersuara (Shift),
  // Crouch pelan + hitbox kecil + deteksi setengah (C).
  PLAYER_WALK_SPEED: 150,
  PLAYER_RUN_SPEED: 235,
  PLAYER_CROUCH_SPEED: 82,
  PLAYER_RADIUS: 13,
  PLAYER_CROUCH_RADIUS: 9, // ~30% lebih kecil dari 13
  CROUCH_DETECT_MULT: 0.5, // laju deteksi terhadap pemain jongkok

  // Guard (px/detik).
  GUARD_PATROL_SPEED: 72,
  GUARD_SUSPICIOUS_SPEED: 112,
  GUARD_CHASE_SPEED: 164,
  GUARD_RADIUS: 14,
  GUARD_CATCH_RADIUS: 27,

  // Vision cone guard.
  CONE_HALF_ANGLE_DEG: 45, // total ~90 derajat
  CONE_RANGE: 220,
  CONE_CLOSE_RANGE: 110, // di bawah jarak ini deteksi jauh lebih cepat

  // Kamera pengawas (level 2).
  CAMERA_RANGE: 210,
  CAMERA_HALF_ANGLE_DEG: 35,
  CAMERA_SWEEP_SPEED: 0.55, // rad/detik
  CAMERA_SWEEP_ARC_DEG: 70,

  // Meter deteksi 0-100.
  DETECT_RATE_LIGHT: 58, // per detik, saat pemain terlihat di area terang
  DETECT_RATE_DARK: 26, // per detik, saat pemain terlihat di area gelap
  DETECT_RATE_CLOSE: 95, // per detik, saat sangat dekat dengan guard
  CAMERA_DETECT_RATE: 46,
  DETECT_DECAY: 20, // per detik saat tidak terlihat
  SUSPICIOUS_AT: 35, // meter >= ini -> guard curiga
  CHASE_AT: 85, // meter >= ini -> guard mengejar
  NEAR_MISS_PEAK: 60, // meter pernah setinggi ini lalu turun -> "Hampir terlihat!"
  NEAR_MISS_CLEAR: 25,

  // Suara / noise — hanya lari yang bersuara (jalan & jongkok sunyi).
  RUN_NOISE_RADIUS: 95,
  RUN_NOISE_INTERVAL: 0.5, // detik antar pulsa suara saat lari
  THROW_RANGE: 320,
  THROW_NOISE_RADIUS: 140,
  THROW_COOLDOWN: 0.9,

  // Skor.
  SCORE_DOCUMENT: 250,
  SCORE_TAKEDOWN: 150,
  SCORE_LEVEL_TIME_BONUS: 5, // per detik tersisa dari par time
  SCORE_NEAR_MISS_PENALTY: 40,

  // Sembunyi di semak: guard hanya melihat bila sangat dekat (px).
  BUSH_HIDE_DIST: 55,

  // Warna.
  COLORS: {
    floorDark: '#181d38',
    floorLight: '#20264a',
    wall: '#0b0e22',
    wallEdge: '#2c3468',
    crate: '#5a3d24',
    crateEdge: '#8a6238',
    kiosk: '#3d2b52',
    kioskEdge: '#7a5aa8',
    barrel: '#274b63',
    barrelEdge: '#4d8fb5',
    lanternGlow: 'rgba(255, 190, 90, 0.55)',
    player: '#2dd4bf',
    playerDark: '#0f766e',
    guard: '#e5484d',
    guardAmber: '#f5a524',
    coneCalm: 'rgba(255, 205, 60, 0.55)',
    coneSuspicious: 'rgba(245, 165, 36, 0.40)',
    coneChase: 'rgba(229, 72, 77, 0.44)',
    coneCamera: 'rgba(120, 200, 255, 0.30)',
    document: '#ffd166',
    exitClosed: '#5b6472',
    exitOpen: '#34d399',
    darkness: 'rgba(3, 5, 16, 0.58)',
  },
};

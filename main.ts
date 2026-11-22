// Lorong Senja — a top-down 2D stealth game (Node 22, standard library only).
// The game is this directory's game/ folder: plain static files a desktop
// browser loads offline (game/index.html and its ES modules, no library and
// no network request). The player is Raka, a courier slipping through a
// night-market warehouse: walk silent, run loud, crouch small, hide in
// bushes and lockers, dodge guard vision cones, throw distractions, take
// guards down from behind, and reach the exit unseen with every document.
// Three levels, guard patrol / suspicious / chase / return AI, cameras on
// level 2, checkpoints, lamp switches, Web Audio footsteps and alarms.
// Screenshots in screenshots/ (the first by name is the cover) are real
// renders of the game's own code in a browser. This program hands the game
// in: it copies game/ and screenshots/ from beside this file to /output
// and writes /output/dossier.json, the summary the judge reads, with the
// vendored make.fun library.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
if (!existsSync(join(here, 'game', 'index.html'))) {
  throw new Error('Lorong Senja: game/index.html is missing — the entry cannot be handed in without it.');
}
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

import { readdirSync, readFileSync, statSync } from 'node:fs';

// Lorong Senja build summary: count every copied game file (recursive) and
// report the dossier size, so one glance at stdout shows the handoff is whole.
function countCopiedGameFiles(dir: string): number {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    total += entry.isDirectory() ? countCopiedGameFiles(join(dir, entry.name)) : 1;
  }
  return total;
}
const handedInGameFiles = countCopiedGameFiles(join(out, 'game'));
const dossierSizeBytes = statSync(join(out, 'dossier.json')).size;
console.log(`Lorong Senja: handed in ${handedInGameFiles} game files, dossier.json is ${dossierSizeBytes} bytes.`);

// Post-write validation: the dossier must be valid JSON and carry the
// screenshots the judge reads (buildDossier lists them under "images");
// fail loudly instead of handing in a broken entry.
const dossierRawText = readFileSync(join(out, 'dossier.json'), 'utf8');
const dossierParsed = JSON.parse(dossierRawText) as Record<string, unknown>;
if (
  !dossierParsed ||
  typeof dossierParsed !== 'object' ||
  !Array.isArray(dossierParsed.images) ||
  dossierParsed.images.length === 0
) {
  throw new Error('Lorong Senja: dossier.json has no screenshots under "images" — the handoff is incomplete.');
}
console.log(`Lorong Senja: dossier.json validated (${dossierParsed.images.length} screenshots listed).`);

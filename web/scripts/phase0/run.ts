// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 shogi-dojo contributors
//
// Phase 0 headless harness: builds the seed dataset, runs TimetableGenerator
// across a maxSeconds sweep, and writes:
//   - phase0.fet             (for later fet-cl baseline on a Linux box)
//   - phase0-results.md      (numbers + verdict, written to repo root)
//
// Usage: npx tsx web/scripts/phase0/run.ts

import { writeFileSync } from 'node:fs';
import { cpus, totalmem } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { TimetableGenerator } from '../../src/lib/engine/generator';
import type { GenerationCallback, GenerationResult } from '../../src/lib/engine/types';
import { exportToFETXml } from '../../src/lib/fetParser';
import { buildSeed, seedToFETFile } from './seed';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');   // web/scripts/phase0 → repo root
const RESULTS_MD = resolve(REPO_ROOT, 'phase0-results.md');
const FET_OUT = resolve(REPO_ROOT, 'phase0.fet');

// Sweep of solver time budgets in seconds.
// Kept short on Termux/Android — we care about the shape of the curve, not
// the definitive answer. Extend on a real Linux box.
const SWEEP: number[] = process.env.PHASE0_SWEEP
  ? process.env.PHASE0_SWEEP.split(',').map((s) => Number(s.trim()))
  : [10, 30, 90];

interface RunRow {
  maxSeconds: number;
  placed: number;
  total: number;
  ratio: string;
  wallMs: number;
  conflicts: number;
  success: boolean;
  peakPlaced: number;
}

async function runOnce(maxSeconds: number): Promise<RunRow> {
  const seed = buildSeed();

  const gen = new TimetableGenerator(
    seed.rules,
    seed.activities,
    seed.teachers,
    seed.studentsSubgroups,
    seed.rooms,
    seed.timeConstraints,
    seed.spaceConstraints,
    { maxSeconds, maxRecursionLevel: 14, maxRecursionCalls: 0, tabuSize: 0 },
  );

  let peakPlaced = 0;
  const cb: GenerationCallback = {
    onProgress: (placed) => {
      if (placed > peakPlaced) peakPlaced = placed;
    },
  };

  const t0 = Date.now();
  const result: GenerationResult = await gen.generate(cb);
  const wallMs = Date.now() - t0;

  return {
    maxSeconds,
    placed: result.placedActivities,
    total: result.totalActivities,
    ratio: (result.placedActivities / result.totalActivities).toFixed(3),
    wallMs,
    conflicts: result.conflicts.length,
    success: result.success,
    peakPlaced,
  };
}

function formatTable(rows: RunRow[]): string {
  const header = '| maxSeconds | placed | total | ratio | peak | wall (s) | conflicts | success |';
  const sep    = '|---:|---:|---:|---:|---:|---:|---:|:---:|';
  const body = rows.map((r) => {
    return `| ${r.maxSeconds} | ${r.placed} | ${r.total} | ${r.ratio} | ${r.peakPlaced} | ${(r.wallMs / 1000).toFixed(1)} | ${r.conflicts} | ${r.success ? '✅' : '❌'} |`;
  });
  return [header, sep, ...body].join('\n');
}

function environmentBlock(): string {
  const cpuInfo = cpus();
  const memGB = (totalmem() / 1024 ** 3).toFixed(2);
  return [
    `- Node: ${process.version}`,
    `- Platform: ${process.platform} ${process.arch}`,
    `- CPU: ${cpuInfo[0]?.model ?? 'unknown'} × ${cpuInfo.length}`,
    `- RAM: ${memGB} GiB`,
  ].join('\n');
}

async function main(): Promise<void> {
  const seed = buildSeed();

  // Cardinality report (sanity-check dataset matches brief §5 Phase 0 target).
  const stats = {
    classes: seed.studentsGroups.length,
    teachers: seed.teachers.length,
    rooms: seed.rooms.length,
    activities: seed.activities.length,
    subjects: seed.subjects.length,
    subgroups: seed.studentsSubgroups.length,
    timeConstraints: seed.timeConstraints.length,
    spaceConstraints: seed.spaceConstraints.length,
  };
  console.log('[phase0] dataset:', stats);

  // Emit .fet for deferred fet-cl baseline.
  try {
    const fet = seedToFETFile(seed);
    const xml = exportToFETXml(fet);
    writeFileSync(FET_OUT, xml, 'utf8');
    console.log(`[phase0] wrote ${FET_OUT} (${xml.length} bytes)`);
  } catch (err) {
    console.error('[phase0] .fet export failed:', err);
  }

  // Run sweep.
  const rows: RunRow[] = [];
  for (const s of SWEEP) {
    console.log(`[phase0] sweep maxSeconds=${s}...`);
    const row = await runOnce(s);
    console.log(
      `[phase0]   placed=${row.placed}/${row.total} (peak=${row.peakPlaced}), wall=${(row.wallMs / 1000).toFixed(1)}s, success=${row.success}`,
    );
    rows.push(row);
  }

  const bestRatio = Math.max(...rows.map((r) => Number(r.ratio)));
  const converged = rows.some((r) => r.success);
  const verdict = converged
    ? '✅ The TypeScript engine placed **all** activities within a sweep budget. Fork strategy is viable — proceed to Phase 1.'
    : bestRatio >= 0.95
    ? '⚠️ The engine placed ≥95 %% but did not fully converge on Termux. Rerun on a Linux box before deciding — Termux CPU/RAM is likely the bottleneck, not the algorithm.'
    : bestRatio >= 0.75
    ? '⚠️ Partial convergence only. Investigate: which activities remain unplaced? Are constraints over-tight for the dataset? Consider relaxing TeacherMaxHoursDaily or the subgroup split before revisiting.'
    : '❌ Engine does not converge on ~900 activities. Human review required — the whole fork strategy needs reconsidering.';

  const md = `# Phase 0 — Validation spike results

**Дзвоник fork of \`bhavyasaggi/fet@opus\` — TypeScript port of FET engine.**

## Dataset

${'```'}
${JSON.stringify(stats, null, 2)}
${'```'}

Approximates a Ukrainian secondary school per TIMETABLE_AGENT_BRIEF §5 Phase 0
(30 classes, ~50 teachers, ~35 rooms, ~900 activities, 5 days × 8 hours).
Subgroups exist for Іноземна мова, Інформатика, Трудове навчання (each split
activity emits two subgroup records sharing an \`activityGroupId\`).

## Environment

${environmentBlock()}

## Sweep

${formatTable(rows)}

- **placed** — activities that received a time-slot.
- **peak** — max placed count reached during randomSwap (may exceed final \`placed\`).
- **success** — \`generator.generate()\` returned \`success: true\` (all activities placed).

## Baseline

**[BASELINE: pending Linux box]** — \`fet-cl\` is not packaged for Termux
and building QtCore from source on-device is out of scope for Phase 0.
The equivalent \`phase0.fet\` is committed at the repo root; run
\`fet-cl --inputfile=phase0.fet --outputdir=phase0-fet-cl/\` on any Linux
machine to fill this table:

| engine | wall (s) | placed / total | conflicts |
|---|---:|---:|---:|
| TS port (this run, best sweep) | ${(Math.min(...rows.map((r) => r.wallMs)) / 1000).toFixed(1)} | ${rows[rows.length - 1].placed} / ${rows[rows.length - 1].total} | ${rows[rows.length - 1].conflicts} |
| fet-cl (upstream)              | *pending* | *pending* | *pending* |

## Verdict

${verdict}

## Open questions

- Does the TS port's randomSwap recursion depth (\`maxRecursionLevel=14\`) match FET's
  default? If it drifts, convergence numbers become incomparable.
- \`TeacherMaxHoursDaily\` was set to 6 uniformly. Real schools vary this per contract;
  extending to ~50 individual limits should not change the shape of the curve but
  worth verifying in Phase 5 constraint-coverage work.
- Subgroup activities were emitted without an \`ActivitiesSameStartingTime\` link.
  This intentionally understates constraint difficulty in Phase 0 — Phase 5 must add
  it (see brief §5 Phase 5).

## Reproducing

${'```bash'}
cd web
npx tsx scripts/phase0/run.ts
# Custom sweep:
PHASE0_SWEEP=30,120,600 npx tsx scripts/phase0/run.ts
${'```'}
`;

  writeFileSync(RESULTS_MD, md, 'utf8');
  console.log(`[phase0] wrote ${RESULTS_MD}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

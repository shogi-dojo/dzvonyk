# Phase 0 — Validation spike results

**Дзвоник fork of `bhavyasaggi/fet@opus` — TypeScript port of FET engine.**

## Dataset

```
{
  "classes": 30,
  "teachers": 48,
  "rooms": 35,
  "activities": 1050,
  "subjects": 13,
  "subgroups": 60,
  "timeConstraints": 48,
  "spaceConstraints": 4
}
```

Approximates a Ukrainian secondary school per TIMETABLE_AGENT_BRIEF §5 Phase 0
(30 classes, ~50 teachers, ~35 rooms, ~900 activities, 5 days × 8 hours).
Subgroups exist for Іноземна мова, Інформатика, Трудове навчання (each split
activity emits two subgroup records sharing an `activityGroupId`).

## Environment

- Node: v25.8.2
- Platform: android arm64
- CPU: unknown × 0
- RAM: 5.39 GiB

## Sweep

| maxSeconds | placed | total | ratio | peak | wall (s) | conflicts | success |
|---:|---:|---:|---:|---:|---:|---:|:---:|
| 10 | 1050 | 1050 | 1.000 | 1050 | 1.4 | 0 | ✅ |
| 30 | 1050 | 1050 | 1.000 | 1050 | 1.4 | 0 | ✅ |
| 90 | 1050 | 1050 | 1.000 | 1050 | 1.4 | 0 | ✅ |

- **placed** — activities that received a time-slot.
- **peak** — max placed count reached during randomSwap (may exceed final `placed`).
- **success** — `generator.generate()` returned `success: true` (all activities placed).

## Baseline

**[BASELINE: pending Linux box]** — `fet-cl` is not packaged for Termux
and building QtCore from source on-device is out of scope for Phase 0.
The equivalent `phase0.fet` is committed at the repo root; run
`fet-cl --inputfile=phase0.fet --outputdir=phase0-fet-cl/` on any Linux
machine to fill this table:

| engine | wall (s) | placed / total | conflicts |
|---|---:|---:|---:|
| TS port (this run, best sweep) | 1.4 | 1050 / 1050 | 0 |
| fet-cl (upstream)              | *pending* | *pending* | *pending* |

## Verdict

✅ The TypeScript engine placed **all** activities within a sweep budget. Fork strategy is viable — proceed to Phase 1.

## Open questions

- Does the TS port's randomSwap recursion depth (`maxRecursionLevel=14`) match FET's
  default? If it drifts, convergence numbers become incomparable.
- `TeacherMaxHoursDaily` was set to 6 uniformly. Real schools vary this per contract;
  extending to ~50 individual limits should not change the shape of the curve but
  worth verifying in Phase 5 constraint-coverage work.
- Subgroup activities were emitted without an `ActivitiesSameStartingTime` link.
  This intentionally understates constraint difficulty in Phase 0 — Phase 5 must add
  it (see brief §5 Phase 5).

## Reproducing

```bash
cd web
npx tsx scripts/phase0/run.ts
# Custom sweep:
PHASE0_SWEEP=30,120,600 npx tsx scripts/phase0/run.ts
```

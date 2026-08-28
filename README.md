# Дзвоник

**Дзвоник** (`dzvonyk` — Ukrainian for *school bell*) is an offline-capable
timetabling tool for Ukrainian schools. It targets the завуч (deputy head) who
needs to produce a working sitka hodyn (сітка годин) without expensive
proprietary software.

The scheduling engine is a TypeScript port of the well-known open-source engine
**FET** (Free Timetabling Software) by Liviu Lalescu and Volker Dirr. The port
was written by bhavyasaggi on branch `opus` of
[bhavyasaggi/fet](https://github.com/bhavyasaggi/fet); Дзвоник adapts it for
Ukrainian schools (localisation, sanitary-regulation preset, pre-flight
validation, background solver, print layouts).

## Status

Bootstrapped — Phase 0 (validation spike) is under way.
See `phase0-results.md` (added when the spike completes) for engine numbers on
a realistic Ukrainian dataset (30 classes, ~50 teachers, ~35 rooms,
~900 activities).

## Getting the app running

```bash
cd web
npm install
npm run dev
```

Requires Node ≥ 18. Everything else is documented in `web/README.md`.

## Licence

Дзвоник is licensed under the **GNU Affero General Public License v3.0 or
later** (AGPL-3.0-or-later). See `LICENSE` for the full text and `NOTICE.md`
for the derivation chain and attribution.

If you interact with a hosted instance of Дзвоник, you are entitled under
AGPL §13 to the complete source of the running version. That source is public
here:

**Вихідний код (source code):** https://github.com/shogi-dojo/dzvonyk

## Non-goals

- Not writing a new scheduling solver.
- Not porting FET's GUI or its constraint taxonomy verbatim.
- No backend, no accounts, no cloud sync. Local-first is deliberate.
- No relicensing away from AGPL.

## Credits

- **FET** — Liviu Lalescu, Volker Dirr, and contributors listed in `AUTHORS` /
  `CONTRIBUTORS` / `THANKS` / `TRANSLATORS`.
- **TypeScript port** — bhavyasaggi (branch `opus`).
- **Ukrainian adaptation** — shogi-dojo contributors.

# NOTICE

**Дзвоник** (`dzvonyk`) — Ukrainian school timetabling tool.
Licensed under **GNU Affero General Public License v3.0 or later (AGPL-3.0-or-later)**.
See `LICENSE` (identical to `COPYING`) for the full text.

## Derivation chain

```
FET — Free Timetabling Software (AGPL-3.0-or-later)
      Liviu Lalescu, Volker Dirr, et al.
      https://lalescu.ro/liviu/fet/
  └── bhavyasaggi/fet @ branch `opus`
        TypeScript port of FET's engine (no explicit license file on `opus`)
        https://github.com/bhavyasaggi/fet/tree/opus
        └── shogi-dojo/dzvonyk (this project)
              Adapts the port for Ukrainian schools (see README).
              https://github.com/shogi-dojo/dzvonyk
```

Because the upstream port is a derivative of AGPL-licensed FET source, the only
defensible license for downstream work is **AGPL-3.0-or-later**. This is not a
decision to be revisited by an automated agent.

## Attribution

- FET core algorithm and constraint model: Liviu Lalescu, Volker Dirr, and FET
  contributors listed in `AUTHORS`, `CONTRIBUTORS`, `THANKS`, `TRANSLATORS`.
- TypeScript port of FET's engine (`web/src/lib/engine/*`, `web/src/lib/fetParser.ts`, etc.):
  bhavyasaggi (https://github.com/bhavyasaggi), commits `init`, `+web`, `+cohesion`
  on branch `opus`.
- Ukrainian-school adaptation (Дзвоник): shogi-dojo (this repository), from
  commit `feat/phase0-validation` onward.

Do **not** rename the upstream project in prose or branding; refer to it as
"FET" and to bhavyasaggi's port as "bhavyasaggi/fet @ opus". "Дзвоник" is the
name of this fork only.

## Files authored in this fork

New source files authored by shogi-dojo carry an SPDX header:

```
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 shogi-dojo contributors
```

Upstream files are not modified for licensing metadata; their existing headers
(or absence thereof) stand.

## AGPL §13 (network use)

If Дзвоник is ever served over a network, users interacting with it MUST be
offered the complete corresponding source. A persistent "Вихідний код" link
in the UI footer, pointing at https://github.com/shogi-dojo/dzvonyk, is the
mechanism by which this obligation is satisfied. Do not remove it.

Desktop-only / offline PWA builds do not by themselves trigger §13, but any
distribution of binaries still requires source availability under §6.

## Prohibited without explicit human approval

- Relicensing under any non-AGPL-compatible license.
- Adding a CLA (Contributor License Agreement).
- Removing or altering copyright / license headers on upstream files.
- Shipping a closed-source build.

## Open item — TODO for a human, not the agent

Upstream `bhavyasaggi/fet` @ `opus` carries no explicit `LICENSE` file. This
fork proceeds on the only defensible reading (AGPL, inherited from FET), but
before any tagged public release we should:

1. Open a courteous issue on `bhavyasaggi/fet` asking for an explicit license
   declaration on `opus`.
2. Record the outcome (issue URL, response, resolved license text) in this
   `NOTICE.md`.

This step is **deferred** to a human maintainer — the agent will not open the
upstream issue autonomously.

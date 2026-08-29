// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 shogi-dojo contributors
//
// Phase 2: pre-flight validation. Pure arithmetic over the current dataset,
// runs in milliseconds before the solver starts. Purpose is to catch
// impossible input (e.g. a class needing 45 lessons in a 40-slot week) and
// tell the завуч in plain Ukrainian *which entity* is the problem — instead
// of letting the solver spin for minutes and give up with no explanation.
//
// Optional Phase 4 layer (МОЗ №2205, 2020) is applied when input.sanitaryMode
// is true — see sanitary.ts. Those checks are warnings only, not blockers.

import type {
  Activity, Teacher, Room, TimeConstraint, SpaceConstraint,
  TimetableRules, StudentsGroup, StudentsSubgroup,
} from '../../types';
import { runSanitaryChecks } from './sanitary';

export type IssueSeverity = 'blocking' | 'warning';

export interface PreflightIssue {
  code: string;                   // stable machine-readable id (i18n key later)
  severity: IssueSeverity;
  entity?: { kind: string; id: string; name: string };
  message: string;                // Ukrainian, ready for the UI
}

export interface PreflightResult {
  blocking: PreflightIssue[];
  warnings: PreflightIssue[];
  ok: boolean;                    // shortcut: blocking.length === 0
}

export interface PreflightInput {
  rules: TimetableRules | null;
  activities: Activity[];
  teachers: Teacher[];
  rooms: Room[];
  studentsGroups: StudentsGroup[];
  studentsSubgroups: StudentsSubgroup[];
  timeConstraints: TimeConstraint[];
  spaceConstraints: SpaceConstraint[];
  // Phase 4: when true, also apply МОЗ №2205 (2020) weekly-load limits as
  // warnings. Opt-in via the "Дотримуватись санітарних норм" toggle in Settings.
  sanitaryMode?: boolean;
}

// Threshold at which "close to capacity" becomes a warning even without
// exceeding it. 90 % load is where FET's heuristic starts to struggle.
const WARN_LOAD_RATIO = 0.9;

export function runPreflight(input: PreflightInput): PreflightResult {
  const blocking: PreflightIssue[] = [];
  const warnings: PreflightIssue[] = [];

  const { rules, activities, teachers, rooms, studentsGroups, studentsSubgroups,
    timeConstraints, spaceConstraints } = input;

  // ---- Rules present ----
  if (!rules) {
    blocking.push({
      code: 'RULES_MISSING',
      severity: 'blocking',
      message: 'Не задано параметри розкладу. Відкрийте розділ «Налаштування» і задайте кількість днів та годин на день.',
    });
    return { blocking, warnings, ok: false };
  }

  const nDays = rules.nDaysPerWeek;
  const nHours = rules.nHoursPerDay;
  const weeklySlots = nDays * nHours;

  if (weeklySlots <= 0) {
    blocking.push({
      code: 'RULES_ZERO_SLOTS',
      severity: 'blocking',
      message: `У тижні ${weeklySlots} годин. Задайте додатні значення днів на тиждень і годин на день у «Налаштуваннях».`,
    });
    return { blocking, warnings, ok: false };
  }

  const active = activities.filter((a) => a.active);

  // ---- Zero activities ----
  if (active.length === 0) {
    blocking.push({
      code: 'NO_ACTIVITIES',
      severity: 'blocking',
      message: 'Немає жодного активного уроку. Додайте уроки перед генерацією розкладу.',
    });
    return { blocking, warnings, ok: false };
  }

  // ---- Not-available slots per teacher (from TeacherNotAvailableTimes) ----
  const teacherUnavail = new Map<string, number>();
  for (const c of timeConstraints) {
    if (!c.active) continue;
    const raw = c as unknown as { type: string; teacherId?: string; times?: unknown[] };
    if (raw.type === 'TeacherNotAvailableTimes' && raw.teacherId && Array.isArray(raw.times)) {
      const tMatch = teachers.find((t) => t.id === raw.teacherId || t.name === raw.teacherId);
      if (tMatch) {
        teacherUnavail.set(tMatch.id, (teacherUnavail.get(tMatch.id) ?? 0) + raw.times.length);
        teacherUnavail.set(tMatch.name, (teacherUnavail.get(tMatch.name) ?? 0) + raw.times.length);
      } else {
        teacherUnavail.set(raw.teacherId, (teacherUnavail.get(raw.teacherId) ?? 0) + raw.times.length);
      }
    }
  }

  // Room-not-available (from RoomNotAvailableTimes) — reduces per-room capacity.
  const roomUnavail = new Map<string, number>();
  for (const c of spaceConstraints) {
    if (!c.active) continue;
    const raw = c as unknown as { type: string; roomId?: string; times?: unknown[] };
    if (raw.type === 'RoomNotAvailableTimes' && raw.roomId && Array.isArray(raw.times)) {
      roomUnavail.set(raw.roomId, (roomUnavail.get(raw.roomId) ?? 0) + raw.times.length);
    }
  }

  // ---- Per-class load ----
  // For each class (StudentsGroup), sum durations of activities that include it
  // (directly OR via one of its subgroups). Compare to weeklySlots.
  const groupById = new Map(studentsGroups.map((g) => [g.id, g]));
  const subgroupToGroup = new Map<string, string>();  // subgroupId → parent groupId
  for (const g of studentsGroups) {
    for (const sgId of g.subgroups) subgroupToGroup.set(sgId, g.id);
  }

  // Activities affecting a class = activities directly on group + one of the
  // subgroup activities per activityGroupId (split subjects). We conservatively
  // count subgroup-parallel slots once per activityGroupId (since both
  // subgroups occupy the same time slot in a coordinated timetable).
  const perClassLoad = new Map<string, number>();
  const seenGroupIdForClass = new Map<string, Set<number>>();  // classId → set<activityGroupId>

  for (const a of active) {
    const affectedGroups = new Set<string>();
    for (const setId of a.studentSetIds) {
      if (groupById.has(setId)) affectedGroups.add(setId);
      else {
        const parent = subgroupToGroup.get(setId);
        if (parent) affectedGroups.add(parent);
      }
    }
    for (const gid of affectedGroups) {
      if (a.activityGroupId > 0) {
        const seen = seenGroupIdForClass.get(gid) ?? new Set<number>();
        if (seen.has(a.activityGroupId)) continue;   // already counted the parallel subgroup activity
        seen.add(a.activityGroupId);
        seenGroupIdForClass.set(gid, seen);
      }
      perClassLoad.set(gid, (perClassLoad.get(gid) ?? 0) + a.duration);
    }
  }

  for (const [gid, load] of perClassLoad) {
    const g = groupById.get(gid);
    if (!g) continue;
    if (load > weeklySlots) {
      blocking.push({
        code: 'CLASS_OVERLOAD',
        severity: 'blocking',
        entity: { kind: 'class', id: g.id, name: g.name },
        message: `Клас ${g.name}: заплановано ${load} уроків на тиждень, а в розкладі лише ${weeklySlots} слотів (${nDays} × ${nHours}). Приберіть ${load - weeklySlots} урок(и) або збільште кількість годин на день.`,
      });
    } else if (load / weeklySlots >= WARN_LOAD_RATIO) {
      warnings.push({
        code: 'CLASS_NEAR_CAPACITY',
        severity: 'warning',
        entity: { kind: 'class', id: g.id, name: g.name },
        message: `Клас ${g.name} завантажено на ${Math.round((load / weeklySlots) * 100)} % (${load}/${weeklySlots}). Мало простору для маневру — можливі складнощі з генерацією.`,
      });
    }
  }

  // ---- Per-teacher load ----
  const perTeacherLoad = new Map<string, number>();
  for (const a of active) {
    for (const tid of a.teacherIds) {
      perTeacherLoad.set(tid, (perTeacherLoad.get(tid) ?? 0) + a.duration);
    }
  }
  const teacherById = new Map(teachers.map((t) => [t.id, t]));

  for (const [tid, load] of perTeacherLoad) {
    const t = teacherById.get(tid);
    const name = t?.name ?? tid;
    const unavail = teacherUnavail.get(tid) ?? 0;
    const available = weeklySlots - unavail;
    if (available <= 0) {
      blocking.push({
        code: 'TEACHER_NO_SLOTS',
        severity: 'blocking',
        entity: { kind: 'teacher', id: tid, name },
        message: `Вчитель ${name}: заявлено ${load} уроків, але всі слоти позначено як «недоступний». Перевірте обмеження «TeacherNotAvailableTimes».`,
      });
      continue;
    }
    if (load > available) {
      blocking.push({
        code: 'TEACHER_OVERLOAD',
        severity: 'blocking',
        entity: { kind: 'teacher', id: tid, name },
        message: `Вчитель ${name}: заплановано ${load} уроків, а доступно лише ${available} слотів (${weeklySlots} − ${unavail} недоступних). Зменште навантаження або перегляньте обмеження.`,
      });
    } else if (load / available >= WARN_LOAD_RATIO) {
      warnings.push({
        code: 'TEACHER_NEAR_CAPACITY',
        severity: 'warning',
        entity: { kind: 'teacher', id: tid, name },
        message: `Вчитель ${name}: навантаження ${load}/${available} (${Math.round((load / available) * 100)} %). Може бути важко скласти без «вікон».`,
      });
    }
  }

  // ---- Per-room supply vs demand (hard preferences only) ----
  // For each room referenced by a hard ActivityPreferredRoom / SubjectPreferredRoom
  // constraint, count how many activities depend on it, and compare to its
  // capacity (weeklySlots minus roomUnavail).
  const roomById = new Map(rooms.map((r) => [r.id, r]));
  const activityBySubject = new Map<string, Activity[]>();
  for (const a of active) {
    const list = activityBySubject.get(a.subjectId) ?? [];
    list.push(a);
    activityBySubject.set(a.subjectId, list);
  }
  const roomDemand = new Map<string, number>();
  const addDemand = (roomId: string, n: number) => {
    roomDemand.set(roomId, (roomDemand.get(roomId) ?? 0) + n);
  };
  for (const c of spaceConstraints) {
    if (!c.active) continue;
    const raw = c as unknown as { type: string; roomId?: string; subjectId?: string; activityId?: string };
    if (raw.type === 'ActivityPreferredRoom' && raw.roomId) {
      addDemand(raw.roomId, 1);
    } else if (raw.type === 'SubjectPreferredRoom' && raw.roomId && raw.subjectId) {
      const acts = activityBySubject.get(raw.subjectId) ?? [];
      addDemand(raw.roomId, acts.reduce((s, a) => s + a.duration, 0));
    }
    // ActivityPreferredRooms / SubjectPreferredRooms are soft (multi-room),
    // skip — they cannot deterministically overload a single room.
  }
  for (const [rid, demand] of roomDemand) {
    const r = roomById.get(rid);
    const name = r?.name ?? rid;
    const supply = weeklySlots - (roomUnavail.get(rid) ?? 0);
    if (supply <= 0) {
      blocking.push({
        code: 'ROOM_NO_SLOTS',
        severity: 'blocking',
        entity: { kind: 'room', id: rid, name },
        message: `Аудиторія ${name}: усі слоти позначено як недоступні, але на неї є жорсткі прив'язки уроків.`,
      });
      continue;
    }
    if (demand > supply) {
      blocking.push({
        code: 'ROOM_OVERLOAD',
        severity: 'blocking',
        entity: { kind: 'room', id: rid, name },
        message: `Аудиторія ${name}: жорстко закріплено ${demand} уроків, а вміщує лише ${supply}. Розширте перелік аудиторій для цього предмета або приберіть частину прив'язок.`,
      });
    } else if (demand / supply >= WARN_LOAD_RATIO) {
      warnings.push({
        code: 'ROOM_NEAR_CAPACITY',
        severity: 'warning',
        entity: { kind: 'room', id: rid, name },
        message: `Аудиторія ${name}: заповнення ${demand}/${supply} (${Math.round((demand / supply) * 100)} %).`,
      });
    }
  }

  // ---- Orphaned split-subject subgroup ----
  // Every activity with activityGroupId > 0 must have at least one paired
  // sibling (same activityGroupId, different subgroup). Otherwise the split
  // is meaningless and the solver may still schedule it but the user's intent
  // is lost — warning, not blocker.
  const bySplitGroup = new Map<number, Activity[]>();
  for (const a of active) {
    if (a.activityGroupId > 0) {
      const list = bySplitGroup.get(a.activityGroupId) ?? [];
      list.push(a);
      bySplitGroup.set(a.activityGroupId, list);
    }
  }
  for (const [gid, list] of bySplitGroup) {
    if (list.length < 2) {
      warnings.push({
        code: 'SPLIT_ORPHAN',
        severity: 'warning',
        message: `Знайдено «розщеплений» урок (activityGroupId=${gid}) без пари для другої підгрупи. Перевірте, чи створено обидві підгрупи для цього предмета.`,
      });
    }
  }
  void studentsSubgroups; // reserved for future subgroup-pairing checks

  // ---- Phase 4: Санітарний регламент (opt-in) ----
  if (input.sanitaryMode) {
    warnings.push(...runSanitaryChecks({
      rules, activities: active, studentsGroups, studentsSubgroups,
    }));
  }

  return { blocking, warnings, ok: blocking.length === 0 };
}

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
  TimetableRules, StudentsGroup, StudentsSubgroup, StudentsYear,
} from '../../types';
import { runSanitaryChecks } from './sanitary';
import { sumWeeklyLoad, type WeeklyLoad } from '../weeklyLoad';

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
  studentsYears?: StudentsYear[];
  timeConstraints: TimeConstraint[];
  spaceConstraints: SpaceConstraint[];
  // Phase 4: when true, also apply МОЗ №2205 (2020) weekly-load limits as
  // warnings. Opt-in via the "Дотримуватись санітарних норм" toggle in Settings.
  sanitaryMode?: boolean;
}

// Threshold at which "close to capacity" becomes a warning even without
// exceeding it. 90 % load is where FET's heuristic starts to struggle.
const WARN_LOAD_RATIO = 0.9;

/**
 * Assigned weekly load per teacher, keyed by both teacher id and teacher name
 * (activities reference teachers either way).
 *
 * Split by week parity: a half-lesson counts towards only one of the two weeks,
 * so a teacher on 27 full hours plus one чисельник lesson reads 28/27, average
 * 27,5 — not a flat 28.
 */
export function calculateTeacherAssignedLoad(
  teachers: Teacher[],
  activities: Activity[]
): Map<string, WeeklyLoad> {
  const byTeacher = new Map<string, Activity[]>();
  const teacherByReference = new Map<string, Teacher>();
  for (const teacher of teachers) {
    teacherByReference.set(teacher.id, teacher);
    teacherByReference.set(teacher.name, teacher);
  }
  for (const activity of activities) {
    if (!activity.active) continue;
    for (const reference of activity.teacherIds) {
      const teacher = teacherByReference.get(reference);
      const id = teacher?.id || reference;
      const bucket = byTeacher.get(id);
      if (bucket) bucket.push(activity);
      else byTeacher.set(id, [activity]);
    }
  }

  const result = new Map<string, WeeklyLoad>();
  for (const [id, own] of byTeacher) {
    const load = sumWeeklyLoad(own);
    result.set(id, load);
    const teacher = teacherByReference.get(id);
    if (teacher) result.set(teacher.name, load);
  }
  return result;
}

/**
 * Assigned weekly load per students set, keyed by set id and by name.
 *
 * The завуч verifies that every class carries the hours its навчальний план
 * requires, and that the figure is the same every week — half-lessons are the
 * usual reason it is not.
 */
export function calculateStudentsAssignedLoad(
  activities: Activity[]
): Map<string, WeeklyLoad> {
  const bySet = new Map<string, Activity[]>();
  for (const activity of activities) {
    if (!activity.active) continue;
    for (const reference of activity.studentSetIds) {
      const bucket = bySet.get(reference);
      if (bucket) bucket.push(activity);
      else bySet.set(reference, [activity]);
    }
  }
  const result = new Map<string, WeeklyLoad>();
  for (const [id, own] of bySet) result.set(id, sumWeeklyLoad(own));
  return result;
}

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

  const nDays = rules.nDaysPerWeek || rules.daysOfTheWeek?.length || 5;
  const nHours = rules.nHoursPerDay || rules.hoursOfTheDay?.length || 8;
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
  const roomById = new Map(rooms.map((r) => [r.id, r]));
  const roomByName = new Map(rooms.map((r) => [r.name, r]));
  const resolveRoom = (idOrName?: string): Room | undefined => {
    if (!idOrName) return undefined;
    return roomById.get(idOrName) ?? roomByName.get(idOrName);
  };

  const roomUnavail = new Map<string, number>();
  for (const c of spaceConstraints) {
    if (!c.active) continue;
    const raw = c as unknown as { type: string; roomId?: string; times?: unknown[] };
    if (raw.type === 'RoomNotAvailableTimes' && raw.roomId && Array.isArray(raw.times)) {
      const r = resolveRoom(raw.roomId);
      const rid = r ? r.id : raw.roomId;
      roomUnavail.set(rid, (roomUnavail.get(rid) ?? 0) + raw.times.length);
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
  // Counted per week parity: a half-lesson occupies a slot in only one of the
  // two weeks, so capacity must be judged against the busier week.
  const perClassLoad = new Map<string, { numerator: number; denominator: number }>();
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
      const tally = perClassLoad.get(gid) ?? { numerator: 0, denominator: 0 };
      if (a.weekParity === 'numerator') tally.numerator += a.duration;
      else if (a.weekParity === 'denominator') tally.denominator += a.duration;
      else {
        tally.numerator += a.duration;
        tally.denominator += a.duration;
      }
      perClassLoad.set(gid, tally);
    }
  }

  for (const [gid, tally] of perClassLoad) {
    const g = groupById.get(gid);
    if (!g) continue;
    const load = Math.max(tally.numerator, tally.denominator);
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
  const perTeacherLoad = calculateTeacherAssignedLoad(teachers, active);
  const teacherById = new Map(teachers.map((t) => [t.id, t]));

  for (const [tid, weekly] of perTeacherLoad) {
    if (teachers.some((teacher) => teacher.name === tid && teacher.id !== tid)) continue;
    // Capacity has to hold in the busier week, so check the peak rather than
    // the average — a 28/27 teacher needs 28 free slots, not 27,5.
    const load = Math.max(weekly.numerator, weekly.denominator);
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

  // ---- Per-room supply vs demand ----
  // Hard pins (ActivityPreferredRoom) vs soft preferences (SubjectPreferredRoom).
  // ActivityPreferredRoom deterministically requires slots in a specific room,
  // so exceeding supply is a blocker (ROOM_OVERLOAD).
  // SubjectPreferredRoom is a soft preference (FET allows multiple classes to prefer
  // the same room and solver will use other rooms if overloaded), so it is a warning.
  const activityByIdOrFetId = new Map<string, Activity>();
  for (const a of active) {
    if (a.fetId) activityByIdOrFetId.set(a.fetId, a);
    activityByIdOrFetId.set(a.id, a);
  }

  const activityBySubject = new Map<string, Activity[]>();
  for (const a of active) {
    const list = activityBySubject.get(a.subjectId) ?? [];
    list.push(a);
    activityBySubject.set(a.subjectId, list);
  }

  const hardRoomDemand = new Map<string, number>();
  const subjectRoomDemand = new Map<string, number>();
  const addHardDemand = (roomId: string, n: number) => {
    hardRoomDemand.set(roomId, (hardRoomDemand.get(roomId) ?? 0) + n);
  };
  const addSubjectDemand = (roomId: string, n: number) => {
    subjectRoomDemand.set(roomId, (subjectRoomDemand.get(roomId) ?? 0) + n);
  };

  for (const c of spaceConstraints) {
    if (!c.active) continue;
    const raw = c as unknown as { type: string; roomId?: string; subjectId?: string; activityId?: string };
    if (raw.type === 'ActivityPreferredRoom' && raw.roomId) {
      const r = resolveRoom(raw.roomId);
      const rid = r ? r.id : raw.roomId;
      const act = raw.activityId ? activityByIdOrFetId.get(raw.activityId) : undefined;
      const duration = act ? act.duration : 1;
      addHardDemand(rid, duration);
    } else if (raw.type === 'SubjectPreferredRoom' && raw.roomId && raw.subjectId) {
      const r = resolveRoom(raw.roomId);
      const rid = r ? r.id : raw.roomId;
      const acts = activityBySubject.get(raw.subjectId) ?? [];
      const totalDuration = acts.reduce((s, a) => s + a.duration, 0);
      addSubjectDemand(rid, totalDuration);
    }
  }

  const allDemandedRooms = new Set<string>([
    ...hardRoomDemand.keys(),
    ...subjectRoomDemand.keys(),
  ]);

  for (const rid of allDemandedRooms) {
    const r = resolveRoom(rid);
    const name = r?.name ?? rid;
    const id = r?.id ?? rid;
    const supply = weeklySlots - (roomUnavail.get(id) ?? 0);
    const hard = hardRoomDemand.get(id) ?? 0;
    const soft = subjectRoomDemand.get(id) ?? 0;
    const total = hard + soft;

    if (supply <= 0) {
      if (hard > 0) {
        blocking.push({
          code: 'ROOM_NO_SLOTS',
          severity: 'blocking',
          entity: { kind: 'room', id, name },
          message: `Аудиторія ${name}: усі слоти позначено як недоступні, але на неї є жорсткі прив'язки уроків.`,
        });
      } else if (soft > 0) {
        warnings.push({
          code: 'ROOM_NO_SLOTS',
          severity: 'warning',
          entity: { kind: 'room', id, name },
          message: `Аудиторія ${name}: усі слоти позначено як недоступні, але для неї є побажання за предметом.`,
        });
      }
      continue;
    }

    if (hard > supply) {
      blocking.push({
        code: 'ROOM_OVERLOAD',
        severity: 'blocking',
        entity: { kind: 'room', id, name },
        message: `Аудиторія ${name}: жорстко закріплено ${hard} уроків, а вміщує лише ${supply}. Розширте перелік аудиторій для цього предмета або приберіть частину прив'язок.`,
      });
    } else if (hard / supply >= WARN_LOAD_RATIO || total / supply >= WARN_LOAD_RATIO) {
      const demand = hard > 0 && hard / supply >= WARN_LOAD_RATIO ? hard : total;
      warnings.push({
        code: 'ROOM_NEAR_CAPACITY',
        severity: 'warning',
        entity: { kind: 'room', id, name },
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

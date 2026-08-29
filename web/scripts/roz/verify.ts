#!/usr/bin/env tsx
/**
 * aSc .roz verification script
 * Validates parser against an actual .roz file and checks data integrity invariants
 *
 * Usage:
 *   npx tsx scripts/roz/verify.ts <path-to-roz-file>
 */

import fs from 'fs';
import path from 'path';
import { parseROZFile } from '../../src/lib/rozParser';

function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: npx tsx scripts/roz/verify.ts <path-to-file.roz>');
    process.exit(1);
  }

  const resolvedPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`File not found: ${resolvedPath}`);
    process.exit(1);
  }

  const buffer = fs.readFileSync(resolvedPath);
  const result = parseROZFile(buffer);
  const { report, file, placements, shifts } = result;

  console.log(`school   : ${report.schoolName} · ${report.year}`);
  console.log(
    `counts   : classes ${report.counts.classes} · subgroups ${report.counts.subgroups} · ` +
      `teachers ${report.counts.teachers} · subjects ${report.counts.subjects} · rooms ${file.rooms.length}`
  );
  console.log(
    `lessons  : ${report.counts.lessons} · hours ${report.counts.hours} · ` +
      `activities ${file.activities.length} · placements ${placements.length}`
  );
  console.log(`unplaced : ${report.unplacedHours} hours`);

  if (shifts) {
    console.log(
      `shifts   : 1 → periods ${shifts.shift1.firstHour + 1}..${shifts.shift1.lastHour + 1}, ` +
        `2 → periods ${shifts.shift2.firstHour + 1}..${shifts.shift2.lastHour + 1}`
    );
  } else {
    console.log('shifts   : none detected');
  }

  // Check teacher double bookings
  const actMap = new Map(file.activities.map((a) => [a.id, a]));
  const teacherSlots = new Map<string, string[]>();

  for (const pl of placements) {
    const act = actMap.get(pl.activityId);
    if (!act) continue;
    for (const tId of act.teacherIds) {
      const key = `${tId}|${pl.day}|${pl.hour}`;
      const list = teacherSlots.get(key) || [];
      list.push(act.id);
      teacherSlots.set(key, list);
    }
  }

  let doubleBookings = 0;
  for (const [key, acts] of teacherSlots.entries()) {
    if (acts.length > 1) {
      doubleBookings += acts.length - 1;
      const [tId, day, hour] = key.split('|');
      console.log(`double booking: teacher ${tId} on day ${day}, hour ${hour} (${acts.length} activities)`);
    }
  }
  console.log(`teacher double-bookings: ${doubleBookings}`);

  // Invariants checking
  const errors: string[] = [];

  if (report.counts.classes === 0) errors.push('No classes parsed');
  if (report.counts.teachers === 0) errors.push('No teachers parsed');
  if (report.counts.subjects === 0) errors.push('No subjects parsed');
  if (report.counts.lessons === 0) errors.push('No lessons parsed');
  if (report.counts.hours !== file.activities.length) {
    errors.push(`Activities count (${file.activities.length}) does not match total hours (${report.counts.hours})`);
  }
  if (report.counts.hours !== placements.length + report.unplacedHours) {
    errors.push(
      `Placements (${placements.length}) + unplaced hours (${report.unplacedHours}) !== total hours (${report.counts.hours})`
    );
  }

  // If this is the reference Gymnasium 131 file, verify exact invariants
  if (report.schoolName.includes('131')) {
    if (report.counts.classes !== 25) errors.push(`Expected 25 classes, got ${report.counts.classes}`);
    if (report.counts.teachers !== 31) errors.push(`Expected 31 teachers, got ${report.counts.teachers}`);
    if (report.counts.subjects !== 20) errors.push(`Expected 20 subjects, got ${report.counts.subjects}`);
    if (file.rooms.length !== 0) errors.push(`Expected 0 rooms, got ${file.rooms.length}`);
    if (report.counts.lessons !== 356) errors.push(`Expected 356 lessons, got ${report.counts.lessons}`);
    if (report.counts.hours !== 659) errors.push(`Expected 659 hours, got ${report.counts.hours}`);
    if (file.activities.length !== 659) errors.push(`Expected 659 activities, got ${file.activities.length}`);
    if (placements.length !== 657) errors.push(`Expected 657 placements, got ${placements.length}`);
    if (report.unplacedHours !== 2) errors.push(`Expected 2 unplaced hours, got ${report.unplacedHours}`);
    if (!shifts || shifts.shift1.firstHour !== 0 || shifts.shift1.lastHour !== 7) {
      errors.push(`Shift 1 mismatch: expected 0..7, got ${JSON.stringify(shifts?.shift1)}`);
    }
    if (!shifts || shifts.shift2.firstHour !== 1 || shifts.shift2.lastHour !== 8) {
      errors.push(`Shift 2 mismatch: expected 1..8, got ${JSON.stringify(shifts?.shift2)}`);
    }
    if (doubleBookings > 3) {
      errors.push(`Expected <= 3 teacher double-bookings, got ${doubleBookings}`);
    }
  }

  if (errors.length > 0) {
    console.error('\nVerification failed with errors:');
    for (const err of errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }

  console.log('\nVerification PASSED: All invariants satisfied.');
}

main();

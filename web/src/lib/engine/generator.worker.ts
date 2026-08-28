// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 shogi-dojo contributors
//
// Phase 1: TimetableGenerator runs inside a Web Worker so the UI thread stays
// responsive. Message protocol is typed via WorkerInMessage / WorkerOutMessage
// and shared with the caller (see Generate.tsx).

import type {
  Activity, Teacher, Room, TimeConstraint, SpaceConstraint,
  TimetableRules, StudentsSubgroup, StudentsGroup,
} from '../../types';
import type {
  GenerationConfig, GenerationResult, ConflictInfo,
} from './types';
import { TimetableGenerator } from './generator';

export interface WorkerStartPayload {
  rules: TimetableRules;
  activities: Activity[];
  teachers: Teacher[];
  subgroups: StudentsSubgroup[];
  studentsGroups?: StudentsGroup[];
  rooms: Room[];
  timeConstraints: TimeConstraint[];
  spaceConstraints: SpaceConstraint[];
  config?: Partial<GenerationConfig>;
}

export type WorkerInMessage =
  | { type: 'start'; payload: WorkerStartPayload }
  | { type: 'stop' };

export type WorkerOutMessage =
  | { type: 'progress'; placed: number; total: number }
  | { type: 'activityPlaced'; activityIndex: number; day: number; hour: number }
  | { type: 'conflict'; conflict: ConflictInfo }
  | { type: 'done'; result: GenerationResult }
  | { type: 'error'; message: string };

let currentGenerator: TimetableGenerator | null = null;
let stopRequested = false;

self.onmessage = async (event: MessageEvent<WorkerInMessage>) => {
  const msg = event.data;

  if (msg.type === 'stop') {
    stopRequested = true;
    currentGenerator?.stop();
    return;
  }

  if (msg.type === 'start') {
    stopRequested = false;
    const { rules, activities, teachers, subgroups, studentsGroups, rooms, timeConstraints, spaceConstraints, config } = msg.payload;

    try {
      currentGenerator = new TimetableGenerator(
        rules, activities, teachers, subgroups, rooms,
        timeConstraints, spaceConstraints, config,
        studentsGroups ?? [],
      );

      const result = await currentGenerator.generate({
        onProgress: (placed, total) => {
          post({ type: 'progress', placed, total });
        },
        onActivityPlaced: (activityIndex, day, hour) => {
          post({ type: 'activityPlaced', activityIndex, day, hour });
        },
        onConflict: (conflict) => {
          post({ type: 'conflict', conflict });
        },
        shouldStop: () => stopRequested,
      });

      post({ type: 'done', result });
    } catch (err) {
      post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      currentGenerator = null;
    }
  }
};

function post(msg: WorkerOutMessage): void {
  (self as unknown as Worker).postMessage(msg);
}

// Ensure Vite treats this as a module worker.
export {};

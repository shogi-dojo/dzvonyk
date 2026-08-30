import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db, GUEST_WORKSPACE_ID } from '@/db';
import { historyManager, MAX_HISTORY_ENTRIES } from './historyManager';
import { workspaceRepository } from '@/lib/workspace/workspaceRepository';
import { workspaceManager } from '@/lib/workspace/workspaceManager';
import type { Teacher, Subject } from '@/types';

const mockTeacher: Teacher = {
  id: 't-hist-1',
  name: 'Григорій Сковорода',
  targetNumberOfHours: 18,
  qualifiedSubjects: [],
};

const mockSubject: Subject = {
  id: 'sub-hist-1',
  name: 'Філософія',
};

describe('Persistent Undo and Redo Journal', () => {
  beforeEach(async () => {
    await db.clearAllData();
    await db.history.clear();
    await historyManager.init('test-ws');
    vi.restoreAllMocks();
  });

  it('records actions through workspaceRepository mutations into undo journal', async () => {
    expect(historyManager.canUndo()).toBe(false);
    expect(historyManager.canRedo()).toBe(false);

    // Save teacher
    await workspaceRepository.saveTeacher(mockTeacher);

    expect(historyManager.canUndo()).toBe(true);
    expect(historyManager.canRedo()).toBe(false);
    expect(historyManager.getUndoStack()).toHaveLength(1);
    expect(historyManager.getUndoStack()[0].description).toContain('Григорій Сковорода');
  });

  it('records direct Dexie mutations used by existing screens and marks the workspace dirty', async () => {
    const context = await workspaceManager.init();
    await historyManager.init(context.workspace.id);
    const beforeRevision = context.workspace.localRevision;

    await db.teachers.put(mockTeacher);

    expect(historyManager.canUndo()).toBe(true);
    expect(historyManager.getUndoStack()[0].description).toContain('Григорій Сковорода');
    await vi.waitFor(async () => {
      const workspace = await db.workspaces.get(GUEST_WORKSPACE_ID);
      expect(workspace?.localRevision).toBeGreaterThan(beforeRevision);
    });
  });

  it('performs undo and redo with database restoration', async () => {
    // 1. Add teacher
    await workspaceRepository.saveTeacher(mockTeacher);
    let teacherInDb = await db.teachers.get('t-hist-1');
    expect(teacherInDb).toBeDefined();

    // 2. Perform Undo
    const undoSuccess = await historyManager.undo();
    expect(undoSuccess).toBe(true);
    expect(historyManager.canUndo()).toBe(false);
    expect(historyManager.canRedo()).toBe(true);

    teacherInDb = await db.teachers.get('t-hist-1');
    expect(teacherInDb).toBeUndefined();

    // 3. Perform Redo
    const redoSuccess = await historyManager.redo();
    expect(redoSuccess).toBe(true);
    expect(historyManager.canUndo()).toBe(true);
    expect(historyManager.canRedo()).toBe(false);

    teacherInDb = await db.teachers.get('t-hist-1');
    expect(teacherInDb?.name).toBe('Григорій Сковорода');
  });

  it('invalidates and clears redo stack when a new mutation occurs', async () => {
    await workspaceRepository.saveTeacher(mockTeacher);
    await historyManager.undo();
    expect(historyManager.canRedo()).toBe(true);

    // Perform new mutation
    await workspaceRepository.saveSubject(mockSubject);

    expect(historyManager.canRedo()).toBe(false);
    expect(historyManager.getRedoStack()).toHaveLength(0);
  });

  it('caps history at MAX_HISTORY_ENTRIES (100) items and prunes oldest', async () => {
    for (let i = 0; i < 110; i++) {
      await historyManager.recordAction(
        `Action ${i}`,
        [{ table: 'teachers', key: `t-${i}`, prev: null, next: null }],
        [{ table: 'teachers', key: `t-${i}`, prev: null, next: null }]
      );
    }

    const undoStack = historyManager.getUndoStack();
    expect(undoStack.length).toBe(MAX_HISTORY_ENTRIES);
    expect(undoStack[0].description).toBe('Action 10');
    expect(undoStack[MAX_HISTORY_ENTRIES - 1].description).toBe('Action 109');
  });

  it('reverts multiple steps to a historical checkpoint', async () => {
    await workspaceRepository.saveTeacher(mockTeacher);
    await workspaceRepository.saveSubject(mockSubject);

    const stack = historyManager.getUndoStack();
    const firstCheckpointId = stack[0].id;

    await historyManager.revertTo(firstCheckpointId);

    // Subject should be reverted (removed), teacher remains
    const teacherInDb = await db.teachers.get('t-hist-1');
    const subjectInDb = await db.subjects.get('sub-hist-1');

    expect(teacherInDb).toBeDefined();
    expect(subjectInDb).toBeUndefined();
  });

  it('records multi-table cascading transactions as a single history entry', async () => {
    // 1. Initial teacher and 3 activities
    await db.teachers.put(mockTeacher);
    await db.activities.bulkAdd([
      { id: 'act-1', teacherIds: [mockTeacher.name], subjectId: 'Math', studentsGroupIds: ['1A'], duration: 1, totalHours: 1, active: true },
      { id: 'act-2', teacherIds: [mockTeacher.name], subjectId: 'Physics', studentsGroupIds: ['1B'], duration: 1, totalHours: 1, active: true },
      { id: 'act-3', teacherIds: [mockTeacher.name], subjectId: 'Chemistry', studentsGroupIds: ['1C'], duration: 1, totalHours: 1, active: true },
    ]);

    await historyManager.init('test-ws');
    const initialStackLength = historyManager.getUndoStack().length;

    // 2. Perform cascading rename inside a transaction
    await db.transaction('rw', [db.teachers, db.activities], async () => {
      await db.teachers.put({ ...mockTeacher, name: 'Іван Франко' });
      await db.activities.update('act-1', { teacherIds: ['Іван Франко'] });
      await db.activities.update('act-2', { teacherIds: ['Іван Франко'] });
      await db.activities.update('act-3', { teacherIds: ['Іван Франко'] });
    });

    const stack = historyManager.getUndoStack();
    // Exactly 1 new entry should have been created for the whole transaction!
    expect(stack.length).toBe(initialStackLength + 1);
    const lastEntry = stack[stack.length - 1];
    expect(lastEntry.description).toContain('Іван Франко');

    // 3. Undo should revert both teacher and all 3 activities in one single step
    await historyManager.undo();
    const teacher = await db.teachers.get(mockTeacher.id);
    expect(teacher?.name).toBe('Григорій Сковорода');

    const act1 = await db.activities.get('act-1');
    expect(act1?.teacherIds).toEqual(['Григорій Сковорода']);
  });
});

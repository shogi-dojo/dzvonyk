import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/db';
import { historyManager, MAX_HISTORY_ENTRIES } from './historyManager';
import { workspaceRepository } from '@/lib/workspace/workspaceRepository';
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
});

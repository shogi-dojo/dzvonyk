import { v4 as uuidv4 } from 'uuid';
import type { Table } from 'dexie';
import { db, GUEST_WORKSPACE_ID, type FETDatabase } from '@/db';
import type { HistoryEntry, EntityChange, WorkspaceSnapshotData } from '@/types';
import { workspaceRepository } from '@/lib/workspace/workspaceRepository';
import { trackEvent } from '@/lib/analytics';

export const MAX_HISTORY_ENTRIES = 100;
export const HISTORY_CHANGED_EVENT = 'dzvonyk_history_changed';

export class HistoryManager {
  private database: FETDatabase;
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private currentWorkspaceId: string = GUEST_WORKSPACE_ID;
  private isApplyingHistory = false;

  constructor(database: FETDatabase = db) {
    this.database = database;

    // Connect automatically to workspace repository mutations
    workspaceRepository.registerMutationHook(async (description, undoChanges, redoChanges) => {
      if (this.isApplyingHistory) return;
      await this.recordAction(description, undoChanges, redoChanges);
    });
  }

  /**
   * Initializes history for the active workspace from IndexedDB
   */
  async init(workspaceId: string = GUEST_WORKSPACE_ID): Promise<void> {
    this.currentWorkspaceId = workspaceId;
    this.redoStack = [];

    try {
      const persisted = await this.database.history
        .where('workspaceId')
        .equals(workspaceId)
        .sortBy('timestamp');

      this.undoStack = persisted.slice(-MAX_HISTORY_ENTRIES);
    } catch {
      this.undoStack = [];
    }

    this.notifyListeners();
  }

  /**
   * Records a new action into the undo journal
   */
  async recordAction(
    description: string,
    undoChanges: EntityChange<unknown>[],
    redoChanges: EntityChange<unknown>[]
  ): Promise<void> {
    if (!undoChanges.length && !redoChanges.length) return;

    const entry: HistoryEntry = {
      id: uuidv4(),
      workspaceId: this.currentWorkspaceId,
      timestamp: new Date().toISOString(),
      description,
      undoChanges,
      redoChanges,
    };

    this.undoStack.push(entry);
    // Any new action clears the redo stack
    this.redoStack = [];

    // Enforce 100 entries cap
    if (this.undoStack.length > MAX_HISTORY_ENTRIES) {
      const excess = this.undoStack.length - MAX_HISTORY_ENTRIES;
      const removed = this.undoStack.splice(0, excess);
      for (const item of removed) {
        await this.database.history.delete(item.id).catch(() => {});
      }
    }

    // Persist to Dexie
    await this.database.history.put(entry).catch(() => {});

    this.notifyListeners();
  }

  /**
   * Applies an undo operation
   */
  async undo(): Promise<boolean> {
    if (!this.canUndo()) return false;

    const entry = this.undoStack.pop()!;
    this.redoStack.push(entry);

    this.isApplyingHistory = true;
    try {
      await this.applyChanges(entry.undoChanges);
      await this.database.history.delete(entry.id).catch(() => {});
      trackEvent('undo_redo_invoked', { type: 'undo' });
    } finally {
      this.isApplyingHistory = false;
    }

    this.notifyListeners();
    return true;
  }

  /**
   * Applies a redo operation
   */
  async redo(): Promise<boolean> {
    if (!this.canRedo()) return false;

    const entry = this.redoStack.pop()!;
    this.undoStack.push(entry);

    this.isApplyingHistory = true;
    try {
      await this.applyChanges(entry.redoChanges);
      await this.database.history.put(entry).catch(() => {});
      trackEvent('undo_redo_invoked', { type: 'redo' });
    } finally {
      this.isApplyingHistory = false;
    }

    this.notifyListeners();
    return true;
  }

  /**
   * Reverts multiple steps back to a specific history checkpoint
   */
  async revertTo(historyId: string): Promise<void> {
    const index = this.undoStack.findIndex((e) => e.id === historyId);
    if (index === -1) return;

    const count = this.undoStack.length - 1 - index;
    for (let i = 0; i < count; i++) {
      await this.undo();
    }
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  getUndoStack(): HistoryEntry[] {
    return [...this.undoStack];
  }

  getRedoStack(): HistoryEntry[] {
    return [...this.redoStack];
  }

  /**
   * Applies a list of entity changes to Dexie tables
   */
  private async applyChanges(changes: EntityChange<unknown>[]): Promise<void> {
    for (const change of changes) {
      if (change.table === '_full') {
        if (change.next) {
          const { restoreSnapshotDataToDatabase } = await import('@/lib/workspace/snapshotCodec');
          await restoreSnapshotDataToDatabase(this.database, change.next as WorkspaceSnapshotData);
        } else {
          await this.database.clearAllData();
        }
        continue;
      }

      const tableRecord = this.database as unknown as Record<string, Table<unknown, string> | undefined>;
      const table = tableRecord[change.table];
      if (!table) continue;

      if (change.next === null) {
        await table.delete(change.key);
      } else {
        await table.put(change.next);
      }
    }
  }

  private notifyListeners(): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(HISTORY_CHANGED_EVENT, {
          detail: {
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            undoCount: this.undoStack.length,
            redoCount: this.redoStack.length,
            entries: this.undoStack.map((e) => ({
              id: e.id,
              description: e.description,
              timestamp: e.timestamp,
            })),
          },
        })
      );
    }
  }
}

export const historyManager = new HistoryManager(db);

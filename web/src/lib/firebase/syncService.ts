import { doc, getDoc, setDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { firestore, storage } from './client';
import { db, type FETDatabase } from '@/db';
import type {
  AcademicYearWorkspace,
  School,
  SyncStatus,
} from '@/types';
import {
  createSnapshotEnvelope,
  restoreSnapshotEnvelopeToDatabase,
  serializeSnapshotEnvelope,
  deserializeSnapshotEnvelope,
} from '@/lib/workspace/snapshotCodec';
import { workspaceManager } from '@/lib/workspace/workspaceManager';
import { trackEvent } from '@/lib/analytics';

export type SyncStatusListener = (status: SyncStatus) => void;

export class SyncService {
  private database: FETDatabase;
  private currentStatus: SyncStatus = 'local';
  private listeners: SyncStatusListener[] = [];
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private isSyncing = false;

  constructor(database: FETDatabase = db) {
    this.database = database;

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkChange(true));
      window.addEventListener('offline', () => this.handleNetworkChange(false));
    }
  }

  public subscribeStatus(listener: SyncStatusListener): () => void {
    this.listeners.push(listener);
    listener(this.currentStatus);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private setStatus(status: SyncStatus) {
    this.currentStatus = status;
    this.listeners.forEach((l) => l(status));
  }

  private handleNetworkChange(isOnline: boolean) {
    if (!isOnline) {
      this.setStatus('offline');
    } else {
      this.triggerAutoSync();
    }
  }

  /**
   * Schedules a debounced sync after local mutations
   */
  public triggerAutoSync(delayMs = 4000) {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.syncActiveWorkspace().catch((err) => {
        console.warn('[SyncService] AutoSync error:', err);
      });
    }, delayMs);
  }

  /**
   * Performs sync for active workspace
   */
  public async syncActiveWorkspace(uid?: string): Promise<SyncStatus> {
    if (this.isSyncing) return this.currentStatus;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.setStatus('offline');
      return 'offline';
    }

    const context = await workspaceManager.getActiveContext();
    if (context.isGuest || !context.school.ownerUid) {
      this.setStatus('local');
      return 'local';
    }

    const effectiveUid = uid || context.school.ownerUid;
    this.isSyncing = true;
    this.setStatus('saving');

    try {
      const workspace = context.workspace;
      const workspaceRef = doc(
        firestore,
        `users/${effectiveUid}/schools/${context.school.id}/workspaces/${workspace.id}`
      );

      const remoteDocSnap = await getDoc(workspaceRef);

      if (!remoteDocSnap.exists()) {
        // 1. Initial push to cloud
        await this.pushToCloud(effectiveUid, context.school, workspace);
        this.setStatus('synced');
        trackEvent('cloud_sync', { action: 'push', status: 'success' });
        return 'synced';
      }

      const remoteData = remoteDocSnap.data() as AcademicYearWorkspace;
      const remoteRevision = remoteData.cloudRevision || 1;
      const localRevision = workspace.localRevision;

      if (localRevision > remoteRevision) {
        // 2. Local is ahead -> push to cloud
        await this.pushToCloud(effectiveUid, context.school, workspace);
        this.setStatus('synced');
        trackEvent('cloud_sync', { action: 'push', status: 'success' });
        return 'synced';
      } else if (remoteRevision > localRevision) {
        // 3. Remote is ahead -> pull from cloud
        await this.pullFromCloud(effectiveUid, context.school.id, workspace.id, remoteRevision);
        this.setStatus('synced');
        trackEvent('cloud_sync', { action: 'pull', status: 'success' });
        return 'synced';
      } else {
        // Up to date
        this.setStatus('synced');
        return 'synced';
      }
    } catch (err: unknown) {
      console.warn('[SyncService] Sync error:', err);
      this.setStatus('error');
      trackEvent('cloud_sync', { action: 'push', status: 'failure' });
      return 'error';
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Pushes active workspace snapshot to Cloud Storage and updates Firestore metadata
   */
  private async pushToCloud(
    uid: string,
    school: School,
    workspace: AcademicYearWorkspace
  ): Promise<void> {
    // 1. Create full snapshot envelope
    const envelope = await createSnapshotEnvelope(this.database, {
      workspaceId: workspace.id,
      schoolId: school.id,
      description: 'Cloud sync snapshot',
    });

    const serialized = serializeSnapshotEnvelope(envelope);
    const newRevision = (workspace.cloudRevision || 0) + 1;

    // 2. Upload to Cloud Storage
    const storagePath = `snapshots/${uid}/${workspace.id}/rev_${newRevision}.json`;
    const fileRef = ref(storage, storagePath);
    await uploadString(fileRef, serialized, 'raw', {
      contentType: 'application/json',
      customMetadata: {
        workspaceId: workspace.id,
        schoolId: school.id,
        revision: String(newRevision),
      },
    });

    // 3. Update Firestore school and workspace metadata
    const schoolRef = doc(firestore, `users/${uid}/schools/${school.id}`);
    await setDoc(schoolRef, school, { merge: true });

    const now = new Date().toISOString();
    const updatedWorkspace: AcademicYearWorkspace = {
      ...workspace,
      cloudRevision: newRevision,
      localRevision: newRevision,
      lastSyncedAt: now,
      updatedAt: now,
    };

    const workspaceRef = doc(firestore, `users/${uid}/schools/${school.id}/workspaces/${workspace.id}`);
    await setDoc(workspaceRef, updatedWorkspace, { merge: true });

    // 4. Update local workspace record
    await this.database.workspaces.put(updatedWorkspace);
  }

  /**
   * Pulls snapshot from Cloud Storage and materializes it into IndexedDB
   */
  private async pullFromCloud(
    uid: string,
    schoolId: string,
    workspaceId: string,
    revision: number
  ): Promise<void> {
    const storagePath = `snapshots/${uid}/${workspaceId}/rev_${revision}.json`;
    const fileRef = ref(storage, storagePath);
    const downloadUrl = await getDownloadURL(fileRef);

    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`Failed to download snapshot: ${response.statusText}`);
    }

    const jsonText = await response.text();
    const envelope = deserializeSnapshotEnvelope(jsonText);

    // Restore to database
    await restoreSnapshotEnvelopeToDatabase(this.database, envelope);

    const now = new Date().toISOString();
    await this.database.workspaces.update(workspaceId, {
      cloudRevision: revision,
      localRevision: revision,
      lastSyncedAt: now,
      updatedAt: now,
    });
  }

  /**
   * Deletes a cloud workspace and all its storage snapshots
   */
  public async deleteCloudWorkspace(uid: string, schoolId: string, workspaceId: string): Promise<void> {
    const workspaceRef = doc(firestore, `users/${uid}/schools/${schoolId}/workspaces/${workspaceId}`);
    await deleteDoc(workspaceRef);
  }

  /**
   * Deletes all cloud data for a user (called during account deletion)
   */
  public async deleteAllUserCloudData(uid: string): Promise<void> {
    const schoolsRef = collection(firestore, `users/${uid}/schools`);
    const schoolDocs = await getDocs(schoolsRef);

    for (const sDoc of schoolDocs.docs) {
      const workspacesRef = collection(firestore, `users/${uid}/schools/${sDoc.id}/workspaces`);
      const wsDocs = await getDocs(workspacesRef);
      for (const wDoc of wsDocs.docs) {
        await deleteDoc(wDoc.ref);
      }
      await deleteDoc(sDoc.ref);
    }
  }
}

export const syncService = new SyncService(db);

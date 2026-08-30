export type ConsentStatus = 'granted' | 'denied';

export interface AnalyticsEventMap {
  page_view: {
    page_path: string;
  };
  timetable_imported: {
    source_type: 'fet' | 'roz' | 'json';
    activity_count?: number;
  };
  generation_started: {
    mode: number;
    n_activities: number;
  };
  generation_completed: {
    is_complete: boolean;
    elapsed_time_ms: number;
  };
  print_exported: {
    format: 'pdf' | 'csv' | 'print';
    view_type: 'teachers' | 'students' | 'rooms' | 'activities' | 'tariff' | 'classes_workload';
  };
  pwa_installed: {
    platform?: string;
  };
  auth_login: {
    method: 'google';
  };
  auth_logout: Record<string, never>;
  cloud_sync: {
    action: 'pull' | 'push' | 'conflict';
    status: 'success' | 'failure';
  };
  workspace_switched: {
    is_cloud: boolean;
  };
  undo_redo_invoked: {
    type: 'undo' | 'redo';
  };
  consent_changed: {
    status: ConsentStatus;
  };
}

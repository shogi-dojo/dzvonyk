import type {
  Activity,
  Subject,
  Teacher,
  StudentsGroup,
  StudentsSubgroup,
  TimetableSolution,
} from '@/types';
import { deriveSubjectCode } from './subjectCodes';

export interface UnplacedActivityItem {
  activity: Activity;
  subjectName: string;
  subjectCode: string;
  subjectColor?: string;
  teacherNames: string[];
  studentNames: string[];
  duration: number;
  totalDuration: number;
  weekParity?: 'both' | 'numerator' | 'denominator';
}

/**
 * Returns a list of all activities that are not yet placed in the timetable solution.
 */
export function getUnplacedActivities(params: {
  activities: Activity[];
  solution: TimetableSolution | null;
  subjects: Subject[];
  teachers: Teacher[];
  groups: StudentsGroup[];
  subgroups: StudentsSubgroup[];
}): UnplacedActivityItem[] {
  const { activities, solution, subjects, teachers, groups, subgroups } = params;

  if (!activities || activities.length === 0) return [];

  const placedSet = new Set<string>(
    solution?.placements?.map((p) => p.activityId) || []
  );

  const subjectMap = new Map(subjects.map((s) => [s.id, s]));
  const teacherMap = new Map(teachers.map((t) => [t.id, t]));
  const groupMap = new Map(groups.map((g) => [g.id, g]));
  const subgroupMap = new Map(subgroups.map((sg) => [sg.id, sg]));

  const unplacedList: UnplacedActivityItem[] = [];

  for (const act of activities) {
    if (placedSet.has(act.id)) continue;

    const subj = subjectMap.get(act.subjectId);
    const subjectName = subj?.name || act.subjectId;
    const subjectCode = subj?.code || deriveSubjectCode(subjectName);
    const subjectColor = subj?.color;

    const teacherNames = act.teacherIds
      .map((tid) => teacherMap.get(tid)?.name || tid)
      .filter(Boolean);

    const studentNames = act.studentSetIds
      .map((sid) => {
        const grp = groupMap.get(sid);
        if (grp) return grp.name;
        const sub = subgroupMap.get(sid);
        if (sub) return sub.name;
        return sid;
      })
      .filter(Boolean);

    unplacedList.push({
      activity: act,
      subjectName,
      subjectCode,
      subjectColor,
      teacherNames,
      studentNames,
      duration: act.duration || 1,
      totalDuration: act.totalDuration || 1,
      weekParity: act.weekParity,
    });
  }

  return unplacedList;
}

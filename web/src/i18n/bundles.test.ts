// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it, afterAll } from 'vitest';
import i18n from './index';
import uk from './uk.json';
import ukUniversity from './uk-university.json';
import ukCollege from './uk-college.json';

/**
 * The term-dependent keys the university bundle must speak differently.
 * These are the contract: remove one from the bundle and an academic
 * workspace silently falls back to school terminology.
 */
const UNIVERSITY_TERM_KEYS = [
  'nav.teachers', 'nav.students', 'nav.studentsDesc', 'nav.activities', 'nav.rooms',
  'footer.aboutLead',
  'dashboard.stats.activities', 'dashboard.stats.rooms',
  'dashboard.institution.solutionMeta_one', 'dashboard.institution.solutionMeta_few',
  'dashboard.institution.solutionMeta_many', 'dashboard.institution.solutionMeta_other',
  'dashboard.quickActions.addStudents', 'dashboard.quickActions.addActivities',
  'dashboard.gettingStarted.steps.4', 'dashboard.gettingStarted.steps.5', 'dashboard.gettingStarted.steps.6',
  'dashboard.import.success_one', 'dashboard.import.success_few',
  'dashboard.import.success_many', 'dashboard.import.success_other',
  'teachers.emptyDescriptionSearch',
  'teachers.workload.description', 'teachers.workload.teacher', 'teachers.workload.addTitle',
  'teachers.workload.addDescription', 'teachers.workload.audience', 'teachers.workload.selectAudience',
  'teachers.workload.classOption', 'teachers.workload.parallelHint', 'teachers.workload.updatedNotice',
  'teachers.workload.summaryDescription', 'teachers.workload.hoursPerClass',
  'teachers.workload.advancedEditHint', 'teachers.workload.scheduleTitle',
  'teachers.workload.averagePerClass', 'teachers.workload.lowLevelHint',
  'students.title', 'students.description', 'students.addGroup', 'students.stats.groups',
  'students.emptyDescription', 'students.noGroups', 'students.confirmDeleteYear', 'students.confirmDeleteGroup',
  'students.availabilityDialogDesc',
  'students.studentsCount_one', 'students.studentsCount_few', 'students.studentsCount_many', 'students.studentsCount_other',
  'students.groupsCount_one', 'students.groupsCount_few', 'students.groupsCount_many', 'students.groupsCount_other',
  'activities.title', 'activities.description', 'activities.addActivity', 'activities.editActivity',
  'activities.searchPlaceholder', 'activities.emptyTitle', 'activities.emptyTitleSearch',
  'activities.emptyDescription', 'activities.emptyDescriptionSearch', 'activities.confirmDelete',
  'activities.teacherLine', 'activities.selectActivity',
  'activities.tags.description', 'activities.studentLabelGroup',
  'activities.dialog.addTitle', 'activities.dialog.editTitle', 'activities.dialog.addDescription',
  'activities.dialog.editDescription', 'activities.dialog.teacher', 'activities.dialog.students',
  'activities.dialog.selectStudents', 'activities.dialog.totalStudents', 'activities.dialog.shiftOverrideNone',
  'activityTags.dialog.description',
  'rooms.title', 'rooms.description', 'rooms.addRoom', 'rooms.editRoom', 'rooms.stats.totalRooms',
  'rooms.searchPlaceholder', 'rooms.emptyTitle', 'rooms.emptyTitleSearch', 'rooms.emptyDescription',
  'rooms.emptyDescriptionSearch', 'rooms.confirmDeleteRoom', 'rooms.roomDialog.description',
  'rooms.roomDialog.namePlaceholder', 'rooms.roomDialog.longNamePlaceholder', 'rooms.roomDialog.isVirtual',
  'rooms.buildingDialog.description',
  'rooms.roomsInBuilding_one', 'rooms.roomsInBuilding_few', 'rooms.roomsInBuilding_many', 'rooms.roomsInBuilding_other',
  'constraints.categories.students', 'constraints.categories.activity',
  'constraints.dialog.teacher', 'constraints.dialog.students', 'constraints.dialog.selectStudents',
  'constraints.dialog.activity', 'constraints.dialog.selectActivity', 'constraints.dialog.room',
  'constraints.dialog.selectRoom', 'constraints.dialog.activities', 'constraints.dialog.hour',
  'constraints.descriptions.activityAt', 'constraints.descriptions.activityToRoom',
  'constraints.descriptions.minDaysBetween_one', 'constraints.descriptions.minDaysBetween_few',
  'constraints.descriptions.minDaysBetween_many', 'constraints.descriptions.minDaysBetween_other',
  'constraints.typeLabels.TeacherNotAvailableTimes', 'constraints.typeLabels.TeacherMaxDaysPerWeek',
  'constraints.typeLabels.TeacherMinDaysPerWeek', 'constraints.typeLabels.TeacherMaxHoursDaily',
  'constraints.typeLabels.TeacherMinHoursDaily', 'constraints.typeLabels.TeacherMaxGapsPerWeek',
  'constraints.typeLabels.TeacherMaxGapsPerDay', 'constraints.typeLabels.StudentsSetNotAvailableTimes',
  'constraints.typeLabels.StudentsSetMaxHoursDaily', 'constraints.typeLabels.StudentsSetMaxGapsPerDay',
  'constraints.typeLabels.StudentsSetMaxGapsPerWeek', 'constraints.typeLabels.MinDaysBetweenActivities',
  'constraints.typeLabels.ActivityPreferredStartingTime', 'constraints.typeLabels.RoomNotAvailableTimes',
  'constraints.typeLabels.ActivityPreferredRoom', 'constraints.typeLabels.SubjectPreferredRoom',
  'constraints.typeLabels.TeacherHomeRoom',
  'constraints.typeDescriptions.BasicCompulsoryTime', 'constraints.typeDescriptions.TeacherNotAvailableTimes',
  'constraints.typeDescriptions.StudentsSetNotAvailableTimes', 'constraints.typeDescriptions.StudentsSetMaxGapsPerDay',
  'constraints.typeDescriptions.StudentsSetMaxGapsPerWeek', 'constraints.typeDescriptions.BasicCompulsorySpace',
  'constraints.typeDescriptions.RoomNotAvailableTimes', 'constraints.typeDescriptions.ActivityPreferredRoom',
  'constraints.typeDescriptions.SubjectPreferredRoom', 'constraints.typeDescriptions.TeacherHomeRoom',
  'timeConstraints.description',
  'timeConstraints.categories.students', 'timeConstraints.categories.activity',
  'timeConstraints.dialog.teacher', 'timeConstraints.dialog.studentsSet', 'timeConstraints.dialog.selectStudentsSet',
  'timeConstraints.dialog.activity', 'timeConstraints.dialog.selectActivity', 'timeConstraints.dialog.hour',
  'timeConstraints.dialog.activities', 'timeConstraints.dialog.noActivities',
  'timeConstraints.types.BasicCompulsoryTime.description', 'timeConstraints.types.BreakTimes.description',
  'timeConstraints.types.TeacherNotAvailableTimes.label', 'timeConstraints.types.TeacherNotAvailableTimes.description',
  'timeConstraints.types.TeacherMaxDaysPerWeek.label', 'timeConstraints.types.TeacherMaxHoursDaily.label',
  'timeConstraints.types.TeacherMaxGapsPerWeek.label', 'timeConstraints.types.TeacherMaxGapsPerWeek.description',
  'timeConstraints.types.TeacherMaxGapsPerDay.label',
  'timeConstraints.types.StudentsSetNotAvailableTimes.label', 'timeConstraints.types.StudentsSetNotAvailableTimes.description',
  'timeConstraints.types.StudentsSetMaxHoursDaily.label', 'timeConstraints.types.StudentsSetMaxHoursDaily.description',
  'timeConstraints.types.StudentsSetMaxGapsPerWeek.label', 'timeConstraints.types.StudentsSetMaxGapsPerWeek.description',
  'timeConstraints.types.MinDaysBetweenActivities.label', 'timeConstraints.types.MinDaysBetweenActivities.description',
  'timeConstraints.types.ActivitiesSameStartingTime.label', 'timeConstraints.types.ActivitiesSameStartingTime.description',
  'timeConstraints.types.ActivitiesNotOverlapping.label', 'timeConstraints.types.ActivitiesNotOverlapping.description',
  'timeConstraints.types.ActivityPreferredStartingTime.label', 'timeConstraints.types.ActivityPreferredStartingTime.description',
  'timeConstraints.descriptions.activityAt', 'timeConstraints.descriptions.activityAtLocked',
  'timeConstraints.descriptions.minDaysBetween_one', 'timeConstraints.descriptions.minDaysBetween_few',
  'timeConstraints.descriptions.minDaysBetween_many', 'timeConstraints.descriptions.minDaysBetween_other',
  'timeConstraints.descriptions.sameStart_one', 'timeConstraints.descriptions.sameStart_few',
  'timeConstraints.descriptions.sameStart_many', 'timeConstraints.descriptions.sameStart_other',
  'timeConstraints.descriptions.notOverlapping_one', 'timeConstraints.descriptions.notOverlapping_few',
  'timeConstraints.descriptions.notOverlapping_many', 'timeConstraints.descriptions.notOverlapping_other',
  'spaceConstraints.description',
  'spaceConstraints.categories.room', 'spaceConstraints.categories.activity', 'spaceConstraints.categories.students',
  'spaceConstraints.dialog.room', 'spaceConstraints.dialog.selectRoom', 'spaceConstraints.dialog.rooms',
  'spaceConstraints.dialog.noRooms', 'spaceConstraints.dialog.activity', 'spaceConstraints.dialog.selectActivity',
  'spaceConstraints.dialog.teacher', 'spaceConstraints.dialog.studentsSet', 'spaceConstraints.dialog.selectStudentsSet',
  'spaceConstraints.types.BasicCompulsorySpace.description',
  'spaceConstraints.types.RoomNotAvailableTimes.label', 'spaceConstraints.types.RoomNotAvailableTimes.description',
  'spaceConstraints.types.ActivityPreferredRoom.label', 'spaceConstraints.types.ActivityPreferredRoom.description',
  'spaceConstraints.types.ActivityPreferredRooms.label', 'spaceConstraints.types.ActivityPreferredRooms.description',
  'spaceConstraints.types.SubjectPreferredRoom.label', 'spaceConstraints.types.SubjectPreferredRoom.description',
  'spaceConstraints.types.SubjectPreferredRooms.label', 'spaceConstraints.types.SubjectPreferredRooms.description',
  'spaceConstraints.types.SubjectActivityTagPreferredRoom.label', 'spaceConstraints.types.SubjectActivityTagPreferredRoom.description',
  'spaceConstraints.types.SubjectActivityTagPreferredRooms.label', 'spaceConstraints.types.SubjectActivityTagPreferredRooms.description',
  'spaceConstraints.types.TeacherHomeRoom.label', 'spaceConstraints.types.TeacherHomeRoom.description',
  'spaceConstraints.types.TeacherHomeRooms.label', 'spaceConstraints.types.TeacherHomeRooms.description',
  'spaceConstraints.types.StudentsSetHomeRoom.label', 'spaceConstraints.types.StudentsSetHomeRoom.description',
  'spaceConstraints.types.StudentsSetHomeRooms.label', 'spaceConstraints.types.StudentsSetHomeRooms.description',
  'spaceConstraints.types.ActivityTagPreferredRoom.label', 'spaceConstraints.types.ActivityTagPreferredRoom.description',
  'spaceConstraints.types.ActivityTagPreferredRooms.label', 'spaceConstraints.types.ActivityTagPreferredRooms.description',
  'spaceConstraints.descriptions.activityToRoom', 'spaceConstraints.descriptions.activityToRoomLocked',
  'spaceConstraints.descriptions.activityToRooms', 'spaceConstraints.descriptions.subjectToRooms',
  'spaceConstraints.descriptions.subjectTagToRooms', 'spaceConstraints.descriptions.teacherToRooms',
  'spaceConstraints.descriptions.studentsToRooms', 'spaceConstraints.descriptions.tagToRooms',
  'timetable.byStudents', 'timetable.byRoom', 'timetable.byAllClasses',
  'timetable.allClassesTitle', 'timetable.allClassesDescription',
  'timetable.byFullMatrix', 'timetable.fullMatrixTitle', 'timetable.fullMatrixDescription',
  'timetable.teacherMatrixDescription',
  'timetable.details.empty', 'timetable.pairedSuccess', 'timetable.pairPrompt',
  'timetable.lockTooltip', 'timetable.moveSuccess', 'timetable.movePrompt', 'timetable.moveError',
  'timetable.dragOrClickToMove', 'timetable.step2Group', 'timetable.step2Room',
  'timetable.scheduleStudent', 'timetable.scheduleRoom',
  'timetable.stats.totalPeriods',
  'timetable.historyMoved', 'timetable.historyPlaced', 'timetable.historyUnlocked', 'timetable.historyLocked',
  'timetable.roomPrintTitle',
  'timetable.conflict.classOverlap', 'timetable.conflict.roomOverlap', 'timetable.conflict.lessonNotFound',
  'timetable.conflict.teacherUnavailable', 'timetable.conflict.classNotStudying',
  'timetable.conflict.teacherBusy', 'timetable.conflict.classBusy', 'timetable.conflict.roomBusy',
  'timetable.activitiesMeta_one', 'timetable.activitiesMeta_few', 'timetable.activitiesMeta_many', 'timetable.activitiesMeta_other',
  'timetable.lessonLabelFull', 'timetable.lessonLabelCompact',
  'settings.importSuccessDetail',
  'settings.hours.title', 'settings.hours.add', 'settings.hours.defaultName',
  'settings.hours.startAria', 'settings.hours.endAria', 'settings.hours.labelSr',
  'settings.stats.hours',
  'settings.danger.resetDetail', 'settings.danger.confirmDetail',
  'generate.controls.lockedInfo',
  'generate.history.lessonsCount_one', 'generate.history.lessonsCount_few',
  'generate.history.lessonsCount_many', 'generate.history.lessonsCount_other',
  'generate.precheck.activities', 'generate.stats.placed',
  'generate.lastSolution.placed_one', 'generate.lastSolution.placed_few',
  'generate.lastSolution.placed_many', 'generate.lastSolution.placed_other',
  'generate.tips.3', 'generate.tips.4', 'generate.errors.needActivities',
  'workspace.cloneStructureOnly',
  'account.deleteAccountWarning',
  'print.dailyClasses', 'print.dailyTeachersTitle', 'print.dailyClassesTitle',
  'print.approvalRole', 'print.approvalToggle', 'print.deputy', 'print.lessonCol',
  'print.classTitle', 'print.classTitleFor', 'print.teacherTitle',
  'print.summaryClassesTitle', 'print.summaryTeachersTitle',
  'print.classesWorkloadTitle', 'print.dailyTitle',
  'print.daysHoursMeta', 'print.workDaysMeta', 'print.firstColClasses',
  'print.classesHoursCol', 'print.classCol', 'print.lessonsCol',
  'print.allClassesDocTitle', 'print.summaryClassesDocTitle', 'print.classesWorkloadDocTitle',
  'print.dailyTeachersDocTitle', 'print.dailyClassesDocTitle',
  'print.reportClass', 'print.reportTeacher', 'print.reportSummaryClasses', 'print.reportClassesWorkload',
  'print.classSelector', 'print.teacherSelector', 'print.printAllClasses',
  'preflight.noActivities', 'preflight.classOverload', 'preflight.classNearCapacity',
  'preflight.teacherNoSlots', 'preflight.teacherOverload', 'preflight.teacherNearCapacity',
  'preflight.roomNoSlots', 'preflight.roomOverload', 'preflight.splitOrphan',
] as const;

function leaves(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object') return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([key, value]) =>
    leaves(value, prefix ? `${prefix}.${key}` : key),
  );
}

function lookup(root: unknown, dotted: string): unknown {
  return dotted.split('.').reduce<unknown>(
    (node, part) => (node !== null && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined),
    root,
  );
}

describe('preset resource bundles', () => {
  it('university bundle covers every term-dependent key of the base bundle', () => {
    const overridden = new Set(leaves(ukUniversity));
    const missing = UNIVERSITY_TERM_KEYS.filter((key) => !overridden.has(key));
    expect(missing, 'term keys missing from uk-university.json').toEqual([]);
  });

  it('every override path exists in the base bundle (catches typos that would fall back silently)', () => {
    for (const bundleName of ['uk-university', 'uk-college']) {
      const bundle = bundleName === 'uk-university' ? ukUniversity : ukCollege;
      const unknown = leaves(bundle).filter((key) => lookup(uk, key) === undefined);
      expect(unknown, `${bundleName} overrides keys missing from uk.json`).toEqual([]);
    }
  });

  it('university bundle overrides actually differ from the base values', () => {
    for (const key of UNIVERSITY_TERM_KEYS) {
      const override = lookup(ukUniversity, key);
      expect(override, `${key} is missing`).toBeDefined();
      expect(override, `${key} duplicates the school wording`).not.toBe(lookup(uk, key));
    }
  });

  it('resolves academic terminology at runtime and falls back for everything else', () => {
    void i18n.changeLanguage('uk-university');
    expect(i18n.t('nav.teachers')).toBe('Викладачі');
    expect(i18n.t('timetable.lessonLabelFull', { count: 2 })).toBe('2 пара');
    expect(i18n.t('preflight.classOverload', { name: 'КН-21', load: 40, slots: 30, days: 5, hours: 6, excess: 10 }))
      .toContain('Група КН-21');
    // Untouched keys fall through to the complete school bundle.
    expect(i18n.t('common.cancel')).toBe(i18n.t('common.cancel', { lng: 'uk' }));
    expect(i18n.t('institution.presets.university.label')).toBe('Університет');
  });

  it('falls back from college through university to the base bundle', () => {
    void i18n.changeLanguage('uk-college');
    expect(i18n.t('nav.teachers')).toBe('Викладачі');
    expect(i18n.t('common.cancel')).toBe('Скасувати');
    void i18n.changeLanguage('uk');
    expect(i18n.t('timetable.lessonLabelFull', { count: 2 })).toBe('2 урок');
  });

  afterAll(() => {
    void i18n.changeLanguage('uk');
  });
});

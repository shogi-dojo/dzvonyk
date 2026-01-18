/**
 * FET File Parser
 * Parses .fet XML files into the web application's data structures
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  FETFile, Teacher, Subject, ActivityTag, Activity,
  StudentsYear, StudentsGroup, StudentsSubgroup,
  Room, Building, Day, Hour,
  TimeConstraint, SpaceConstraint,
} from '../types';

/**
 * Parse a FET XML file content into structured data
 */
export function parseFETFile(xmlContent: string): FETFile {
  // Remove BOM (Byte Order Mark) if present and trim
  let cleanContent = xmlContent;
  if (cleanContent.charCodeAt(0) === 0xFEFF) {
    cleanContent = cleanContent.slice(1);
  }
  cleanContent = cleanContent.trim();
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(cleanContent, 'text/xml');
  
  // Check for parsing errors
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    console.error('XML Parse Error:', parseError.textContent);
    throw new Error('XML parsing error: ' + (parseError.textContent || 'Unknown error'));
  }
  
  const root = doc.querySelector('fet');
  if (!root) {
    throw new Error('Invalid FET file: missing <fet> root element');
  }
  
  const version = root.getAttribute('version') || 'unknown';
  
  console.log('Parsing FET file version:', version);
  
  // Parse days first for constraint mapping
  const daysOfTheWeek = parseDays(doc);
  const hoursOfTheDay = parseHours(doc);
  
  const result: FETFile = {
    version,
    mode: parseMode(doc),
    institutionName: getTextContent(doc, 'Institution_Name') || 'Default Institution',
    comments: getTextContent(doc, 'Comments') || '',
    daysOfTheWeek,
    hoursOfTheDay,
    subjects: parseSubjects(doc),
    activityTags: parseActivityTags(doc),
    teachers: parseTeachers(doc),
    studentsYears: parseStudentsYears(doc),
    studentsGroups: parseStudentsGroups(doc),
    studentsSubgroups: parseStudentsSubgroups(doc),
    activities: parseActivities(doc),
    buildings: parseBuildings(doc),
    rooms: parseRooms(doc),
    timeConstraints: parseTimeConstraints(doc, daysOfTheWeek, hoursOfTheDay),
    spaceConstraints: parseSpaceConstraints(doc),
  };
  
  console.log('Parsed FET file:', {
    institution: result.institutionName,
    days: result.daysOfTheWeek.length,
    hours: result.hoursOfTheDay.length,
    teachers: result.teachers.length,
    subjects: result.subjects.length,
    activities: result.activities.length,
    studentsYears: result.studentsYears.length,
    rooms: result.rooms.length,
    timeConstraints: result.timeConstraints.length,
    spaceConstraints: result.spaceConstraints.length,
  });
  
  return result;
}

function getTextContent(doc: Document, tagName: string): string | null {
  const element = doc.querySelector(tagName);
  return element?.textContent?.trim() || null;
}

function parseMode(doc: Document): number {
  const mode = getTextContent(doc, 'Mode');
  if (mode === 'Official') return 0;
  if (mode === 'Mornings-Afternoons') return 1;
  if (mode === 'Block-Planning') return 2;
  if (mode === 'Terms') return 3;
  return 0;
}

function parseDays(doc: Document): Day[] {
  const days: Day[] = [];
  const daysList = doc.querySelector('Days_List');
  if (!daysList) return days;
  
  const dayElements = daysList.querySelectorAll('Day');
  dayElements.forEach((dayEl) => {
    const name = dayEl.querySelector('Name')?.textContent?.trim() || '';
    const longName = dayEl.querySelector('Long_Name')?.textContent?.trim() || name;
    if (name) {
      days.push({ name, longName });
    }
  });
  
  return days;
}

function parseHours(doc: Document): Hour[] {
  const hours: Hour[] = [];
  const hoursList = doc.querySelector('Hours_List');
  if (!hoursList) return hours;
  
  const hourElements = hoursList.querySelectorAll('Hour');
  hourElements.forEach((hourEl) => {
    const name = hourEl.querySelector('Name')?.textContent?.trim() || '';
    const longName = hourEl.querySelector('Long_Name')?.textContent?.trim() || name;
    if (name) {
      hours.push({ name, longName });
    }
  });
  
  return hours;
}

function parseSubjects(doc: Document): Subject[] {
  const subjects: Subject[] = [];
  const subjectsList = doc.querySelector('Subjects_List');
  if (!subjectsList) return subjects;
  
  const subjectElements = subjectsList.querySelectorAll('Subject');
  subjectElements.forEach((el) => {
    const name = el.querySelector('Name')?.textContent?.trim() || '';
    if (name) {
      subjects.push({
        id: uuidv4(),
        name,
        longName: el.querySelector('Long_Name')?.textContent?.trim() || name,
        code: el.querySelector('Code')?.textContent?.trim() || '',
        comments: el.querySelector('Comments')?.textContent?.trim() || '',
      });
    }
  });
  
  return subjects;
}

function parseActivityTags(doc: Document): ActivityTag[] {
  const tags: ActivityTag[] = [];
  const tagsList = doc.querySelector('Activity_Tags_List');
  if (!tagsList) return tags;
  
  const tagElements = tagsList.querySelectorAll('Activity_Tag');
  tagElements.forEach((el) => {
    const name = el.querySelector('Name')?.textContent?.trim() || '';
    if (name) {
      const printable = el.querySelector('Printable')?.textContent?.trim();
      tags.push({
        id: uuidv4(),
        name,
        longName: el.querySelector('Long_Name')?.textContent?.trim() || name,
        code: el.querySelector('Code')?.textContent?.trim() || '',
        printable: printable !== 'false',
        comments: el.querySelector('Comments')?.textContent?.trim() || '',
      });
    }
  });
  
  return tags;
}

function parseTeachers(doc: Document): Teacher[] {
  const teachers: Teacher[] = [];
  const teachersList = doc.querySelector('Teachers_List');
  if (!teachersList) return teachers;
  
  const teacherElements = teachersList.querySelectorAll('Teacher');
  teacherElements.forEach((el) => {
    const name = el.querySelector('Name')?.textContent?.trim() || '';
    if (name) {
      const qualifiedSubjects: string[] = [];
      const qualifiedEl = el.querySelector('Qualified_Subjects');
      if (qualifiedEl) {
        const subjectEls = qualifiedEl.querySelectorAll('Qualified_Subject');
        subjectEls.forEach(s => {
          const sName = s.textContent?.trim();
          if (sName) qualifiedSubjects.push(sName);
        });
      }
      
      teachers.push({
        id: uuidv4(),
        name,
        longName: el.querySelector('Long_Name')?.textContent?.trim() || name,
        code: el.querySelector('Code')?.textContent?.trim() || '',
        targetNumberOfHours: parseInt(el.querySelector('Target_Number_of_Hours')?.textContent || '0', 10),
        qualifiedSubjects,
        comments: el.querySelector('Comments')?.textContent?.trim() || '',
      });
    }
  });
  
  return teachers;
}

function parseStudentsYears(doc: Document): StudentsYear[] {
  const years: StudentsYear[] = [];
  const yearsList = doc.querySelector('Students_List');
  if (!yearsList) return years;
  
  const children = yearsList.children;
  for (let i = 0; i < children.length; i++) {
    const el = children[i];
    if (el.tagName !== 'Year') continue;
    
    const nameEl = el.querySelector(':scope > Name');
    const name = nameEl?.textContent?.trim() || '';
    if (name) {
      const groups: string[] = [];
      const groupEls = el.querySelectorAll(':scope > Group');
      groupEls.forEach(g => {
        const gNameEl = g.querySelector(':scope > Name');
        const gName = gNameEl?.textContent?.trim();
        if (gName) groups.push(gName);
      });
      
      years.push({
        id: uuidv4(),
        name,
        longName: el.querySelector(':scope > Long_Name')?.textContent?.trim() || name,
        code: el.querySelector(':scope > Code')?.textContent?.trim() || '',
        numberOfStudents: parseInt(el.querySelector(':scope > Number_of_Students')?.textContent || '0', 10),
        type: 1,
        groups,
        divisions: [],
        separator: ' ',
        comments: el.querySelector(':scope > Comments')?.textContent?.trim() || '',
      });
    }
  }
  
  return years;
}

function parseStudentsGroups(doc: Document): StudentsGroup[] {
  const groups: StudentsGroup[] = [];
  const yearsList = doc.querySelector('Students_List');
  if (!yearsList) return groups;
  
  const children = yearsList.children;
  for (let i = 0; i < children.length; i++) {
    const yearEl = children[i];
    if (yearEl.tagName !== 'Year') continue;
    
    const groupEls = yearEl.querySelectorAll(':scope > Group');
    groupEls.forEach((el) => {
      const nameEl = el.querySelector(':scope > Name');
      const name = nameEl?.textContent?.trim() || '';
      if (name) {
        const subgroups: string[] = [];
        const subgroupEls = el.querySelectorAll(':scope > Subgroup');
        subgroupEls.forEach(s => {
          const sNameEl = s.querySelector(':scope > Name');
          const sName = sNameEl?.textContent?.trim();
          if (sName) subgroups.push(sName);
        });
        
        groups.push({
          id: uuidv4(),
          name,
          longName: el.querySelector(':scope > Long_Name')?.textContent?.trim() || name,
          code: el.querySelector(':scope > Code')?.textContent?.trim() || '',
          numberOfStudents: parseInt(el.querySelector(':scope > Number_of_Students')?.textContent || '0', 10),
          type: 2,
          subgroups,
          comments: el.querySelector(':scope > Comments')?.textContent?.trim() || '',
        });
      }
    });
  }
  
  return groups;
}

function parseStudentsSubgroups(doc: Document): StudentsSubgroup[] {
  const subgroups: StudentsSubgroup[] = [];
  const yearsList = doc.querySelector('Students_List');
  if (!yearsList) return subgroups;
  
  const children = yearsList.children;
  for (let i = 0; i < children.length; i++) {
    const yearEl = children[i];
    if (yearEl.tagName !== 'Year') continue;
    
    const groupEls = yearEl.querySelectorAll(':scope > Group');
    groupEls.forEach((groupEl) => {
      const subgroupEls = groupEl.querySelectorAll(':scope > Subgroup');
      subgroupEls.forEach((el) => {
        const nameEl = el.querySelector(':scope > Name');
        const name = nameEl?.textContent?.trim() || '';
        if (name) {
          subgroups.push({
            id: uuidv4(),
            name,
            longName: el.querySelector(':scope > Long_Name')?.textContent?.trim() || name,
            code: el.querySelector(':scope > Code')?.textContent?.trim() || '',
            numberOfStudents: parseInt(el.querySelector(':scope > Number_of_Students')?.textContent || '0', 10),
            type: 3,
            comments: el.querySelector(':scope > Comments')?.textContent?.trim() || '',
          });
        }
      });
    });
  }
  
  return subgroups;
}

function parseActivities(doc: Document): Activity[] {
  const activities: Activity[] = [];
  const activitiesList = doc.querySelector('Activities_List');
  if (!activitiesList) return activities;
  
  const activityElements = activitiesList.querySelectorAll('Activity');
  activityElements.forEach((el) => {
    const subject = el.querySelector('Subject')?.textContent?.trim() || '';
    
    const teacherIds: string[] = [];
    const teacherEls = el.querySelectorAll('Teacher');
    teacherEls.forEach(t => {
      const tName = t.textContent?.trim();
      if (tName) teacherIds.push(tName);
    });
    
    const studentSetIds: string[] = [];
    const studentEls = el.querySelectorAll('Students');
    studentEls.forEach(s => {
      const sName = s.textContent?.trim();
      if (sName) studentSetIds.push(sName);
    });
    
    const activityTagIds: string[] = [];
    const tagEls = el.querySelectorAll('Activity_Tag');
    tagEls.forEach(t => {
      const tName = t.textContent?.trim();
      if (tName) activityTagIds.push(tName);
    });
    
    const duration = parseInt(el.querySelector('Duration')?.textContent || '1', 10);
    const totalDuration = parseInt(el.querySelector('Total_Duration')?.textContent || String(duration), 10);
    const activityGroupId = parseInt(el.querySelector('Activity_Group_Id')?.textContent || '0', 10);
    const active = el.querySelector('Active')?.textContent?.trim() !== 'false';
    const computeNTotalStudents = el.querySelector('Compute_N_Total_Students')?.textContent?.trim() !== 'false';
    const nTotalStudents = parseInt(el.querySelector('N_Total_Students')?.textContent || '0', 10);
    
    activities.push({
      id: uuidv4(),
      activityGroupId,
      teacherIds,
      subjectId: subject,
      activityTagIds,
      studentSetIds,
      duration,
      totalDuration,
      active,
      computeNTotalStudents,
      nTotalStudents,
      comments: el.querySelector('Comments')?.textContent?.trim() || '',
    });
  });
  
  return activities;
}

function parseBuildings(doc: Document): Building[] {
  const buildings: Building[] = [];
  const buildingsList = doc.querySelector('Buildings_List');
  if (!buildingsList) return buildings;
  
  const buildingElements = buildingsList.querySelectorAll('Building');
  buildingElements.forEach((el) => {
    const name = el.querySelector('Name')?.textContent?.trim() || '';
    if (name) {
      buildings.push({
        id: uuidv4(),
        name,
        longName: el.querySelector('Long_Name')?.textContent?.trim() || name,
        code: el.querySelector('Code')?.textContent?.trim() || '',
        comments: el.querySelector('Comments')?.textContent?.trim() || '',
      });
    }
  });
  
  return buildings;
}

function parseRooms(doc: Document): Room[] {
  const rooms: Room[] = [];
  const roomsList = doc.querySelector('Rooms_List');
  if (!roomsList) return rooms;
  
  const roomElements = roomsList.querySelectorAll('Room');
  roomElements.forEach((el) => {
    const name = el.querySelector('Name')?.textContent?.trim() || '';
    if (name) {
      const isVirtual = el.querySelector('Virtual')?.textContent?.trim() === 'true';
      
      rooms.push({
        id: uuidv4(),
        name,
        longName: el.querySelector('Long_Name')?.textContent?.trim() || name,
        code: el.querySelector('Code')?.textContent?.trim() || '',
        capacity: parseInt(el.querySelector('Capacity')?.textContent || '30', 10),
        buildingId: el.querySelector('Building')?.textContent?.trim() || undefined,
        isVirtual,
        comments: el.querySelector('Comments')?.textContent?.trim() || '',
      });
    }
  });
  
  return rooms;
}

function parseTimeConstraints(doc: Document, days: Day[], hours: Hour[]): TimeConstraint[] {
  const constraints: TimeConstraint[] = [];
  const constraintsList = doc.querySelector('Time_Constraints_List');
  if (!constraintsList) return constraints;
  
  // Helper to find day/hour index
  const findDayIndex = (dayName: string) => days.findIndex(d => d.name === dayName);
  const findHourIndex = (hourName: string) => hours.findIndex(h => h.name === hourName);
  
  // Basic Compulsory Time
  constraintsList.querySelectorAll('ConstraintBasicCompulsoryTime').forEach((el) => {
    constraints.push({
      id: uuidv4(),
      type: 'BasicCompulsoryTime',
      weightPercentage: parseFloat(el.querySelector('Weight_Percentage')?.textContent || '100'),
      active: el.querySelector('Active')?.textContent?.trim() !== 'false',
      comments: el.querySelector('Comments')?.textContent?.trim() || '',
    });
  });
  
  // Break Times
  constraintsList.querySelectorAll('ConstraintBreakTimes').forEach((el) => {
    const times: { day: number; hour: number }[] = [];
    el.querySelectorAll('Break_Time').forEach((bt) => {
      const dayName = bt.querySelector('Day')?.textContent?.trim() || '';
      const hourName = bt.querySelector('Hour')?.textContent?.trim() || '';
      const dayIdx = findDayIndex(dayName);
      const hourIdx = findHourIndex(hourName);
      if (dayIdx >= 0 && hourIdx >= 0) {
        times.push({ day: dayIdx, hour: hourIdx });
      }
    });
    
    constraints.push({
      id: uuidv4(),
      type: 'BreakTimes',
      weightPercentage: parseFloat(el.querySelector('Weight_Percentage')?.textContent || '100'),
      active: el.querySelector('Active')?.textContent?.trim() !== 'false',
      times,
      comments: el.querySelector('Comments')?.textContent?.trim() || '',
    } as TimeConstraint);
  });
  
  // Teacher Max Hours Daily
  constraintsList.querySelectorAll('ConstraintTeacherMaxHoursDaily').forEach((el) => {
    constraints.push({
      id: uuidv4(),
      type: 'TeacherMaxHoursDaily',
      weightPercentage: parseFloat(el.querySelector('Weight_Percentage')?.textContent || '100'),
      active: el.querySelector('Active')?.textContent?.trim() !== 'false',
      teacherId: el.querySelector('Teacher')?.textContent?.trim() || '',
      maxHours: parseInt(el.querySelector('Maximum_Hours_Daily')?.textContent || '8', 10),
      comments: el.querySelector('Comments')?.textContent?.trim() || '',
    } as TimeConstraint);
  });
  
  // Teacher Max Days Per Week
  constraintsList.querySelectorAll('ConstraintTeacherMaxDaysPerWeek').forEach((el) => {
    constraints.push({
      id: uuidv4(),
      type: 'TeacherMaxDaysPerWeek',
      weightPercentage: parseFloat(el.querySelector('Weight_Percentage')?.textContent || '100'),
      active: el.querySelector('Active')?.textContent?.trim() !== 'false',
      teacherId: el.querySelector('Teacher')?.textContent?.trim() || '',
      maxDays: parseInt(el.querySelector('Max_Days_Per_Week')?.textContent || '5', 10),
      comments: el.querySelector('Comments')?.textContent?.trim() || '',
    } as TimeConstraint);
  });
  
  // Teacher Not Available Times
  constraintsList.querySelectorAll('ConstraintTeacherNotAvailableTimes').forEach((el) => {
    const times: { day: number; hour: number }[] = [];
    el.querySelectorAll('Not_Available_Time').forEach((nat) => {
      const dayName = nat.querySelector('Day')?.textContent?.trim() || '';
      const hourName = nat.querySelector('Hour')?.textContent?.trim() || '';
      const dayIdx = findDayIndex(dayName);
      const hourIdx = findHourIndex(hourName);
      if (dayIdx >= 0 && hourIdx >= 0) {
        times.push({ day: dayIdx, hour: hourIdx });
      }
    });
    
    constraints.push({
      id: uuidv4(),
      type: 'TeacherNotAvailableTimes',
      weightPercentage: parseFloat(el.querySelector('Weight_Percentage')?.textContent || '100'),
      active: el.querySelector('Active')?.textContent?.trim() !== 'false',
      teacherId: el.querySelector('Teacher')?.textContent?.trim() || '',
      times,
      comments: el.querySelector('Comments')?.textContent?.trim() || '',
    } as TimeConstraint);
  });
  
  // Min Days Between Activities
  constraintsList.querySelectorAll('ConstraintMinDaysBetweenActivities').forEach((el) => {
    const activityIds: string[] = [];
    el.querySelectorAll('Activity_Id').forEach(a => {
      const id = a.textContent?.trim();
      if (id) activityIds.push(id);
    });
    
    constraints.push({
      id: uuidv4(),
      type: 'MinDaysBetweenActivities',
      weightPercentage: parseFloat(el.querySelector('Weight_Percentage')?.textContent || '100'),
      active: el.querySelector('Active')?.textContent?.trim() !== 'false',
      activityIds,
      minDays: parseInt(el.querySelector('MinDays')?.textContent || '1', 10),
      consecutiveIfSameDay: el.querySelector('Consecutive_If_Same_Day')?.textContent?.trim() === 'true',
      comments: el.querySelector('Comments')?.textContent?.trim() || '',
    } as TimeConstraint);
  });
  
  return constraints;
}

function parseSpaceConstraints(doc: Document): SpaceConstraint[] {
  const constraints: SpaceConstraint[] = [];
  const constraintsList = doc.querySelector('Space_Constraints_List');
  if (!constraintsList) return constraints;
  
  // Basic Compulsory Space
  constraintsList.querySelectorAll('ConstraintBasicCompulsorySpace').forEach((el) => {
    constraints.push({
      id: uuidv4(),
      type: 'BasicCompulsorySpace',
      weightPercentage: parseFloat(el.querySelector('Weight_Percentage')?.textContent || '100'),
      active: el.querySelector('Active')?.textContent?.trim() !== 'false',
      comments: el.querySelector('Comments')?.textContent?.trim() || '',
    });
  });
  
  // Activity preferred room
  constraintsList.querySelectorAll('ConstraintActivityPreferredRoom').forEach((el) => {
    constraints.push({
      id: uuidv4(),
      type: 'ActivityPreferredRoom',
      weightPercentage: parseFloat(el.querySelector('Weight_Percentage')?.textContent || '100'),
      active: el.querySelector('Active')?.textContent?.trim() !== 'false',
      activityId: el.querySelector('Activity_Id')?.textContent?.trim() || '',
      roomId: el.querySelector('Room')?.textContent?.trim() || '',
      permanentlyLocked: el.querySelector('Permanently_Locked')?.textContent?.trim() === 'true',
      comments: el.querySelector('Comments')?.textContent?.trim() || '',
    } as SpaceConstraint);
  });
  
  // Subject preferred room
  constraintsList.querySelectorAll('ConstraintSubjectPreferredRoom').forEach((el) => {
    constraints.push({
      id: uuidv4(),
      type: 'SubjectPreferredRoom',
      weightPercentage: parseFloat(el.querySelector('Weight_Percentage')?.textContent || '100'),
      active: el.querySelector('Active')?.textContent?.trim() !== 'false',
      subjectId: el.querySelector('Subject')?.textContent?.trim() || '',
      roomId: el.querySelector('Room')?.textContent?.trim() || '',
      comments: el.querySelector('Comments')?.textContent?.trim() || '',
    } as SpaceConstraint);
  });
  
  return constraints;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Export timetable data to FET XML format
 */
export function exportToFETXml(data: FETFile): string {
  const modeNames = ['Official', 'Mornings-Afternoons', 'Block-Planning', 'Terms'];
  
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += `<fet version="${escapeXml(data.version || '6.5.0')}">\n\n`;
  
  xml += `<Mode>${modeNames[data.mode] || 'Official'}</Mode>\n\n`;
  xml += `<Institution_Name>${escapeXml(data.institutionName || '')}</Institution_Name>\n\n`;
  xml += `<Comments>${escapeXml(data.comments || '')}</Comments>\n\n`;
  
  // Days
  xml += '<Days_List>\n';
  xml += `<Number_of_Days>${data.daysOfTheWeek.length}</Number_of_Days>\n`;
  for (const day of data.daysOfTheWeek) {
    xml += '<Day>\n';
    xml += `\t<Name>${escapeXml(day.name)}</Name>\n`;
    if (day.longName) xml += `\t<Long_Name>${escapeXml(day.longName)}</Long_Name>\n`;
    xml += '</Day>\n';
  }
  xml += '</Days_List>\n\n';
  
  // Hours
  xml += '<Hours_List>\n';
  xml += `<Number_of_Hours>${data.hoursOfTheDay.length}</Number_of_Hours>\n`;
  for (const hour of data.hoursOfTheDay) {
    xml += '<Hour>\n';
    xml += `\t<Name>${escapeXml(hour.name)}</Name>\n`;
    if (hour.longName) xml += `\t<Long_Name>${escapeXml(hour.longName)}</Long_Name>\n`;
    xml += '</Hour>\n';
  }
  xml += '</Hours_List>\n\n';
  
  // Subjects
  xml += '<Subjects_List>\n';
  for (const subject of data.subjects) {
    xml += '<Subject>\n';
    xml += `\t<Name>${escapeXml(subject.name)}</Name>\n`;
    if (subject.longName) xml += `\t<Long_Name>${escapeXml(subject.longName)}</Long_Name>\n`;
    if (subject.code) xml += `\t<Code>${escapeXml(subject.code)}</Code>\n`;
    if (subject.comments) xml += `\t<Comments>${escapeXml(subject.comments)}</Comments>\n`;
    xml += '</Subject>\n';
  }
  xml += '</Subjects_List>\n\n';
  
  // Activity Tags
  xml += '<Activity_Tags_List>\n';
  for (const tag of data.activityTags) {
    xml += '<Activity_Tag>\n';
    xml += `\t<Name>${escapeXml(tag.name)}</Name>\n`;
    if (tag.longName) xml += `\t<Long_Name>${escapeXml(tag.longName)}</Long_Name>\n`;
    if (tag.code) xml += `\t<Code>${escapeXml(tag.code)}</Code>\n`;
    xml += `\t<Printable>${tag.printable ? 'true' : 'false'}</Printable>\n`;
    if (tag.comments) xml += `\t<Comments>${escapeXml(tag.comments)}</Comments>\n`;
    xml += '</Activity_Tag>\n';
  }
  xml += '</Activity_Tags_List>\n\n';
  
  // Teachers
  xml += '<Teachers_List>\n';
  for (const teacher of data.teachers) {
    xml += '<Teacher>\n';
    xml += `\t<Name>${escapeXml(teacher.name)}</Name>\n`;
    if (teacher.longName) xml += `\t<Long_Name>${escapeXml(teacher.longName)}</Long_Name>\n`;
    if (teacher.code) xml += `\t<Code>${escapeXml(teacher.code)}</Code>\n`;
    xml += `\t<Target_Number_of_Hours>${teacher.targetNumberOfHours}</Target_Number_of_Hours>\n`;
    if (teacher.qualifiedSubjects.length > 0) {
      xml += '\t<Qualified_Subjects>\n';
      for (const qs of teacher.qualifiedSubjects) {
        xml += `\t\t<Qualified_Subject>${escapeXml(qs)}</Qualified_Subject>\n`;
      }
      xml += '\t</Qualified_Subjects>\n';
    }
    if (teacher.comments) xml += `\t<Comments>${escapeXml(teacher.comments)}</Comments>\n`;
    xml += '</Teacher>\n';
  }
  xml += '</Teachers_List>\n\n';
  
  // Students (Years with Groups and Subgroups nested)
  xml += '<Students_List>\n';
  for (const year of data.studentsYears) {
    xml += '<Year>\n';
    xml += `\t<Name>${escapeXml(year.name)}</Name>\n`;
    if (year.longName) xml += `\t<Long_Name>${escapeXml(year.longName)}</Long_Name>\n`;
    if (year.code) xml += `\t<Code>${escapeXml(year.code)}</Code>\n`;
    xml += `\t<Number_of_Students>${year.numberOfStudents}</Number_of_Students>\n`;
    if (year.comments) xml += `\t<Comments>${escapeXml(year.comments)}</Comments>\n`;
    
    // Find groups for this year
    const yearGroups = data.studentsGroups.filter(g => year.groups.includes(g.name));
    for (const group of yearGroups) {
      xml += '\t<Group>\n';
      xml += `\t\t<Name>${escapeXml(group.name)}</Name>\n`;
      if (group.longName) xml += `\t\t<Long_Name>${escapeXml(group.longName)}</Long_Name>\n`;
      if (group.code) xml += `\t\t<Code>${escapeXml(group.code)}</Code>\n`;
      xml += `\t\t<Number_of_Students>${group.numberOfStudents}</Number_of_Students>\n`;
      if (group.comments) xml += `\t\t<Comments>${escapeXml(group.comments)}</Comments>\n`;
      
      // Find subgroups for this group
      const groupSubgroups = data.studentsSubgroups.filter(s => group.subgroups.includes(s.name));
      for (const subgroup of groupSubgroups) {
        xml += '\t\t<Subgroup>\n';
        xml += `\t\t\t<Name>${escapeXml(subgroup.name)}</Name>\n`;
        if (subgroup.longName) xml += `\t\t\t<Long_Name>${escapeXml(subgroup.longName)}</Long_Name>\n`;
        if (subgroup.code) xml += `\t\t\t<Code>${escapeXml(subgroup.code)}</Code>\n`;
        xml += `\t\t\t<Number_of_Students>${subgroup.numberOfStudents}</Number_of_Students>\n`;
        if (subgroup.comments) xml += `\t\t\t<Comments>${escapeXml(subgroup.comments)}</Comments>\n`;
        xml += '\t\t</Subgroup>\n';
      }
      
      xml += '\t</Group>\n';
    }
    
    xml += '</Year>\n';
  }
  xml += '</Students_List>\n\n';
  
  // Activities
  xml += '<Activities_List>\n';
  for (const activity of data.activities) {
    xml += '<Activity>\n';
    for (const teacherId of activity.teacherIds) {
      xml += `\t<Teacher>${escapeXml(teacherId)}</Teacher>\n`;
    }
    xml += `\t<Subject>${escapeXml(activity.subjectId)}</Subject>\n`;
    for (const tagId of activity.activityTagIds) {
      xml += `\t<Activity_Tag>${escapeXml(tagId)}</Activity_Tag>\n`;
    }
    for (const studentId of activity.studentSetIds) {
      xml += `\t<Students>${escapeXml(studentId)}</Students>\n`;
    }
    xml += `\t<Duration>${activity.duration}</Duration>\n`;
    xml += `\t<Total_Duration>${activity.totalDuration}</Total_Duration>\n`;
    xml += `\t<Activity_Group_Id>${activity.activityGroupId}</Activity_Group_Id>\n`;
    xml += `\t<Active>${activity.active ? 'true' : 'false'}</Active>\n`;
    if (activity.comments) xml += `\t<Comments>${escapeXml(activity.comments)}</Comments>\n`;
    xml += '</Activity>\n';
  }
  xml += '</Activities_List>\n\n';
  
  // Buildings
  xml += '<Buildings_List>\n';
  for (const building of data.buildings) {
    xml += '<Building>\n';
    xml += `\t<Name>${escapeXml(building.name)}</Name>\n`;
    if (building.longName) xml += `\t<Long_Name>${escapeXml(building.longName)}</Long_Name>\n`;
    if (building.code) xml += `\t<Code>${escapeXml(building.code)}</Code>\n`;
    if (building.comments) xml += `\t<Comments>${escapeXml(building.comments)}</Comments>\n`;
    xml += '</Building>\n';
  }
  xml += '</Buildings_List>\n\n';
  
  // Rooms
  xml += '<Rooms_List>\n';
  for (const room of data.rooms) {
    xml += '<Room>\n';
    xml += `\t<Name>${escapeXml(room.name)}</Name>\n`;
    if (room.longName) xml += `\t<Long_Name>${escapeXml(room.longName)}</Long_Name>\n`;
    if (room.code) xml += `\t<Code>${escapeXml(room.code)}</Code>\n`;
    xml += `\t<Capacity>${room.capacity}</Capacity>\n`;
    if (room.buildingId) xml += `\t<Building>${escapeXml(room.buildingId)}</Building>\n`;
    xml += `\t<Virtual>${room.isVirtual ? 'true' : 'false'}</Virtual>\n`;
    if (room.comments) xml += `\t<Comments>${escapeXml(room.comments)}</Comments>\n`;
    xml += '</Room>\n';
  }
  xml += '</Rooms_List>\n\n';
  
  // Time Constraints
  xml += '<Time_Constraints_List>\n';
  for (const constraint of data.timeConstraints) {
    const c = constraint as any;
    
    switch (constraint.type) {
      case 'BasicCompulsoryTime':
        xml += '<ConstraintBasicCompulsoryTime>\n';
        xml += `\t<Weight_Percentage>${constraint.weightPercentage}</Weight_Percentage>\n`;
        xml += `\t<Active>${constraint.active ? 'true' : 'false'}</Active>\n`;
        if (constraint.comments) xml += `\t<Comments>${escapeXml(constraint.comments)}</Comments>\n`;
        xml += '</ConstraintBasicCompulsoryTime>\n';
        break;
        
      case 'BreakTimes':
        xml += '<ConstraintBreakTimes>\n';
        xml += `\t<Weight_Percentage>${constraint.weightPercentage}</Weight_Percentage>\n`;
        xml += `\t<Number_of_Break_Times>${c.times?.length || 0}</Number_of_Break_Times>\n`;
        for (const time of (c.times || [])) {
          xml += '\t<Break_Time>\n';
          xml += `\t\t<Day>${data.daysOfTheWeek[time.day]?.name || ''}</Day>\n`;
          xml += `\t\t<Hour>${data.hoursOfTheDay[time.hour]?.name || ''}</Hour>\n`;
          xml += '\t</Break_Time>\n';
        }
        xml += `\t<Active>${constraint.active ? 'true' : 'false'}</Active>\n`;
        if (constraint.comments) xml += `\t<Comments>${escapeXml(constraint.comments)}</Comments>\n`;
        xml += '</ConstraintBreakTimes>\n';
        break;
        
      case 'TeacherNotAvailableTimes':
        xml += '<ConstraintTeacherNotAvailableTimes>\n';
        xml += `\t<Weight_Percentage>${constraint.weightPercentage}</Weight_Percentage>\n`;
        xml += `\t<Teacher>${escapeXml(c.teacherId || '')}</Teacher>\n`;
        xml += `\t<Number_of_Not_Available_Times>${c.times?.length || 0}</Number_of_Not_Available_Times>\n`;
        for (const time of (c.times || [])) {
          xml += '\t<Not_Available_Time>\n';
          xml += `\t\t<Day>${data.daysOfTheWeek[time.day]?.name || ''}</Day>\n`;
          xml += `\t\t<Hour>${data.hoursOfTheDay[time.hour]?.name || ''}</Hour>\n`;
          xml += '\t</Not_Available_Time>\n';
        }
        xml += `\t<Active>${constraint.active ? 'true' : 'false'}</Active>\n`;
        if (constraint.comments) xml += `\t<Comments>${escapeXml(constraint.comments)}</Comments>\n`;
        xml += '</ConstraintTeacherNotAvailableTimes>\n';
        break;
        
      case 'TeacherMaxDaysPerWeek':
        xml += '<ConstraintTeacherMaxDaysPerWeek>\n';
        xml += `\t<Weight_Percentage>${constraint.weightPercentage}</Weight_Percentage>\n`;
        xml += `\t<Teacher>${escapeXml(c.teacherId || '')}</Teacher>\n`;
        xml += `\t<Max_Days_Per_Week>${c.maxDays || 5}</Max_Days_Per_Week>\n`;
        xml += `\t<Active>${constraint.active ? 'true' : 'false'}</Active>\n`;
        if (constraint.comments) xml += `\t<Comments>${escapeXml(constraint.comments)}</Comments>\n`;
        xml += '</ConstraintTeacherMaxDaysPerWeek>\n';
        break;
    }
  }
  xml += '</Time_Constraints_List>\n\n';
  
  // Space Constraints
  xml += '<Space_Constraints_List>\n';
  for (const constraint of data.spaceConstraints) {
    const c = constraint as any;
    
    switch (constraint.type) {
      case 'BasicCompulsorySpace':
        xml += '<ConstraintBasicCompulsorySpace>\n';
        xml += `\t<Weight_Percentage>${constraint.weightPercentage}</Weight_Percentage>\n`;
        xml += `\t<Active>${constraint.active ? 'true' : 'false'}</Active>\n`;
        if (constraint.comments) xml += `\t<Comments>${escapeXml(constraint.comments)}</Comments>\n`;
        xml += '</ConstraintBasicCompulsorySpace>\n';
        break;
        
      case 'ActivityPreferredRoom':
        xml += '<ConstraintActivityPreferredRoom>\n';
        xml += `\t<Weight_Percentage>${constraint.weightPercentage}</Weight_Percentage>\n`;
        xml += `\t<Activity_Id>${escapeXml(c.activityId || '')}</Activity_Id>\n`;
        xml += `\t<Room>${escapeXml(c.roomId || '')}</Room>\n`;
        xml += `\t<Permanently_Locked>${c.permanentlyLocked ? 'true' : 'false'}</Permanently_Locked>\n`;
        xml += `\t<Active>${constraint.active ? 'true' : 'false'}</Active>\n`;
        if (constraint.comments) xml += `\t<Comments>${escapeXml(constraint.comments)}</Comments>\n`;
        xml += '</ConstraintActivityPreferredRoom>\n';
        break;
        
      case 'SubjectPreferredRoom':
        xml += '<ConstraintSubjectPreferredRoom>\n';
        xml += `\t<Weight_Percentage>${constraint.weightPercentage}</Weight_Percentage>\n`;
        xml += `\t<Subject>${escapeXml(c.subjectId || '')}</Subject>\n`;
        xml += `\t<Room>${escapeXml(c.roomId || '')}</Room>\n`;
        xml += `\t<Active>${constraint.active ? 'true' : 'false'}</Active>\n`;
        if (constraint.comments) xml += `\t<Comments>${escapeXml(constraint.comments)}</Comments>\n`;
        xml += '</ConstraintSubjectPreferredRoom>\n';
        break;
    }
  }
  xml += '</Space_Constraints_List>\n\n';
  
  xml += '</fet>\n';
  
  return xml;
}

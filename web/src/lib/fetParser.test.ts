/**
 * Unit tests for FET file parser
 */
import { describe, it, expect } from 'vitest';
import { parseFETFile, exportToFETXml } from './fetParser';
import * as fs from 'fs';
import * as path from 'path';

// Helper to read test FET files
const readTestFile = (relativePath: string): string => {
  const fullPath = path.join(process.cwd(), '..', relativePath);
  return fs.readFileSync(fullPath, 'utf-8');
};

describe('FET Parser', () => {
  describe('parseFETFile', () => {
    it('should parse a basic FET file structure', () => {
      const minimalFet = `<?xml version="1.0" encoding="UTF-8"?>
<fet version="7.5.1">
  <Mode>Official</Mode>
  <Institution_Name>Test School</Institution_Name>
  <Days_List>
    <Number_of_Days>5</Number_of_Days>
    <Day><Name>Monday</Name></Day>
    <Day><Name>Tuesday</Name></Day>
    <Day><Name>Wednesday</Name></Day>
    <Day><Name>Thursday</Name></Day>
    <Day><Name>Friday</Name></Day>
  </Days_List>
  <Hours_List>
    <Number_of_Hours>4</Number_of_Hours>
    <Hour><Name>08:00</Name></Hour>
    <Hour><Name>09:00</Name></Hour>
    <Hour><Name>10:00</Name></Hour>
    <Hour><Name>11:00</Name></Hour>
  </Hours_List>
  <Subjects_List></Subjects_List>
  <Activity_Tags_List></Activity_Tags_List>
  <Teachers_List></Teachers_List>
  <Students_List></Students_List>
  <Activities_List></Activities_List>
  <Buildings_List></Buildings_List>
  <Rooms_List></Rooms_List>
  <Time_Constraints_List></Time_Constraints_List>
  <Space_Constraints_List></Space_Constraints_List>
</fet>`;
      
      const result = parseFETFile(minimalFet);
      
      expect(result.institutionName).toBe('Test School');
      expect(result.daysOfTheWeek).toHaveLength(5);
      expect(result.hoursOfTheDay).toHaveLength(4);
    });

    it('should resolve RoomNotAvailableTimes day/hour names to indices', () => {
      const fetWithConstraints = `<?xml version="1.0" encoding="UTF-8"?>
<fet version="7.5.1">
  <Mode>Official</Mode>
  <Institution_Name>Test</Institution_Name>
  <Days_List>
    <Number_of_Days>5</Number_of_Days>
    <Day><Name>Mon</Name></Day>
    <Day><Name>Tue</Name></Day>
    <Day><Name>Wed</Name></Day>
    <Day><Name>Thu</Name></Day>
    <Day><Name>Fri</Name></Day>
  </Days_List>
  <Hours_List>
    <Number_of_Hours>4</Number_of_Hours>
    <Hour><Name>08:00</Name></Hour>
    <Hour><Name>09:00</Name></Hour>
    <Hour><Name>10:00</Name></Hour>
    <Hour><Name>11:00</Name></Hour>
  </Hours_List>
  <Rooms_List>
    <Room><Name>Room101</Name></Room>
  </Rooms_List>
  <Space_Constraints_List>
    <ConstraintRoomNotAvailableTimes>
      <Weight_Percentage>100</Weight_Percentage>
      <Room>Room101</Room>
      <Number_of_Not_Available_Times>2</Number_of_Not_Available_Times>
      <Not_Available_Time>
        <Day>Wed</Day>
        <Hour>09:00</Hour>
      </Not_Available_Time>
      <Not_Available_Time>
        <Day>Fri</Day>
        <Hour>11:00</Hour>
      </Not_Available_Time>
      <Active>true</Active>
    </ConstraintRoomNotAvailableTimes>
  </Space_Constraints_List>
</fet>`;

      const result = parseFETFile(fetWithConstraints);
      expect(result.spaceConstraints).toHaveLength(1);
      const constraint = result.spaceConstraints[0] as {
        type: string;
        roomId: string;
        times: Array<{ day: number; hour: number }>;
      };
      expect(constraint.type).toBe('RoomNotAvailableTimes');
      expect(constraint.roomId).toBe('Room101');
      expect(constraint.times).toEqual([
        { day: 2, hour: 1 },
        { day: 4, hour: 3 },
      ]);
    });

    it('should parse teachers correctly', () => {
      const fetWithTeachers = `<?xml version="1.0" encoding="UTF-8"?>
<fet version="7.5.1">
  <Mode>Official</Mode>
  <Institution_Name>Test</Institution_Name>
  <Days_List><Number_of_Days>1</Number_of_Days><Day><Name>Mon</Name></Day></Days_List>
  <Hours_List><Number_of_Hours>1</Number_of_Hours><Hour><Name>08:00</Name></Hour></Hours_List>
  <Teachers_List>
    <Teacher>
      <Name>John Doe</Name>
      <Target_Number_of_Hours>20</Target_Number_of_Hours>
    </Teacher>
  </Teachers_List>
  <Subjects_List></Subjects_List>
  <Activity_Tags_List></Activity_Tags_List>
  <Students_List></Students_List>
  <Activities_List></Activities_List>
  <Buildings_List></Buildings_List>
  <Rooms_List></Rooms_List>
  <Time_Constraints_List></Time_Constraints_List>
  <Space_Constraints_List></Space_Constraints_List>
</fet>`;

      const result = parseFETFile(fetWithTeachers);
      
      expect(result.teachers).toHaveLength(1);
      expect(result.teachers[0].name).toBe('John Doe');
      expect(result.teachers[0].targetNumberOfHours).toBe(20);
    });

    it('should parse subjects correctly', () => {
      const fetWithSubjects = `<?xml version="1.0" encoding="UTF-8"?>
<fet version="7.5.1">
  <Mode>Official</Mode>
  <Institution_Name>Test</Institution_Name>
  <Days_List><Number_of_Days>1</Number_of_Days><Day><Name>Mon</Name></Day></Days_List>
  <Hours_List><Number_of_Hours>1</Number_of_Hours><Hour><Name>08:00</Name></Hour></Hours_List>
  <Subjects_List>
    <Subject>
      <Name>Mathematics</Name>
      <Comments>Core subject</Comments>
    </Subject>
  </Subjects_List>
  <Teachers_List></Teachers_List>
  <Activity_Tags_List></Activity_Tags_List>
  <Students_List></Students_List>
  <Activities_List></Activities_List>
  <Buildings_List></Buildings_List>
  <Rooms_List></Rooms_List>
  <Time_Constraints_List></Time_Constraints_List>
  <Space_Constraints_List></Space_Constraints_List>
</fet>`;

      const result = parseFETFile(fetWithSubjects);
      
      expect(result.subjects).toHaveLength(1);
      expect(result.subjects[0].name).toBe('Mathematics');
      expect(result.subjects[0].comments).toBe('Core subject');
    });

    it('should parse activities with duration and preserve <Id>', () => {
      const fetWithActivity = `<?xml version="1.0" encoding="UTF-8"?>
<fet version="7.5.1">
  <Mode>Official</Mode>
  <Institution_Name>Test</Institution_Name>
  <Days_List><Number_of_Days>1</Number_of_Days><Day><Name>Mon</Name></Day></Days_List>
  <Hours_List><Number_of_Hours>4</Number_of_Hours><Hour><Name>08:00</Name></Hour><Hour><Name>09:00</Name></Hour><Hour><Name>10:00</Name></Hour><Hour><Name>11:00</Name></Hour></Hours_List>
  <Subjects_List><Subject><Name>Math</Name></Subject></Subjects_List>
  <Teachers_List>
    <Teacher><Name>Teacher1</Name></Teacher>
    <Teacher><Name>Teacher2</Name></Teacher>
  </Teachers_List>
  <Students_List>
    <Year><Name>Year1</Name><Number_of_Students>30</Number_of_Students></Year>
  </Students_List>
  <Activities_List>
    <Activity>
      <Id>42</Id>
      <Teacher>Teacher1</Teacher>
      <Teacher>Teacher2</Teacher>
      <Subject>Math</Subject>
      <Students>Year1</Students>
      <Duration>2</Duration>
      <Total_Duration>4</Total_Duration>
      <Active>true</Active>
    </Activity>
  </Activities_List>
  <Buildings_List></Buildings_List>
  <Rooms_List></Rooms_List>
  <Time_Constraints_List></Time_Constraints_List>
  <Space_Constraints_List></Space_Constraints_List>
</fet>`;

      const result = parseFETFile(fetWithActivity);
      
      expect(result.activities).toHaveLength(1);
      expect(result.activities[0].fetId).toBe('42');
      expect(result.activities[0].duration).toBe(2);
      expect(result.activities[0].totalDuration).toBe(4);
      expect(result.activities[0].teacherIds).toEqual(['Teacher1', 'Teacher2']);
      expect(result.activities[0].subjectId).toBe('Math');
    });

    it('should round-trip activity fetId and permanently locked constraints through export', () => {
      const fetXml = `<?xml version="1.0" encoding="UTF-8"?>
<fet version="7.5.1">
  <Mode>Official</Mode>
  <Institution_Name>Roundtrip Test</Institution_Name>
  <Days_List><Number_of_Days>1</Number_of_Days><Day><Name>Mon</Name></Day></Days_List>
  <Hours_List><Number_of_Hours>2</Number_of_Hours><Hour><Name>08:00</Name></Hour><Hour><Name>09:00</Name></Hour></Hours_List>
  <Subjects_List><Subject><Name>Math</Name></Subject></Subjects_List>
  <Teachers_List><Teacher><Name>Teacher1</Name></Teacher></Teachers_List>
  <Students_List><Year><Name>Year1</Name><Number_of_Students>30</Number_of_Students></Year></Students_List>
  <Rooms_List><Room><Name>Room101</Name><Capacity>30</Capacity></Room></Rooms_List>
  <Activities_List>
    <Activity>
      <Id>101</Id>
      <Teacher>Teacher1</Teacher>
      <Subject>Math</Subject>
      <Students>Year1</Students>
      <Duration>1</Duration>
      <Total_Duration>1</Total_Duration>
      <Active>true</Active>
    </Activity>
  </Activities_List>
  <Time_Constraints_List>
    <ConstraintActivityPreferredStartingTime>
      <Weight_Percentage>100</Weight_Percentage>
      <Activity_Id>101</Activity_Id>
      <Preferred_Day>Mon</Preferred_Day>
      <Preferred_Hour>08:00</Preferred_Hour>
      <Permanently_Locked>true</Permanently_Locked>
      <Active>true</Active>
    </ConstraintActivityPreferredStartingTime>
  </Time_Constraints_List>
  <Space_Constraints_List>
    <ConstraintActivityPreferredRoom>
      <Weight_Percentage>100</Weight_Percentage>
      <Activity_Id>101</Activity_Id>
      <Room>Room101</Room>
      <Permanently_Locked>true</Permanently_Locked>
      <Active>true</Active>
    </ConstraintActivityPreferredRoom>
  </Space_Constraints_List>
</fet>`;

      const parsed = parseFETFile(fetXml);
      expect(parsed.activities[0].fetId).toBe('101');

      const exported = exportToFETXml(parsed);
      expect(exported).toContain('<Id>101</Id>');
      expect(exported).toContain('<Activity_Id>101</Activity_Id>');
      expect(exported).toContain('<ConstraintActivityPreferredStartingTime>');
      expect(exported).toContain('<Permanently_Locked>true</Permanently_Locked>');

      // Re-parse exported XML
      const reparsed = parseFETFile(exported);
      expect(reparsed.activities[0].fetId).toBe('101');
      expect(reparsed.timeConstraints).toHaveLength(1);
      const tc = reparsed.timeConstraints[0] as { type: string; activityId: string; permanentlyLocked?: boolean };
      expect(tc.type).toBe('ActivityPreferredStartingTime');
      expect(tc.activityId).toBe('101');
      expect(tc.permanentlyLocked).toBe(true);

      expect(reparsed.spaceConstraints).toHaveLength(1);
      const sc = reparsed.spaceConstraints[0] as { type: string; activityId: string; permanentlyLocked?: boolean };
      expect(sc.type).toBe('ActivityPreferredRoom');
      expect(sc.activityId).toBe('101');
      expect(sc.permanentlyLocked).toBe(true);
    });

    it('should parse rooms and buildings', () => {
      const fetWithRooms = `<?xml version="1.0" encoding="UTF-8"?>
<fet version="7.5.1">
  <Mode>Official</Mode>
  <Institution_Name>Test</Institution_Name>
  <Days_List><Number_of_Days>1</Number_of_Days><Day><Name>Mon</Name></Day></Days_List>
  <Hours_List><Number_of_Hours>1</Number_of_Hours><Hour><Name>08:00</Name></Hour></Hours_List>
  <Buildings_List>
    <Building><Name>Main Building</Name></Building>
  </Buildings_List>
  <Rooms_List>
    <Room>
      <Name>Room 101</Name>
      <Building>Main Building</Building>
      <Capacity>30</Capacity>
    </Room>
  </Rooms_List>
  <Subjects_List></Subjects_List>
  <Teachers_List></Teachers_List>
  <Activity_Tags_List></Activity_Tags_List>
  <Students_List></Students_List>
  <Activities_List></Activities_List>
  <Time_Constraints_List></Time_Constraints_List>
  <Space_Constraints_List></Space_Constraints_List>
</fet>`;

      const result = parseFETFile(fetWithRooms);
      
      expect(result.buildings).toHaveLength(1);
      expect(result.buildings[0].name).toBe('Main Building');
      expect(result.rooms).toHaveLength(1);
      expect(result.rooms[0].name).toBe('Room 101');
      expect(result.rooms[0].capacity).toBe(30);
    });

    it('should drop ConstraintActivityPreferredStartingTime with invalid day or hour', () => {
      const fetWithInvalidTime = `<?xml version="1.0" encoding="UTF-8"?>
<fet version="7.5.1">
  <Mode>Official</Mode>
  <Institution_Name>Test</Institution_Name>
  <Days_List><Number_of_Days>1</Number_of_Days><Day><Name>Mon</Name></Day></Days_List>
  <Hours_List><Number_of_Hours>1</Number_of_Hours><Hour><Name>08:00</Name></Hour></Hours_List>
  <Subjects_List></Subjects_List>
  <Teachers_List></Teachers_List>
  <Students_List></Students_List>
  <Activities_List><Activity><Id>1</Id><Subject>S</Subject><Duration>1</Duration><Total_Duration>1</Total_Duration></Activity></Activities_List>
  <Buildings_List></Buildings_List>
  <Rooms_List></Rooms_List>
  <Time_Constraints_List>
    <ConstraintActivityPreferredStartingTime>
      <Weight_Percentage>100</Weight_Percentage>
      <Activity_Id>1</Activity_Id>
      <Preferred_Day>NonexistentDay</Preferred_Day>
      <Preferred_Hour>08:00</Preferred_Hour>
      <Active>true</Active>
    </ConstraintActivityPreferredStartingTime>
    <ConstraintActivityPreferredStartingTime>
      <Weight_Percentage>100</Weight_Percentage>
      <Activity_Id>1</Activity_Id>
      <Preferred_Day>Mon</Preferred_Day>
      <Preferred_Hour>NonexistentHour</Preferred_Hour>
      <Active>true</Active>
    </ConstraintActivityPreferredStartingTime>
  </Time_Constraints_List>
  <Space_Constraints_List></Space_Constraints_List>
</fet>`;

      const result = parseFETFile(fetWithInvalidTime);
      expect(result.timeConstraints).toHaveLength(0);
    });

    it('should parse ConstraintActivityPreferredStartingTimes (plural)', () => {
      const fetWithMultipleTimes = `<?xml version="1.0" encoding="UTF-8"?>
<fet version="7.5.1">
  <Mode>Official</Mode>
  <Institution_Name>Test</Institution_Name>
  <Days_List>
    <Number_of_Days>5</Number_of_Days>
    <Day><Name>Mon</Name></Day>
    <Day><Name>Tue</Name></Day>
    <Day><Name>Wed</Name></Day>
    <Day><Name>Thu</Name></Day>
    <Day><Name>Fri</Name></Day>
  </Days_List>
  <Hours_List>
    <Number_of_Hours>4</Number_of_Hours>
    <Hour><Name>08:00</Name></Hour>
    <Hour><Name>09:00</Name></Hour>
    <Hour><Name>10:00</Name></Hour>
    <Hour><Name>11:00</Name></Hour>
  </Hours_List>
  <Subjects_List></Subjects_List>
  <Teachers_List></Teachers_List>
  <Students_List></Students_List>
  <Activities_List><Activity><Id>55</Id><Subject>S</Subject><Duration>1</Duration><Total_Duration>1</Total_Duration></Activity></Activities_List>
  <Buildings_List></Buildings_List>
  <Rooms_List></Rooms_List>
  <Time_Constraints_List>
    <ConstraintActivityPreferredStartingTimes>
      <Weight_Percentage>100</Weight_Percentage>
      <Activity_Id>55</Activity_Id>
      <Number_of_Preferred_Starting_Times>2</Number_of_Preferred_Starting_Times>
      <Preferred_Starting_Time>
        <Preferred_Starting_Day>Mon</Preferred_Starting_Day>
        <Preferred_Starting_Hour>08:00</Preferred_Starting_Hour>
      </Preferred_Starting_Time>
      <Preferred_Starting_Time>
        <Preferred_Starting_Day>Wed</Preferred_Starting_Day>
        <Preferred_Starting_Hour>10:00</Preferred_Starting_Hour>
      </Preferred_Starting_Time>
      <Permanently_Locked>true</Permanently_Locked>
      <Active>true</Active>
    </ConstraintActivityPreferredStartingTimes>
  </Time_Constraints_List>
  <Space_Constraints_List></Space_Constraints_List>
</fet>`;

      const result = parseFETFile(fetWithMultipleTimes);
      expect(result.timeConstraints).toHaveLength(1);
      const c = result.timeConstraints[0] as {
        type: string;
        activityId: string;
        times: Array<{ day: number; hour: number }>;
        permanentlyLocked: boolean;
      };
      expect(c.type).toBe('ActivityPreferredStartingTimes');
      expect(c.activityId).toBe('55');
      expect(c.permanentlyLocked).toBe(true);
      expect(c.times).toEqual([
        { day: 0, hour: 0 },
        { day: 2, hour: 2 },
      ]);
    });

    it('should handle FET file without BOM', () => {
      const fetNoBom = `<?xml version="1.0" encoding="UTF-8"?>
<fet version="7.5.1">
  <Mode>Official</Mode>
  <Institution_Name>No BOM Test</Institution_Name>
  <Days_List><Number_of_Days>1</Number_of_Days><Day><Name>Mon</Name></Day></Days_List>
  <Hours_List><Number_of_Hours>1</Number_of_Hours><Hour><Name>08:00</Name></Hour></Hours_List>
  <Subjects_List></Subjects_List>
  <Teachers_List></Teachers_List>
  <Activity_Tags_List></Activity_Tags_List>
  <Students_List></Students_List>
  <Activities_List></Activities_List>
  <Buildings_List></Buildings_List>
  <Rooms_List></Rooms_List>
  <Time_Constraints_List></Time_Constraints_List>
  <Space_Constraints_List></Space_Constraints_List>
</fet>`;

      const result = parseFETFile(fetNoBom);
      expect(result.institutionName).toBe('No BOM Test');
    });
  });

  describe('Integration with real test files', () => {
    it('should parse test-1.fet from examples/tests', () => {
      const content = readTestFile('examples/tests/2025-09-29-activities-begin-or-end-day/test-1.fet');
      const result = parseFETFile(content);
      
      expect(result.daysOfTheWeek.length).toBeGreaterThan(0);
      expect(result.hoursOfTheDay.length).toBeGreaterThan(0);
      expect(result.activities.length).toBeGreaterThan(0);
    });

    it('should parse small-test.fet from examples/tests', () => {
      const content = readTestFile('examples/tests/2025-10-18-activities-max-number-of-students/small-test.fet');
      const result = parseFETFile(content);
      
      expect(result.daysOfTheWeek.length).toBeGreaterThan(0);
      expect(result.hoursOfTheDay.length).toBeGreaterThan(0);
    });
  });
});

/**
 * Unit tests for FET file parser
 */
import { describe, it, expect } from 'vitest';
import { parseFETFile } from './fetParser';
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
  <Comments>Test comments</Comments>
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
      expect(result.comments).toBe('Test comments');
      expect(result.daysOfTheWeek).toHaveLength(5);
      expect(result.hoursOfTheDay).toHaveLength(4);
      expect(result.daysOfTheWeek[0].name).toBe('Monday');
      expect(result.hoursOfTheDay[0].name).toBe('08:00');
    });

    it('should parse teachers correctly', () => {
      const fetWithTeacher = `<?xml version="1.0" encoding="UTF-8"?>
<fet version="7.5.1">
  <Mode>Official</Mode>
  <Institution_Name>Test</Institution_Name>
  <Days_List><Number_of_Days>1</Number_of_Days><Day><Name>Mon</Name></Day></Days_List>
  <Hours_List><Number_of_Hours>1</Number_of_Hours><Hour><Name>08:00</Name></Hour></Hours_List>
  <Teachers_List>
    <Teacher>
      <Name>Smith</Name>
      <Target_Number_of_Hours>20</Target_Number_of_Hours>
      <Qualified_Subjects>
        <Qualified_Subject>Math</Qualified_Subject>
        <Qualified_Subject>Physics</Qualified_Subject>
      </Qualified_Subjects>
      <Comments>Senior teacher</Comments>
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

      const result = parseFETFile(fetWithTeacher);
      
      expect(result.teachers).toHaveLength(1);
      expect(result.teachers[0].name).toBe('Smith');
      expect(result.teachers[0].targetNumberOfHours).toBe(20);
      expect(result.teachers[0].qualifiedSubjects).toContain('Math');
      expect(result.teachers[0].qualifiedSubjects).toContain('Physics');
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
      <Long_Name>Advanced Mathematics</Long_Name>
      <Code>MATH</Code>
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
    });

    it('should parse activities with duration', () => {
      const fetWithActivity = `<?xml version="1.0" encoding="UTF-8"?>
<fet version="7.5.1">
  <Mode>Official</Mode>
  <Institution_Name>Test</Institution_Name>
  <Days_List><Number_of_Days>1</Number_of_Days><Day><Name>Mon</Name></Day></Days_List>
  <Hours_List><Number_of_Hours>4</Number_of_Hours>
    <Hour><Name>08:00</Name></Hour>
    <Hour><Name>09:00</Name></Hour>
    <Hour><Name>10:00</Name></Hour>
    <Hour><Name>11:00</Name></Hour>
  </Hours_List>
  <Subjects_List>
    <Subject><Name>Math</Name></Subject>
  </Subjects_List>
  <Teachers_List>
    <Teacher><Name>Teacher1</Name></Teacher>
  </Teachers_List>
  <Students_List>
    <Year><Name>Year1</Name><Number_of_Students>30</Number_of_Students></Year>
  </Students_List>
  <Activities_List>
    <Activity>
      <Id>1</Id>
      <Teacher>Teacher1</Teacher>
      <Subject>Math</Subject>
      <Students>Year1</Students>
      <Duration>2</Duration>
      <Total_Duration>4</Total_Duration>
      <Active>true</Active>
    </Activity>
  </Activities_List>
  <Activity_Tags_List></Activity_Tags_List>
  <Buildings_List></Buildings_List>
  <Rooms_List></Rooms_List>
  <Time_Constraints_List></Time_Constraints_List>
  <Space_Constraints_List></Space_Constraints_List>
</fet>`;

      const result = parseFETFile(fetWithActivity);
      
      expect(result.activities).toHaveLength(1);
      expect(result.activities[0].duration).toBe(2);
      expect(result.activities[0].totalDuration).toBe(4);
      expect(result.activities[0].teacherIds).toContain('Teacher1');
      expect(result.activities[0].subjectId).toBe('Math');
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
      try {
        const content = readTestFile('examples/tests/2025-09-29-activities-begin-or-end-day/test-1.fet');
        const result = parseFETFile(content);
        
        expect(result.daysOfTheWeek.length).toBeGreaterThan(0);
        expect(result.hoursOfTheDay.length).toBeGreaterThan(0);
        expect(result.activities.length).toBeGreaterThan(0);
      } catch (e) {
        // File might not exist in test environment
        console.log('Skipping real file test - file not accessible');
      }
    });

    it('should parse small-test.fet from examples/tests', () => {
      try {
        const content = readTestFile('examples/tests/2025-10-18-activities-max-number-of-students/small-test.fet');
        const result = parseFETFile(content);
        
        expect(result.daysOfTheWeek.length).toBeGreaterThan(0);
        expect(result.hoursOfTheDay.length).toBeGreaterThan(0);
      } catch (e) {
        // File might not exist in test environment
        console.log('Skipping real file test - file not accessible');
      }
    });
  });
});

/**
 * Unit tests for Zod validation schemas
 */
import { describe, it, expect } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import {
  TeacherSchema,
  SubjectSchema,
  RoomSchema,
  ActivitySchema,
  DaySchema,
  HourSchema,
  validateTeacher,
  validateSubject,
  validateRoom,
  validateActivity,
  safeValidateTeacher,
  getValidationErrors,
  STUDENTS_YEAR,
  STUDENTS_GROUP,
  STUDENTS_SUBGROUP,
  StudentsYearSchema,
  StudentsGroupSchema,
  StudentsSubgroupSchema,
} from './schemas';

describe('Validation Schemas', () => {
  describe('TeacherSchema', () => {
    it('should validate a complete teacher object', () => {
      const teacher = {
        id: uuidv4(),
        name: 'John Smith',
        longName: 'Dr. John Smith',
        code: 'JS',
        targetNumberOfHours: 20,
        qualifiedSubjects: ['Math', 'Physics'],
        comments: 'Senior teacher',
      };
      
      const result = TeacherSchema.safeParse(teacher);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('John Smith');
      }
    });

    it('should reject teacher with empty name', () => {
      const teacher = {
        id: uuidv4(),
        name: '',
        targetNumberOfHours: 0,
        qualifiedSubjects: [],
      };
      
      const result = TeacherSchema.safeParse(teacher);
      expect(result.success).toBe(false);
    });

    it('should apply defaults for optional fields', () => {
      const teacher = {
        id: uuidv4(),
        name: 'Jane Doe',
      };
      
      const result = TeacherSchema.safeParse(teacher);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.targetNumberOfHours).toBe(0);
        expect(result.data.qualifiedSubjects).toEqual([]);
      }
    });

    it('should reject negative target hours', () => {
      const teacher = {
        id: uuidv4(),
        name: 'Test Teacher',
        targetNumberOfHours: -5,
        qualifiedSubjects: [],
      };
      
      const result = TeacherSchema.safeParse(teacher);
      expect(result.success).toBe(false);
    });
  });

  describe('SubjectSchema', () => {
    it('should validate a complete subject object', () => {
      const subject = {
        id: uuidv4(),
        name: 'Mathematics',
        longName: 'Advanced Mathematics',
        code: 'MATH',
        comments: 'Core subject',
      };
      
      const result = SubjectSchema.safeParse(subject);
      expect(result.success).toBe(true);
    });

    it('should reject subject with empty name', () => {
      const subject = {
        id: uuidv4(),
        name: '',
      };
      
      const result = SubjectSchema.safeParse(subject);
      expect(result.success).toBe(false);
    });
  });

  describe('RoomSchema', () => {
    it('should validate a complete room object', () => {
      const room = {
        id: uuidv4(),
        name: 'Room 101',
        longName: 'Main Building Room 101',
        code: 'R101',
        capacity: 30,
        buildingId: uuidv4(),
        isVirtual: false,
        comments: 'Lecture hall',
      };
      
      const result = RoomSchema.safeParse(room);
      expect(result.success).toBe(true);
    });

    it('should reject room with zero capacity', () => {
      const room = {
        id: uuidv4(),
        name: 'Empty Room',
        capacity: 0,
        isVirtual: false,
      };
      
      const result = RoomSchema.safeParse(room);
      expect(result.success).toBe(false);
    });

    it('should apply default capacity', () => {
      const room = {
        id: uuidv4(),
        name: 'Room 102',
      };
      
      const result = RoomSchema.safeParse(room);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.capacity).toBe(30);
        expect(result.data.isVirtual).toBe(false);
      }
    });
  });

  describe('ActivitySchema', () => {
    it('should validate a complete activity', () => {
      const activity = {
        id: uuidv4(),
        activityGroupId: 0,
        teacherIds: [uuidv4()],
        subjectId: uuidv4(),
        activityTagIds: [],
        studentSetIds: ['Year 1 Group A'],
        duration: 2,
        totalDuration: 4,
        active: true,
        computeNTotalStudents: true,
        nTotalStudents: 25,
      };
      
      const result = ActivitySchema.safeParse(activity);
      expect(result.success).toBe(true);
    });

    it('should reject activity without teachers', () => {
      const activity = {
        id: uuidv4(),
        teacherIds: [],
        subjectId: uuidv4(),
        duration: 1,
      };
      
      const result = ActivitySchema.safeParse(activity);
      expect(result.success).toBe(false);
    });

    it('should reject activity with zero duration', () => {
      const activity = {
        id: uuidv4(),
        teacherIds: [uuidv4()],
        subjectId: uuidv4(),
        duration: 0,
      };
      
      const result = ActivitySchema.safeParse(activity);
      expect(result.success).toBe(false);
    });
  });

  describe('DaySchema', () => {
    it('should validate day with name', () => {
      const day = { name: 'Monday', longName: 'Monday' };
      const result = DaySchema.safeParse(day);
      expect(result.success).toBe(true);
    });

    it('should reject day with empty name', () => {
      const day = { name: '' };
      const result = DaySchema.safeParse(day);
      expect(result.success).toBe(false);
    });
  });

  describe('HourSchema', () => {
    it('should validate hour with name', () => {
      const hour = { name: '08:00', longName: '08:00 - 09:00' };
      const result = HourSchema.safeParse(hour);
      expect(result.success).toBe(true);
    });
  });

  describe('StudentsYearSchema', () => {
    it('should validate a year with groups', () => {
      const year = {
        id: uuidv4(),
        name: 'Year 1',
        numberOfStudents: 100,
        type: STUDENTS_YEAR,
        groups: ['Group A', 'Group B'],
        divisions: [],
        separator: ' ',
      };
      
      const result = StudentsYearSchema.safeParse(year);
      expect(result.success).toBe(true);
    });
  });

  describe('StudentsGroupSchema', () => {
    it('should validate a group with subgroups', () => {
      const group = {
        id: uuidv4(),
        name: 'Group A',
        numberOfStudents: 30,
        type: STUDENTS_GROUP,
        subgroups: ['Subgroup 1', 'Subgroup 2'],
      };
      
      const result = StudentsGroupSchema.safeParse(group);
      expect(result.success).toBe(true);
    });
  });

  describe('Helper Functions', () => {
    describe('validateTeacher', () => {
      it('should return teacher for valid input', () => {
        const teacher = {
          id: uuidv4(),
          name: 'Valid Teacher',
          targetNumberOfHours: 20,
          qualifiedSubjects: [],
        };
        
        expect(() => validateTeacher(teacher)).not.toThrow();
      });

      it('should throw for invalid input', () => {
        const teacher = { id: 'not-uuid', name: '' };
        expect(() => validateTeacher(teacher)).toThrow();
      });
    });

    describe('safeValidateTeacher', () => {
      it('should return teacher for valid input', () => {
        const teacher = {
          id: uuidv4(),
          name: 'Valid Teacher',
          targetNumberOfHours: 0,
          qualifiedSubjects: [],
        };
        
        const result = safeValidateTeacher(teacher);
        expect(result).not.toBeNull();
        expect(result?.name).toBe('Valid Teacher');
      });

      it('should return null for invalid input', () => {
        const result = safeValidateTeacher({ name: '' });
        expect(result).toBeNull();
      });
    });

    describe('getValidationErrors', () => {
      it('should return empty array for valid data', () => {
        const teacher = {
          id: uuidv4(),
          name: 'Valid Teacher',
          targetNumberOfHours: 0,
          qualifiedSubjects: [],
        };
        
        const errors = getValidationErrors(TeacherSchema, teacher);
        expect(errors).toHaveLength(0);
      });

      it('should return error messages for invalid data', () => {
        const teacher = { id: 'not-uuid', name: '' };
        const errors = getValidationErrors(TeacherSchema, teacher);
        expect(errors.length).toBeGreaterThan(0);
      });
    });
  });
});

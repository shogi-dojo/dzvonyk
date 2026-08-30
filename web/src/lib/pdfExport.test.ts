import { describe, expect, it, vi } from 'vitest';
import { exportElementToPdf } from './pdfExport';

// Mock html2canvas and jspdf
vi.mock('html2canvas', () => {
  return {
    default: vi.fn().mockImplementation(async () => {
      return {
        width: 1200,
        height: 800,
        toDataURL: vi.fn().mockReturnValue('data:image/png;base64,mockdata'),
      };
    }),
  };
});

const mockSave = vi.fn();
const mockAddImage = vi.fn();

vi.mock('jspdf', () => {
  return {
    jsPDF: class {
      addImage = mockAddImage;
      save = mockSave;
    },
  };
});

describe('exportElementToPdf', () => {
  it('captures element and triggers PDF save without errors', async () => {
    const el = document.createElement('div');
    el.innerHTML = '<table><tr><td>Test Cell</td></tr></table>';
    document.body.appendChild(el);

    await exportElementToPdf(el, { fileName: 'test_report.pdf' });

    expect(mockAddImage).toHaveBeenCalled();
    expect(mockSave).toHaveBeenCalledWith('test_report.pdf');

    document.body.removeChild(el);
  });
});

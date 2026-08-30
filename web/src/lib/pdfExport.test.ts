import { describe, expect, it, vi } from 'vitest';
import { exportHtmlToPdf } from './pdfExport';

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

describe('exportHtmlToPdf', () => {
  it('renders sandboxed HTML and triggers PDF save without errors', async () => {
    const html = '<html><body><table><tr><td>Test Cell</td></tr></table></body></html>';

    await exportHtmlToPdf(html, { fileName: 'test_report.pdf' });

    expect(mockAddImage).toHaveBeenCalled();
    expect(mockSave).toHaveBeenCalledWith('test_report.pdf');
  });
});

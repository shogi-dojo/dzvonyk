import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { printReportElementToPdf } from './pdfExport';

describe('printReportElementToPdf', () => {
  let printSpy: ReturnType<typeof vi.spyOn>;
  const originalTitle = 'Original Page Title';

  beforeEach(() => {
    document.title = originalTitle;
    printSpy = vi.spyOn(window, 'print').mockImplementation(() => {
      // Simulate browser firing afterprint event
      window.dispatchEvent(new Event('afterprint'));
    });
  });

  afterEach(() => {
    printSpy.mockRestore();
    document.body.className = '';
    const styleEl = document.getElementById('pdf-custom-page-size-style');
    if (styleEl) styleEl.remove();
  });

  it('measures element, injects custom @page size, sets document.title, and invokes window.print', async () => {
    const container = document.createElement('div');
    container.setAttribute('data-print-area', 'true');
    Object.defineProperty(container, 'scrollWidth', { value: 1600, configurable: true });
    Object.defineProperty(container, 'scrollHeight', { value: 900, configurable: true });
    document.body.appendChild(container);

    const promise = printReportElementToPdf(container, {
      fileName: 'Зведений_розклад_класів_Гімназія_131.pdf',
    });

    // Check intermediate state during print trigger
    await new Promise((r) => setTimeout(r, 60));

    expect(printSpy).toHaveBeenCalled();
    await promise;

    // After afterprint, title and class should be restored and style cleaned up
    expect(document.title).toBe(originalTitle);
    expect(document.body.classList.contains('pdf-print-mode')).toBe(false);
    expect(document.getElementById('pdf-custom-page-size-style')).toBeNull();

    container.remove();
  });

  it('calculates page dimensions based on widest nested table/container', async () => {
    const container = document.createElement('div');
    const table = document.createElement('table');
    table.className = 'timetable-grid';
    Object.defineProperty(container, 'scrollWidth', { value: 800, configurable: true });
    Object.defineProperty(table, 'scrollWidth', { value: 2400, configurable: true });
    container.appendChild(table);
    document.body.appendChild(container);

    let capturedStyle = '';
    printSpy.mockImplementation(() => {
      const styleEl = document.getElementById('pdf-custom-page-size-style');
      if (styleEl) {
        capturedStyle = styleEl.innerHTML;
      }
      window.dispatchEvent(new Event('afterprint'));
    });

    await printReportElementToPdf(container, {
      fileName: 'Тестовий_звіт.pdf',
    });

    expect(capturedStyle).toContain('2432px'); // 2400 + 32px buffer
    container.remove();
  });

  it('handles multiple consecutive print calls safely without style leaks', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    await printReportElementToPdf(container, { fileName: 'Report_1.pdf' });
    expect(document.getElementById('pdf-custom-page-size-style')).toBeNull();

    await printReportElementToPdf(container, { fileName: 'Report_2.pdf' });
    expect(document.getElementById('pdf-custom-page-size-style')).toBeNull();
    expect(printSpy).toHaveBeenCalledTimes(2);

    container.remove();
  });
});

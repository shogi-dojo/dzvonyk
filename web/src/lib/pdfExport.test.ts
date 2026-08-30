import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { printReportElementToPdf } from './pdfExport';

describe('printReportElementToPdf', () => {
  let printSpy: ReturnType<typeof vi.spyOn>;
  const originalTitle = 'Original Page Title';

  beforeEach(() => {
    document.title = originalTitle;
    printSpy = vi.spyOn(window, 'print').mockImplementation(() => {
      window.dispatchEvent(new Event('afterprint'));
    });
  });

  afterEach(() => {
    printSpy.mockRestore();
    document.body.classList.remove('pdf-print-mode');
    document.getElementById('pdf-custom-page-size-style')?.remove();
    document.querySelectorAll('[data-pdf-test]').forEach((element) => element.remove());
  });

  function createContainer(): HTMLDivElement {
    const container = document.createElement('div');
    container.dataset.pdfTest = 'true';
    container.setAttribute('data-print-area', 'true');
    document.body.appendChild(container);
    return container;
  }

  it('prints with the requested title and cleans up the temporary print state', async () => {
    const container = createContainer();
    Object.defineProperty(container, 'scrollWidth', { value: 1600, configurable: true });
    Object.defineProperty(container, 'scrollHeight', { value: 900, configurable: true });

    let stateDuringPrint:
      | { title: string; pdfMode: boolean; pageStyle: string }
      | undefined;
    printSpy.mockImplementation(() => {
      stateDuringPrint = {
        title: document.title,
        pdfMode: document.body.classList.contains('pdf-print-mode'),
        pageStyle: document.getElementById('pdf-custom-page-size-style')?.textContent || '',
      };
      window.dispatchEvent(new Event('afterprint'));
    });

    await printReportElementToPdf(container, {
      fileName: 'Зведений_розклад_класів_Гімназія_131.pdf',
    });

    expect(printSpy).toHaveBeenCalledOnce();
    expect(stateDuringPrint).toMatchObject({
      title: 'Зведений_розклад_класів_Гімназія_131',
      pdfMode: true,
    });
    expect(stateDuringPrint?.pageStyle).toContain('@page');
    expect(document.title).toBe(originalTitle);
    expect(document.body.classList.contains('pdf-print-mode')).toBe(false);
    expect(document.getElementById('pdf-custom-page-size-style')).toBeNull();
  });

  it('includes the preview padding around the widest nested table', async () => {
    const container = createContainer();
    container.style.padding = '24px 32px';
    const table = document.createElement('table');
    table.className = 'timetable-grid';
    container.appendChild(table);

    Object.defineProperty(container, 'scrollWidth', { value: 800, configurable: true });
    Object.defineProperty(container, 'scrollHeight', { value: 900, configurable: true });
    Object.defineProperty(table, 'scrollWidth', { value: 2400, configurable: true });

    let capturedStyle = '';
    printSpy.mockImplementation(() => {
      capturedStyle =
        document.getElementById('pdf-custom-page-size-style')?.textContent || '';
      window.dispatchEvent(new Event('afterprint'));
    });

    await printReportElementToPdf(container, { fileName: 'Тестовий_звіт.pdf' });

    // 2400px table + 64px preview padding = 2464px report; + 4px safety buffer.
    expect(capturedStyle).toContain('size: 2468px 904px');
    expect(capturedStyle).toContain('width: 2464px');
    expect(capturedStyle).toContain('padding: 24px 32px 24px 32px');
  });

  it('cleans up when the browser does not dispatch afterprint', async () => {
    const container = createContainer();
    printSpy.mockImplementation(() => undefined);

    await printReportElementToPdf(container, { fileName: 'Fallback.pdf' });

    expect(document.title).toBe(originalTitle);
    expect(document.body.classList.contains('pdf-print-mode')).toBe(false);
    expect(document.getElementById('pdf-custom-page-size-style')).toBeNull();
  });

  it('rejects print errors and still restores document state', async () => {
    const container = createContainer();
    printSpy.mockImplementation(() => {
      throw new Error('Print unavailable');
    });

    await expect(
      printReportElementToPdf(container, { fileName: 'Failure.pdf' })
    ).rejects.toThrow('Print unavailable');

    expect(document.title).toBe(originalTitle);
    expect(document.body.classList.contains('pdf-print-mode')).toBe(false);
    expect(document.getElementById('pdf-custom-page-size-style')).toBeNull();
  });

  it('rejects detached elements without changing the page', async () => {
    const detached = document.createElement('div');

    await expect(printReportElementToPdf(detached)).rejects.toThrow(
      'not attached to the document'
    );
    expect(printSpy).not.toHaveBeenCalled();
    expect(document.title).toBe(originalTitle);
  });
});

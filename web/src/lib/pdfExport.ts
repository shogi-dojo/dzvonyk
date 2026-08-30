export interface PrintReportPdfOptions {
  fileName?: string;
  bufferPx?: number;
}

/**
 * Directly prints/saves the on-screen report element as a 1:1 vector PDF using native window.print()
 * with dynamically injected @page dimensions matching the element's full natural size.
 *
 * This ensures the exported PDF is identical to the on-screen preview with 100% vector typography,
 * selectable text, exact colors, and no column squishing on wide multi-class tables.
 */
export async function printReportElementToPdf(
  element: HTMLElement,
  options: PrintReportPdfOptions = {}
): Promise<void> {
  const { fileName = 'Зведений_розклад.pdf', bufferPx = 32 } = options;

  // 1. Measure the widest table/container and full content height
  let maxContentWidth = Math.max(element.scrollWidth, element.offsetWidth, 1200);
  const wideElements = element.querySelectorAll<HTMLElement>('.overflow-x-auto, table, .timetable-grid');
  wideElements.forEach((el) => {
    if (el.scrollWidth > maxContentWidth) {
      maxContentWidth = el.scrollWidth;
    }
  });

  const maxContentHeight = Math.max(element.scrollHeight, element.offsetHeight, 600);

  // Compute exact single-page dimensions in pixels with buffer against rounding
  const pageWidthPx = Math.ceil(maxContentWidth + bufferPx);
  const pageHeightPx = Math.ceil(maxContentHeight + bufferPx);

  // Clean document.title so the browser's "Save as PDF" dialog pre-fills the suggested file name
  const safeDocTitle = fileName.replace(/\.pdf$/i, '');
  const originalTitle = document.title;

  // 2. Inject temporary custom @page size style
  const styleId = 'pdf-custom-page-size-style';
  let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }

  styleEl.innerHTML = `
    @page {
      size: ${pageWidthPx}px ${pageHeightPx}px;
      margin: 0;
    }
    @media print {
      body.pdf-print-mode {
        background: #ffffff !important;
        margin: 0 !important;
        padding: 0 !important;
        width: ${pageWidthPx}px !important;
      }
      body.pdf-print-mode .no-print,
      body.pdf-print-mode aside,
      body.pdf-print-mode header,
      body.pdf-print-mode nav,
      body.pdf-print-mode footer {
        display: none !important;
      }
      body.pdf-print-mode [data-print-area="true"] {
        width: ${pageWidthPx}px !important;
        max-width: none !important;
        min-width: ${pageWidthPx}px !important;
        margin: 0 !important;
        padding: 16px !important;
        border: none !important;
        box-shadow: none !important;
        overflow: visible !important;
        background: #ffffff !important;
      }
      body.pdf-print-mode [data-print-area="true"] .overflow-x-auto {
        overflow: visible !important;
        max-width: none !important;
        width: 100% !important;
      }
      body.pdf-print-mode [data-print-area="true"] table {
        max-width: none !important;
        width: 100% !important;
      }
    }
  `;

  document.title = safeDocTitle;
  document.body.classList.add('pdf-print-mode');

  return new Promise((resolve) => {
    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      document.body.classList.remove('pdf-print-mode');
      document.title = originalTitle;
      if (styleEl && styleEl.parentNode) {
        styleEl.parentNode.removeChild(styleEl);
      }
      window.removeEventListener('afterprint', cleanup);
      resolve();
    };

    window.addEventListener('afterprint', cleanup, { once: true });

    setTimeout(() => {
      try {
        window.print();
      } catch (err) {
        console.error('Error invoking window.print:', err);
        cleanup();
      }
    }, 50);

    // Timeout safety fallback
    setTimeout(cleanup, 4000);
  });
}

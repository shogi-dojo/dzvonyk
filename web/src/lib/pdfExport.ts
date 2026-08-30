export interface PrintReportPdfOptions {
  fileName?: string;
  bufferPx?: number;
}

const STYLE_ID = 'pdf-custom-page-size-style';
let printInProgress = false;

function pixelValue(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Prints the rendered report preview through the browser's native PDF pipeline.
 * The temporary page box matches the report's natural dimensions, so text stays
 * selectable and wide matrices are not scaled down or rasterized.
 */
export async function printReportElementToPdf(
  element: HTMLElement,
  options: PrintReportPdfOptions = {}
): Promise<void> {
  if (!element.isConnected) {
    throw new Error('Cannot print a report element that is not attached to the document');
  }
  if (printInProgress) {
    throw new Error('A report print is already in progress');
  }

  const { fileName = 'Зведений_розклад.pdf', bufferPx = 4 } = options;
  const safeBufferPx = Number.isFinite(bufferPx) ? Math.max(0, bufferPx) : 4;
  const computedStyle = window.getComputedStyle(element);
  const paddingTop = pixelValue(computedStyle.paddingTop);
  const paddingRight = pixelValue(computedStyle.paddingRight);
  const paddingBottom = pixelValue(computedStyle.paddingBottom);
  const paddingLeft = pixelValue(computedStyle.paddingLeft);
  const horizontalPadding = paddingLeft + paddingRight;

  const elementContentWidth = Math.max(
    0,
    element.scrollWidth - horizontalPadding,
    element.offsetWidth - horizontalPadding,
    element.clientWidth - horizontalPadding
  );
  let widestContentWidth = elementContentWidth;
  const wideElements = element.querySelectorAll<HTMLElement>(
    '.overflow-x-auto, table, .timetable-grid'
  );
  wideElements.forEach((candidate) => {
    widestContentWidth = Math.max(
      widestContentWidth,
      candidate.scrollWidth,
      candidate.offsetWidth
    );
  });

  const reportWidthPx = Math.ceil(widestContentWidth + horizontalPadding);
  const reportHeightPx = Math.ceil(
    Math.max(element.scrollHeight, element.offsetHeight, 600)
  );
  const pageWidthPx = Math.ceil(reportWidthPx + safeBufferPx);
  const pageHeightPx = Math.ceil(reportHeightPx + safeBufferPx);

  const originalTitle = document.title;
  const requestedTitle = fileName.replace(/\.pdf$/i, '').trim();
  const safeDocumentTitle = requestedTitle || 'Зведений_розклад';
  const bodyAlreadyInPdfMode = document.body.classList.contains('pdf-print-mode');

  document.getElementById(STYLE_ID)?.remove();
  const styleElement = document.createElement('style');
  styleElement.id = STYLE_ID;
  styleElement.textContent = `
    @page {
      size: ${pageWidthPx}px ${pageHeightPx}px;
      margin: 0;
    }
    @media print {
      html {
        width: ${pageWidthPx}px !important;
        min-width: ${pageWidthPx}px !important;
        max-width: ${pageWidthPx}px !important;
        overflow: visible !important;
      }
      body.pdf-print-mode {
        width: ${pageWidthPx}px !important;
        min-width: ${pageWidthPx}px !important;
        max-width: ${pageWidthPx}px !important;
        overflow: visible !important;
      }
      body.pdf-print-mode [data-print-area="true"] {
        box-sizing: border-box !important;
        width: ${reportWidthPx}px !important;
        min-width: ${reportWidthPx}px !important;
        max-width: none !important;
        padding: ${paddingTop}px ${paddingRight}px ${paddingBottom}px ${paddingLeft}px !important;
      }
    }
  `;

  document.head.appendChild(styleElement);
  document.title = safeDocumentTitle;
  document.body.classList.add('pdf-print-mode');
  printInProgress = true;

  return new Promise((resolve, reject) => {
    let settled = false;

    const finish = (error?: unknown) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('afterprint', handleAfterPrint);
      styleElement.remove();
      if (!bodyAlreadyInPdfMode) {
        document.body.classList.remove('pdf-print-mode');
      }
      document.title = originalTitle;
      printInProgress = false;

      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };

    const handleAfterPrint = () => finish();
    window.addEventListener('afterprint', handleAfterPrint, { once: true });

    try {
      // Force style calculation before opening the modal print dialog while
      // preserving the click's user activation.
      void element.offsetHeight;
      window.print();

      // window.print() is specified to block until the dialog closes. This is
      // the fallback for browsers that do not dispatch afterprint reliably.
      window.setTimeout(() => finish(), 0);
    } catch (error) {
      finish(error);
    }
  });
}

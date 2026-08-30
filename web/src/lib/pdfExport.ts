import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export interface PdfExportOptions {
  fileName?: string;
  scale?: number;
}

/**
 * Captures an HTML element and exports it as a crisp, full-width electronic PDF file
 * without shrinking or clipping wide tables.
 */
export async function exportElementToPdf(
  element: HTMLElement,
  options: PdfExportOptions = {}
): Promise<void> {
  const { fileName = 'rozklad.pdf', scale = 2 } = options;

  // Find maximum content width across the element and any scrollable children
  let maxWidth = Math.max(element.scrollWidth, element.offsetWidth, 1200);
  const scrollableKids = element.querySelectorAll<HTMLElement>('.overflow-x-auto, table');
  scrollableKids.forEach((el) => {
    if (el.scrollWidth > maxWidth) {
      maxWidth = el.scrollWidth;
    }
  });

  const canvas = await html2canvas(element, {
    scale,
    useCORS: true,
    logging: false,
    width: maxWidth,
    windowWidth: maxWidth + 150,
    backgroundColor: '#ffffff',
    onclone: (clonedDoc) => {
      const clonedElement = clonedDoc.querySelector('[data-print-area]') as HTMLElement;
      if (clonedElement) {
        clonedElement.style.width = `${maxWidth}px`;
        clonedElement.style.maxWidth = 'none';
        clonedElement.style.overflow = 'visible';
      }
      const clonedScrollables = clonedDoc.querySelectorAll<HTMLElement>('.overflow-x-auto');
      clonedScrollables.forEach((s) => {
        s.style.overflow = 'visible';
        s.style.width = '100%';
        s.style.maxWidth = 'none';
      });
      const clonedTables = clonedDoc.querySelectorAll<HTMLElement>('table');
      clonedTables.forEach((tbl) => {
        tbl.style.width = '100%';
        tbl.style.maxWidth = 'none';
      });
    },
  });

  const imgData = canvas.toDataURL('image/png');
  const imgWidth = canvas.width;
  const imgHeight = canvas.height;

  const orientation = imgWidth >= imgHeight ? 'landscape' : 'portrait';
  const pdf = new jsPDF({
    orientation,
    unit: 'pt',
    format: [imgWidth, imgHeight],
    compress: true,
  });

  pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight, undefined, 'FAST');
  pdf.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
}

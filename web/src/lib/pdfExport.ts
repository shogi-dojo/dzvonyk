import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export interface PdfExportOptions {
  fileName?: string;
  scale?: number;
}

/**
 * Renders an isolated HTML string in a sandboxed iframe (free from Tailwind CSS variables / oklch)
 * and exports it directly as a crisp, full-width electronic PDF file.
 */
export async function exportHtmlToPdf(
  html: string,
  options: PdfExportOptions = {}
): Promise<void> {
  const { fileName = 'Розклад.pdf', scale = 2 } = options;

  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.left = '-9999px';
    iframe.style.top = '0';
    iframe.style.width = '3200px';
    iframe.style.height = '2000px';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';

    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      reject(new Error('Cannot access iframe document'));
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    const doCapture = async () => {
      try {
        if (doc.fonts && doc.fonts.ready) {
          await doc.fonts.ready;
        }

        const body = doc.body;
        const width = Math.max(body.scrollWidth, body.offsetWidth, 1200);
        const height = Math.max(body.scrollHeight, body.offsetHeight, 600);

        const canvas = await html2canvas(body, {
          scale,
          useCORS: true,
          logging: false,
          width,
          height,
          windowWidth: width + 50,
          windowHeight: height + 50,
          backgroundColor: '#ffffff',
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
        const safeName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
        pdf.save(safeName);

        resolve();
      } catch (err) {
        reject(err);
      } finally {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }
    };

    setTimeout(doCapture, 200);
  });
}

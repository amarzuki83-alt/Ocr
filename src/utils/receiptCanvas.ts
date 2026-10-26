import { ReceiptData, PaperSize } from '../types';
import { formatRupiah, formatTwoColumns } from './escpos';

/**
 * Draws a high-resolution, authentic thermal receipt onto an HTML5 Canvas
 * and exports as a PNG Blob / File.
 * Resolution: 2x scale (640px width for 58mm, 860px for 80mm) for crisp mobile rendering.
 */
export function generateReceiptCanvas(data: ReceiptData, paperSize: PaperSize = '58mm'): HTMLCanvasElement {
  const is58 = paperSize === '58mm';
  const width = is58 ? 640 : 800;
  const paddingX = is58 ? 36 : 48;
  const colWidth = is58 ? 32 : 42;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  // Measure content height dynamically
  // Estimate height: header ~180px, body ~400px, footer ~200px
  let estimatedHeight = 650;
  if (data.extraFields && data.extraFields.length > 0) {
    estimatedHeight += data.extraFields.length * 32;
  }
  if (data.footerDisclaimer) {
    estimatedHeight += Math.ceil(data.footerDisclaimer.length / colWidth) * 32;
  }

  canvas.width = width;
  canvas.height = estimatedHeight;

  // Background Paper
  ctx.fillStyle = '#fafaf7';
  ctx.fillRect(0, 0, width, estimatedHeight);

  // Subtle paper borders
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.strokeRect(4, 4, width - 8, estimatedHeight - 8);

  // Clean straight paper edges (Efek sobekan kertas dihilangkan)
  let y = 46;

  // Header Baris 1: LOKET PPOB ATHAR DIGITAL (Bold, Large, Centered)
  ctx.fillStyle = '#09090b';
  ctx.textAlign = 'center';
  ctx.font = 'bold 32px "Courier Prime", "Courier New", monospace';
  ctx.fillText((data.loket || 'LOKET PPOB ATHAR DIGITAL').toUpperCase(), width / 2, y);
  y += 36;

  // Header Baris 2: STRUK PEMBAYARAN TAGIHAN LISTRIK (Semi-bold, Centered)
  ctx.font = 'bold 22px "Courier Prime", "Courier New", monospace';
  ctx.fillStyle = '#27272a';
  ctx.fillText((data.headerTitle || 'STRUK PEMBAYARAN TAGIHAN LISTRIK').toUpperCase(), width / 2, y);
  y += 26;

  // Optional subheader
  if (data.subHeader) {
    ctx.font = '18px "Courier Prime", "Courier New", monospace';
    ctx.fillStyle = '#52525b';
    ctx.fillText(data.subHeader.toUpperCase(), width / 2, y);
    y += 24;
  }

  // Double divider
  y += 8;
  drawDashedLine(ctx, paddingX, width - paddingX, y, 4, '#18181b', 2);
  y += 22;

  // Metadata: Tanggal & No Ref
  ctx.font = '19px "Courier Prime", "Courier New", monospace';
  ctx.textAlign = 'left';

  if (data.tanggal) {
    drawTwoColText(ctx, 'TANGGAL', data.tanggal, paddingX, width - paddingX, y);
    y += 26;
  }
  if (data.noRef) {
    drawTwoColText(ctx, 'NO REF', data.noRef, paddingX, width - paddingX, y);
    y += 26;
  }

  // Divider
  y += 4;
  drawDashedLine(ctx, paddingX, width - paddingX, y, 3, '#71717a', 1);
  y += 24;

  // Customer details
  if (data.idPel) {
    ctx.font = 'bold 21px "Courier Prime", "Courier New", monospace';
    drawTwoColText(ctx, 'IDPEL / NO PEL', data.idPel, paddingX, width - paddingX, y);
    ctx.font = '19px "Courier Prime", "Courier New", monospace';
    y += 28;
  }
  if (data.nama) {
    ctx.font = 'bold 20px "Courier Prime", "Courier New", monospace';
    drawTwoColText(ctx, 'NAMA', data.nama.toUpperCase(), paddingX, width - paddingX, y);
    ctx.font = '19px "Courier Prime", "Courier New", monospace';
    y += 28;
  }
  if (data.tarifDaya) {
    drawTwoColText(ctx, 'TARIF / DAYA', data.tarifDaya, paddingX, width - paddingX, y);
    y += 26;
  }
  if (data.blnThn) {
    drawTwoColText(ctx, 'BLN / THN', data.blnThn, paddingX, width - paddingX, y);
    y += 26;
  }
  if (data.standMeter) {
    drawTwoColText(ctx, 'STAND METER', data.standMeter, paddingX, width - paddingX, y);
    y += 26;
  }

  // Extra fields
  if (data.extraFields && data.extraFields.length > 0) {
    for (const f of data.extraFields) {
      if (f.label && f.value) {
        ctx.font = 'bold 19px "Courier Prime", "Courier New", monospace';
        drawTwoColText(ctx, f.label.toUpperCase(), f.value, paddingX, width - paddingX, y);
        y += 26;
      }
    }
  }

  // Divider
  y += 4;
  drawDashedLine(ctx, paddingX, width - paddingX, y, 3, '#71717a', 1);
  y += 24;

  // Financials
  ctx.font = '20px "Courier Prime", "Courier New", monospace';
  drawTwoColText(ctx, 'RP TAG PLN', formatRupiah(data.tagihan), paddingX, width - paddingX, y);
  y += 28;
  drawTwoColText(ctx, 'ADMIN BANK', formatRupiah(data.adminBank), paddingX, width - paddingX, y);
  y += 28;

  // Double line for total
  drawDashedLine(ctx, paddingX, width - paddingX, y, 4, '#09090b', 2);
  y += 26;

  ctx.font = 'bold 26px "Courier Prime", "Courier New", monospace';
  drawTwoColText(ctx, 'TOTAL BAYAR', formatRupiah(data.totalBayar), paddingX, width - paddingX, y);
  y += 12;

  drawDashedLine(ctx, paddingX, width - paddingX, y, 4, '#09090b', 2);
  y += 30;

  // Footer Disclaimer
  ctx.textAlign = 'center';
  ctx.font = 'italic 16px "Courier Prime", "Courier New", monospace';
  ctx.fillStyle = '#3f3f46';

  if (data.footerDisclaimer) {
    const words = data.footerDisclaimer.split(' ');
    let line = '';
    const maxChars = is58 ? 36 : 46;
    for (const w of words) {
      if ((line + ' ' + w).trim().length <= maxChars) {
        line = (line + ' ' + w).trim();
      } else {
        ctx.fillText(line, width / 2, y);
        y += 20;
        line = w;
      }
    }
    if (line) {
      ctx.fillText(line, width / 2, y);
      y += 20;
    }
  }

  if (data.footerGreeting) {
    y += 8;
    ctx.font = 'bold 16px "Courier Prime", "Courier New", monospace';
    ctx.fillStyle = '#18181b';
    ctx.fillText(data.footerGreeting.toUpperCase(), width / 2, y);
    y += 26;
  }

  // Barcode Graphic
  y += 10;
  drawBarcode(ctx, width / 2, y, 220, 36);
  y += 48;
  ctx.font = '14px "Courier Prime", monospace';
  ctx.fillStyle = '#71717a';
  ctx.fillText(data.idPel || '537210984521', width / 2, y);

  return canvas;
}

function drawDashedLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  x2: number,
  y: number,
  dash: number,
  color: string,
  lineWidth: number = 1
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.setLineDash([dash, dash]);
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  ctx.restore();
}

function drawTwoColText(
  ctx: CanvasRenderingContext2D,
  left: string,
  right: string,
  xLeft: number,
  xRight: number,
  y: number
) {
  ctx.textAlign = 'left';
  ctx.fillStyle = '#09090b';
  ctx.fillText(left, xLeft, y);
  ctx.textAlign = 'right';
  ctx.fillText(right, xRight, y);
}

function drawBarcode(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  y: number,
  width: number,
  height: number
) {
  ctx.save();
  ctx.fillStyle = '#18181b';
  const startX = centerX - width / 2;
  const barPattern = [3, 1, 4, 2, 1, 3, 2, 4, 1, 2, 3, 1, 4, 2, 3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 3, 1, 2];
  let curX = startX;
  const unit = width / 70;

  for (let i = 0; i < barPattern.length; i++) {
    const barW = barPattern[i] * unit;
    if (i % 2 === 0) {
      ctx.fillRect(curX, y, barW, height);
    }
    curX += barW + unit;
    if (curX >= startX + width) break;
  }
  ctx.restore();
}

/**
 * Share receipt PNG to WhatsApp or download and open WhatsApp Web
 */
export async function shareReceiptToWhatsApp(
  data: ReceiptData,
  paperSize: PaperSize = '58mm',
  targetPhone?: string
): Promise<{ success: boolean; method: 'web_share' | 'wa_link' | 'download_only'; message: string }> {
  try {
    const canvas = generateReceiptCanvas(data, paperSize);
    const fileName = `struk-${data.idPel || 'pln'}-${Date.now()}.png`;

    // Convert canvas to Blob & File
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/png', 0.95)
    );

    if (!blob) {
      throw new Error('Gagal menghasilkan gambar struk PNG.');
    }

    const file = new File([blob], fileName, { type: 'image/png' });

    // WhatsApp summary caption
    const captionText = [
      `*STRUK BUKTI PEMBAYARAN LISTRIK PLN*`,
      `*${data.loket || 'LOKET PPOB ATHAR DIGITAL'}*`,
      `---------------------------------`,
      `*IDPEL* : ${data.idPel || '-'}`,
      `*NAMA* : ${data.nama || '-'}`,
      `*TARIF/DAYA* : ${data.tarifDaya || '-'}`,
      `*BLN/THN* : ${data.blnThn || '-'}`,
      `*STAND* : ${data.standMeter || '-'}`,
      `---------------------------------`,
      `*RP TAG PLN* : ${formatRupiah(data.tagihan)}`,
      `*ADMIN BANK* : ${formatRupiah(data.adminBank)}`,
      `*TOTAL BAYAR* : ${formatRupiah(data.totalBayar)}`,
      `---------------------------------`,
      `*NO REF* : ${data.noRef || '-'}`,
      `*TANGGAL* : ${data.tanggal || '-'}`,
      `_${data.footerDisclaimer || 'PLN menyatakan struk ini sbg bukti pembayaran yg sah.'}_`,
      ``,
      `*Status: LUNAS / SAH*`,
      `_Gambar struk thermal resmi terlampir._`,
    ].join('\n');

    // 1. Try Mobile Web Share API with file support (Chrome Android, Safari iOS, etc.)
    if (
      navigator.canShare &&
      navigator.canShare({ files: [file] }) &&
      navigator.share
    ) {
      await navigator.share({
        files: [file],
        title: `Struk Pembayaran PLN - ${data.nama || data.idPel}`,
        text: captionText,
      });

      return {
        success: true,
        method: 'web_share',
        message: 'Struk PNG berhasil dibagikan ke WhatsApp!',
      };
    }

    // 2. Fallback for Desktop / Browsers without File Share API:
    // Download the PNG file automatically
    const downloadLink = document.createElement('a');
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.download = fileName;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    // Build WhatsApp URL (direct to phone if provided, otherwise general WhatsApp share)
    let cleanPhone = targetPhone ? targetPhone.replace(/[^0-9]/g, '') : '';
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '62' + cleanPhone.substring(1);
    }

    const encodedCaption = encodeURIComponent(captionText);
    const waUrl = cleanPhone
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedCaption}`
      : `https://api.whatsapp.com/send?text=${encodedCaption}`;

    // Open WhatsApp in new tab
    window.open(waUrl, '_blank');

    return {
      success: true,
      method: 'wa_link',
      message: 'Gambar struk PNG telah diunduh & WhatsApp terbuka!',
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return {
        success: false,
        method: 'web_share',
        message: 'Berbagi ke WhatsApp dibatalkan.',
      };
    }
    console.error('Share to WA error:', err);
    throw err;
  }
}

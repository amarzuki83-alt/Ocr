import { ReceiptData, PaperSize } from '../types';
import { formatRupiah, formatTwoColumns, isTokenReceipt, getStroomToken, formatToken20, getReceiptKwh } from './escpos';

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

  const isToken = isTokenReceipt(data);
  const tokenValue = getStroomToken(data);
  const kwhValue = getReceiptKwh(data);

  // Measure content height dynamically
  // Estimate height: header ~180px, body ~400px, footer ~200px
  let estimatedHeight = 650;
  if (isToken && tokenValue) {
    estimatedHeight += 95;
  }
  if (isToken && kwhValue) {
    estimatedHeight += 30;
  }
  if (data.extraFields && data.extraFields.length > 0) {
    estimatedHeight += data.extraFields.length * 32;
  }
  if (data.footerDisclaimer) {
    estimatedHeight += Math.ceil(data.footerDisclaimer.length / colWidth) * 32;
  }

  canvas.width = width;
  canvas.height = estimatedHeight;

  // Background Paper: Putih bersih terang (#ffffff)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, estimatedHeight);

  // Subtle clean paper border
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(3, 3, width - 6, estimatedHeight - 6);

  let y = 46;

  // Header Baris 1: LOKET PPOB ATHAR DIGITAL (Bold, Large, Centered)
  ctx.fillStyle = '#09090b';
  ctx.textAlign = 'center';
  ctx.font = 'bold 30px "Courier Prime", "Courier New", monospace';
  ctx.fillText((data.loket || 'LOKET PPOB ATHAR DIGITAL').toUpperCase(), width / 2, y);
  y += 36;

  // Header Baris 2: STRUK PEMBAYARAN TAGIHAN LISTRIK (Semi-bold, Centered)
  ctx.font = 'bold 22px "Courier Prime", "Courier New", monospace';
  ctx.fillStyle = '#18181b';
  ctx.fillText((data.headerTitle || 'STRUK PEMBAYARAN TAGIHAN LISTRIK').toUpperCase(), width / 2, y);
  y += 26;

  // Optional subheader
  if (data.subHeader) {
    ctx.font = '17px "Courier Prime", "Courier New", monospace';
    ctx.fillStyle = '#52525b';
    ctx.fillText(data.subHeader.toUpperCase(), width / 2, y);
    y += 24;
  }

  // Double divider
  y += 8;
  drawDashedLine(ctx, paddingX, width - paddingX, y, 4, '#18181b', 2);
  y += 24;

  // Column layout coordinates for 2-column format with colon separator:
  // Column 1: Label (left-aligned at xLabel)
  // Column 2: Colon ':' (centered or aligned at xColon)
  // Column 3: Value (left-aligned at xValue)
  const xLabel = paddingX;
  const xColon = is58 ? paddingX + 175 : paddingX + 225;
  const xValue = xColon + 18;

  // Metadata: Tanggal & No Ref
  if (data.tanggal) {
    drawRowWithColon(ctx, 'TANGGAL', data.tanggal, xLabel, xColon, xValue, y);
    y += 26;
  }
  if (data.noRef) {
    drawRowWithColon(ctx, 'NO REF', data.noRef, xLabel, xColon, xValue, y);
    y += 26;
  }

  // Divider
  y += 4;
  drawDashedLine(ctx, paddingX, width - paddingX, y, 3, '#71717a', 1);
  y += 24;

  // Customer details: IDPEL, NAMA, TARIF/DAYA
  if (data.idPel) {
    drawRowWithColon(ctx, 'IDPEL', data.idPel, xLabel, xColon, xValue, y, { boldValue: true, fontSize: 20 });
    y += 28;
  }
  if (data.nama) {
    drawRowWithColon(ctx, 'NAMA', data.nama.toUpperCase(), xLabel, xColon, xValue, y, { boldValue: true, fontSize: 20 });
    y += 28;
  }
  if (data.tarifDaya) {
    drawRowWithColon(ctx, 'TARIF / DAYA', data.tarifDaya, xLabel, xColon, xValue, y);
    y += 26;
  }

  // For Token Listrik: BLN/THN and STAND METER are completely omitted
  if (!isToken) {
    if (data.blnThn) {
      drawRowWithColon(ctx, 'BLN / THN', data.blnThn, xLabel, xColon, xValue, y);
      y += 26;
    }
    if (data.standMeter) {
      drawRowWithColon(ctx, 'STAND METER', data.standMeter, xLabel, xColon, xValue, y);
      y += 26;
    }
  } else if (kwhValue) {
    // JML KWH for Token Listrik
    drawRowWithColon(ctx, 'JML KWH', kwhValue, xLabel, xColon, xValue, y, { boldValue: true });
    y += 28;
  }

  // STROOM / TOKEN Section: 20 Digit Enlarged & Prominent
  if (isToken && tokenValue) {
    y += 4;
    drawDashedLine(ctx, paddingX, width - paddingX, y, 4, '#09090b', 2);
    y += 22;

    // Label with colon
    drawRowWithColon(ctx, 'STROOM / TOKEN', '', xLabel, xColon, xValue, y, {
      boldLabel: true,
      fontSize: 20,
      labelColor: '#09090b',
    });
    y += 26;

    // Prominent enlarged 20-digit token box (high contrast, bold 25px font)
    const tokenFormatted = formatToken20(tokenValue);
    const boxH = 46;
    const boxW = width - (paddingX * 2);

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(paddingX, y - 26, boxW, boxH);
    ctx.strokeStyle = '#09090b';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(paddingX, y - 26, boxW, boxH);

    ctx.textAlign = 'center';
    ctx.font = 'bold 25px "Courier Prime", "Courier New", monospace';
    ctx.fillStyle = '#09090b';
    ctx.fillText(tokenFormatted, width / 2, y + 4);
    y += 30;

    drawDashedLine(ctx, paddingX, width - paddingX, y, 4, '#09090b', 2);
    y += 24;
  }

  // Extra fields (e.g. custom items)
  if (data.extraFields && data.extraFields.length > 0) {
    for (const f of data.extraFields) {
      if (f.label && f.value) {
        // Hilangkan PPJ, TOKEN, dan KWH jika token
        if (isToken && (/TOKEN|STROOM/i.test(f.label) || /token/i.test(f.id) || /PPJ/i.test(f.label) || /ppj/i.test(f.id) || /KWH/i.test(f.label) || /kwh/i.test(f.id))) {
          continue;
        }
        drawRowWithColon(ctx, f.label.toUpperCase(), f.value, xLabel, xColon, xValue, y, { boldValue: true });
        y += 26;
      }
    }
  }

  // Divider
  y += 4;
  drawDashedLine(ctx, paddingX, width - paddingX, y, 3, '#71717a', 1);
  y += 24;

  // Financials: For Token Listrik, "RP TAG PLN" is changed to "RP BAYAR"
  drawRowWithColon(ctx, isToken ? 'RP BAYAR' : 'RP TAG PLN', formatRupiah(data.tagihan), xLabel, xColon, xValue, y, { boldValue: true });
  y += 28;
  drawRowWithColon(ctx, 'ADMIN BANK', formatRupiah(data.adminBank), xLabel, xColon, xValue, y, { boldValue: true });
  y += 28;

  // Double line for total
  drawDashedLine(ctx, paddingX, width - paddingX, y, 4, '#09090b', 2);
  y += 26;

  // TOTAL BAYAR (Bold, Prominent with aligned colon)
  drawRowWithColon(ctx, 'TOTAL BAYAR', formatRupiah(data.totalBayar), xLabel, xColon, xValue, y, {
    boldLabel: true,
    boldValue: true,
    fontSize: 24,
    labelColor: '#09090b',
    valueColor: '#09090b',
  });
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

function drawRowWithColon(
  ctx: CanvasRenderingContext2D,
  label: string,
  value: string,
  xLabel: number,
  xColon: number,
  xValue: number,
  y: number,
  options?: {
    boldLabel?: boolean;
    boldValue?: boolean;
    fontSize?: number;
    labelColor?: string;
    valueColor?: string;
  }
) {
  const fontSize = options?.fontSize || 19;
  const labelColor = options?.labelColor || '#3f3f46';
  const valueColor = options?.valueColor || '#09090b';

  // 1. Draw Label (Left Aligned)
  ctx.textAlign = 'left';
  ctx.font = `${options?.boldLabel ? 'bold ' : ''}${fontSize}px "Courier Prime", "Courier New", monospace`;
  ctx.fillStyle = labelColor;
  ctx.fillText(label, xLabel, y);

  // 2. Draw Colon (Aligned at xColon)
  ctx.font = `bold ${fontSize}px "Courier Prime", "Courier New", monospace`;
  ctx.fillStyle = '#18181b';
  ctx.fillText(':', xColon, y);

  // 3. Draw Value (Aligned at xValue)
  ctx.font = `${options?.boldValue ? 'bold ' : ''}${fontSize}px "Courier Prime", "Courier New", monospace`;
  ctx.fillStyle = valueColor;
  ctx.fillText(value, xValue, y);
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

    // WhatsApp summary caption with two-column colon alignment
    const waIsToken = isTokenReceipt(data);
    const waTokenValue = getStroomToken(data);
    const waKwhValue = getReceiptKwh(data);

    const captionLines: string[] = [
      `*${(data.headerTitle || 'STRUK PEMBAYARAN TAGIHAN LISTRIK').toUpperCase()}*`,
      `*${data.loket || 'LOKET PPOB ATHAR DIGITAL'}*`,
      `---------------------------------`,
      `*IDPEL*       : ${data.idPel || '-'}`,
      `*NAMA*        : ${data.nama || '-'}`,
      `*TARIF/DAYA*  : ${data.tarifDaya || '-'}`,
    ];

    if (!waIsToken) {
      if (data.blnThn) captionLines.push(`*BLN/THN*     : ${data.blnThn}`);
      if (data.standMeter) captionLines.push(`*STAND METER* : ${data.standMeter}`);
    } else if (waKwhValue) {
      captionLines.push(`*JML KWH*     : ${waKwhValue}`);
    }

    if (waIsToken && waTokenValue) {
      captionLines.push(`---------------------------------`);
      captionLines.push(`*STROOM / TOKEN* :`);
      captionLines.push(`*${formatToken20(waTokenValue)}*`);
    }

    captionLines.push(
      `---------------------------------`,
      `*${waIsToken ? 'RP BAYAR' : 'RP TAG PLN'}*  : ${formatRupiah(data.tagihan)}`,
      `*ADMIN BANK*  : ${formatRupiah(data.adminBank)}`,
      `*TOTAL BAYAR* : ${formatRupiah(data.totalBayar)}`,
      `---------------------------------`,
      `*NO REF*      : ${data.noRef || '-'}`,
      `*TANGGAL*     : ${data.tanggal || '-'}`,
      `_${data.footerDisclaimer || 'PLN menyatakan struk ini sbg bukti pembayaran yg sah. Info hub 123'}_`,
      ``,
      `*Status: LUNAS / SAH*`,
      `_Gambar struk PNG latar putih bersih resmi terlampir._`
    );

    const captionText = captionLines.join('\n');
    const file = new File([blob], fileName, { type: 'image/png' });

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

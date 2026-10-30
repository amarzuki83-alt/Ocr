import { ReceiptData, PaperSize } from '../types';
import { formatRupiah, formatTwoColumns, isTokenReceipt, isBpjsReceipt, getStroomToken, formatToken20, getReceiptKwh } from './escpos';

/**
 * Draws a high-resolution, authentic thermal receipt onto an HTML5 Canvas
 * and exports as a PNG Blob / File.
 * Resolution: 2x scale (640px width for 58mm, 860px for 80mm) for crisp mobile rendering.
 */
export function generateReceiptCanvas(data: ReceiptData, paperSize: PaperSize = '58mm'): HTMLCanvasElement {
  const is58 = paperSize === '58mm';
  // Lebar struk diperkecil lagi sesuai permintaan:
  // 58mm: 320 CSS px (640 physical px at 2x supersampling)
  // 80mm: 420 CSS px (840 physical px at 2x supersampling)
  const baseWidth = is58 ? 320 : 420;
  const paddingX = is58 ? 12 : 18;
  const colWidth = is58 ? 22 : 30;

  const isToken = isTokenReceipt(data);
  const isBpjs = isBpjsReceipt(data);
  const tokenValue = getStroomToken(data);
  const kwhValue = getReceiptKwh(data);

  // Measure content height dynamically in CSS pixels
  let estimatedHeight = is58 ? 440 : 490;
  if (isToken && tokenValue) {
    estimatedHeight += 85;
  }
  if (isToken && kwhValue) {
    estimatedHeight += 24;
  }
  if (data.extraFields && data.extraFields.length > 0) {
    estimatedHeight += data.extraFields.length * 26;
  }
  const disclaimerText = data.footerDisclaimer || 'Simpan struk ini sebagai bukti pembayaran yang sah';
  if (disclaimerText) {
    estimatedHeight += Math.ceil(disclaimerText.length / colWidth) * 22;
  }

  // 2x Hi-DPI Supersampling untuk hasil cetak printer tinta ultra tajam, pekat, dan tidak buram
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(baseWidth * scale);
  canvas.height = Math.round(estimatedHeight * scale);

  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);

  // Background Paper: Putih cerah pekat murni (#ffffff)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, baseWidth, estimatedHeight);

  // Subtle clean paper border
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.strokeRect(2, 2, baseWidth - 4, estimatedHeight - 4);

  let y = 30;

  // Header Baris 1: LOKET PPOB ATHAR DIGITAL (Bold, Large, Centered)
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.font = is58
    ? 'bold 16.5px "Courier Prime", "Courier New", Courier, monospace'
    : 'bold 20px "Courier Prime", "Courier New", Courier, monospace';
  ctx.fillText((data.loket || 'LOKET PPOB ATHAR DIGITAL').toUpperCase(), baseWidth / 2, y);
  y += 20;

  // Alamat di bawah nama loket (Font lebih tebal / bold)
  const alamatVal = data.alamat ?? 'Jl. Raya Bapuhbandung Glagah';
  if (alamatVal) {
    ctx.font = is58
      ? 'bold 11px "Courier Prime", "Courier New", Courier, monospace'
      : 'bold 13px "Courier Prime", "Courier New", Courier, monospace';
    ctx.fillStyle = '#000000';
    ctx.fillText(alamatVal, baseWidth / 2, y);
    y += 18;
  }

  // Header Baris 2: Judul Struk (Digeser ke bawah sedikit agar lebih dekat dengan garis putus-putus)
  y += 6;
  ctx.font = is58
    ? 'bold 13px "Courier Prime", "Courier New", Courier, monospace'
    : 'bold 16px "Courier Prime", "Courier New", Courier, monospace';
  ctx.fillStyle = '#000000';
  ctx.fillText((data.headerTitle || 'STRUK PEMBAYARAN TAGIHAN LISTRIK').toUpperCase(), baseWidth / 2, y);
  y += 13; // Jarak rapat dan dekat ke garis putus-putus

  // Double divider
  drawDashedLine(ctx, paddingX, baseWidth - paddingX, y, 4, '#000000', 1.5);
  y += 19;

  // Column layout coordinates for 2-column format with colon separator:
  // Column 1: Label (left-aligned at xLabel)
  // Column 2: Colon ':' (digeser lebih ke kanan agar berjarak longgar dan tidak mepet kolom sisi kiri)
  // Column 3: Value (left-aligned at xValue)
  const xLabel = paddingX;
  const xColon = is58 ? paddingX + 110 : paddingX + 145;
  const xValue = xColon + 9;
  const baseFontSize = is58 ? 12 : 14.5;
  const valueFontSize = is58 ? 12.5 : 15;

  // Metadata: Tanggal & No Ref
  if (data.tanggal) {
    drawRowWithColon(ctx, 'TANGGAL', data.tanggal, xLabel, xColon, xValue, y, { fontSize: is58 ? 11.5 : 13.5 });
    y += 20;
  }
  if (data.noRef) {
    drawRowWithColon(ctx, 'NO REF', data.noRef, xLabel, xColon, xValue, y, { fontSize: is58 ? 12 : 14 });
    y += 20;
  }
  y += 4;

  // Customer details
  if (isBpjs) {
    drawRowWithColon(ctx, 'NO POLIS', data.noPolis || data.idPel || '-', xLabel, xColon, xValue, y, { boldValue: true, fontSize: valueFontSize });
    y += 25;
    if (data.nama) {
      drawRowWithColon(ctx, 'NAMA', data.nama.toUpperCase(), xLabel, xColon, xValue, y, { boldValue: true, fontSize: valueFontSize });
      y += 25;
    }
    drawRowWithColon(ctx, 'JML PESERTA', data.jmlPeserta || '1 ORANG', xLabel, xColon, xValue, y, { fontSize: baseFontSize });
    y += 24;
    drawRowWithColon(ctx, 'PERIODE', data.periode || data.blnThn || '-', xLabel, xColon, xValue, y, { fontSize: baseFontSize });
    y += 24;
  } else {
    // Customer details: NO METER, IDPEL, NAMA, TARIF/DAYA
    if (isToken || data.noMeter) {
      drawRowWithColon(ctx, 'NO METER', data.noMeter || '-', xLabel, xColon, xValue, y, { boldValue: true, fontSize: valueFontSize });
      y += 25;
    }
    if (data.idPel) {
      drawRowWithColon(ctx, isToken ? 'IDPEL' : 'IDPEL/NO PEL', data.idPel, xLabel, xColon, xValue, y, { boldValue: true, fontSize: valueFontSize });
      y += 25;
    }
    if (data.nama) {
      drawRowWithColon(ctx, 'NAMA', data.nama.toUpperCase(), xLabel, xColon, xValue, y, { boldValue: true, fontSize: valueFontSize });
      y += 25;
    }
    if (data.tarifDaya) {
      drawRowWithColon(ctx, 'TARIF / DAYA', data.tarifDaya, xLabel, xColon, xValue, y, { fontSize: baseFontSize });
      y += 24;
    }

    // For Token Listrik: BLN/THN and STAND METER are completely omitted
    if (!isToken) {
      if (data.blnThn) {
        drawRowWithColon(ctx, 'BLN / THN', data.blnThn, xLabel, xColon, xValue, y, { fontSize: baseFontSize });
        y += 24;
      }
      if (data.standMeter) {
        drawRowWithColon(ctx, 'STAND METER', data.standMeter, xLabel, xColon, xValue, y, { fontSize: baseFontSize });
        y += 24;
      }
    } else if (kwhValue) {
      // JML KWH for Token Listrik
      drawRowWithColon(ctx, 'JML KWH', kwhValue, xLabel, xColon, xValue, y, { boldValue: true, fontSize: valueFontSize });
      y += 25;
    }

    // STROOM / TOKEN Section: 20 Digit Enlarged & Prominent
    if (isToken && tokenValue) {
      y += 3;
      drawDashedLine(ctx, paddingX, baseWidth - paddingX, y, 4, '#000000', 1.5);
      y += 20;

      // Label with colon
      drawRowWithColon(ctx, 'STROOM / TOKEN', '', xLabel, xColon, xValue, y, {
        boldLabel: true,
        fontSize: is58 ? 14 : 16,
        labelColor: '#000000',
      });
      y += 23;

      // Prominent enlarged 20-digit token box (high contrast, bold font)
      const tokenFormatted = formatToken20(tokenValue);
      const boxH = is58 ? 38 : 42;
      const boxW = baseWidth - (paddingX * 2);

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(paddingX, y - 24, boxW, boxH);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(paddingX, y - 24, boxW, boxH);

      ctx.textAlign = 'center';
      ctx.font = is58
        ? 'bold 16px "Courier Prime", "Courier New", Courier, monospace'
        : 'bold 19px "Courier Prime", "Courier New", Courier, monospace';
      ctx.fillStyle = '#000000';
      ctx.fillText(tokenFormatted, baseWidth / 2, y + 2);
      y += 26;

      drawDashedLine(ctx, paddingX, baseWidth - paddingX, y, 4, '#000000', 1.5);
      y += 20;
    }
  }

  // Extra fields (e.g. custom items)
  if (data.extraFields && data.extraFields.length > 0) {
    for (const f of data.extraFields) {
      if (f.label && f.value) {
        if (isToken && (/TOKEN|STROOM/i.test(f.label) || /token/i.test(f.id) || /PPJ/i.test(f.label) || /ppj/i.test(f.id) || /KWH/i.test(f.label) || /kwh/i.test(f.id))) {
          continue;
        }
        drawRowWithColon(ctx, f.label.toUpperCase(), f.value, xLabel, xColon, xValue, y, { boldValue: true, fontSize: baseFontSize });
        y += 22;
      }
    }
  }

  y += 6;

  // Financials: For Token Listrik, "RP TAG PLN" is changed to "RP BAYAR", for BPJS "RP TAGIHAN"
  const tagihanLabel = isToken ? 'RP BAYAR' : isBpjs ? 'RP TAGIHAN' : 'RP TAG PLN';
  const adminBankVal = data.adminBank !== undefined && data.adminBank > 0 ? data.adminBank : 5000;
  const totalBayarVal = data.totalBayar || ((data.tagihan || 0) + adminBankVal);

  drawRowWithColon(ctx, tagihanLabel, formatRupiah(data.tagihan), xLabel, xColon, xValue, y, { boldValue: true, fontSize: valueFontSize });
  y += 22;
  drawRowWithColon(ctx, 'ADMIN BANK', formatRupiah(adminBankVal), xLabel, xColon, xValue, y, { boldValue: true, fontSize: valueFontSize });
  y += 18; // Berikan jarak vertikal bersih di bawah ADMIN BANK agar garis tidak menempel pada angka

  // TOTAL BAYAR (Bold, Prominent with aligned colon)
  const totalFormatted = formatRupiah(totalBayarVal);
  const totalFontSize = is58 ? 15 : 18;

  // Line above total: dimulai tepat sejajar dari titik : sampai angka terakhir total bayar
  ctx.save();
  ctx.font = `bold ${totalFontSize}px "Courier Prime", "Courier New", Courier, monospace`;
  const textWidth = ctx.measureText(totalFormatted).width;
  const lineEndX = xValue + textWidth;
  ctx.restore();

  drawDashedLine(ctx, xColon, lineEndX, y, 3, '#000000', 1.5);
  y += 22; // Berikan jarak vertikal bersih dari garis ke baris TOTAL BAYAR

  drawRowWithColon(ctx, 'TOTAL BAYAR', totalFormatted, xLabel, xColon, xValue, y, {
    boldLabel: true,
    boldValue: true,
    fontSize: totalFontSize,
    labelColor: '#000000',
    valueColor: '#000000',
  });
  y += 20;

  // Footer Disclaimer
  ctx.textAlign = 'center';
  ctx.font = is58
    ? 'italic 12px "Courier Prime", "Courier New", Courier, monospace'
    : 'italic 13.5px "Courier Prime", "Courier New", Courier, monospace';
  ctx.fillStyle = '#18181b';

  const footerText = data.footerDisclaimer || 'Simpan struk ini sebagai bukti pembayaran yang sah';
  if (footerText) {
    const words = footerText.split(' ');
    let line = '';
    const maxChars = is58 ? 28 : 36;
    for (const w of words) {
      if ((line + ' ' + w).trim().length <= maxChars) {
        line = (line + ' ' + w).trim();
      } else {
        ctx.fillText(line, baseWidth / 2, y);
        y += 16;
        line = w;
      }
    }
    if (line) {
      ctx.fillText(line, baseWidth / 2, y);
      y += 16;
    }
  }

  if (data.footerGreeting) {
    y += 6;
    ctx.font = is58
      ? 'bold 12.5px "Courier Prime", "Courier New", Courier, monospace'
      : 'bold 14.5px "Courier Prime", "Courier New", Courier, monospace';
    ctx.fillStyle = '#000000';
    ctx.fillText(data.footerGreeting.toUpperCase(), baseWidth / 2, y);
    y += 20;
  }

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
  const fontSize = options?.fontSize || 15;
  const labelColor = options?.labelColor || '#18181b';
  const valueColor = options?.valueColor || '#000000';

  // 1. Draw Label (Left Aligned)
  ctx.textAlign = 'left';
  ctx.font = `${options?.boldLabel ? 'bold ' : ''}${fontSize}px "Courier Prime", "Courier New", Courier, monospace`;
  ctx.fillStyle = labelColor;
  ctx.fillText(label, xLabel, y);

  // 2. Draw Colon (Aligned at xColon)
  ctx.font = `bold ${fontSize}px "Courier Prime", "Courier New", Courier, monospace`;
  ctx.fillStyle = '#000000';
  ctx.fillText(':', xColon, y);

  // 3. Draw Value (Aligned at xValue)
  ctx.font = `${options?.boldValue ? 'bold ' : ''}${fontSize}px "Courier Prime", "Courier New", Courier, monospace`;
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
    const waIsBpjs = isBpjsReceipt(data);
    const waIsToken = isTokenReceipt(data);
    const waTokenValue = getStroomToken(data);
    const waKwhValue = getReceiptKwh(data);
    const adminBankVal = data.adminBank !== undefined && data.adminBank > 0 ? data.adminBank : 5000;
    const totalBayarVal = data.totalBayar || ((data.tagihan || 0) + adminBankVal);

    const captionLines: string[] = [
      `*${(data.headerTitle || (waIsBpjs ? 'STRUK PEMBAYARAN IURAN BPJS' : 'STRUK PEMBAYARAN TAGIHAN LISTRIK')).toUpperCase()}*`,
      `*${data.loket || 'LOKET PPOB ATHAR DIGITAL'}*`,
      `*${data.alamat || 'Jl. Raya Bapuhbandung Glagah'}*`,
      `---------------------------------`,
    ];

    if (waIsBpjs) {
      captionLines.push(
        `*NO POLIS*     : ${data.noPolis || data.idPel || '-'}`,
        `*NAMA*         : ${data.nama || '-'}`,
        `*JML PESERTA*  : ${data.jmlPeserta || '1 ORANG'}`,
        `*PERIODE*      : ${data.periode || data.blnThn || '-'}`
      );
    } else {
      if (waIsToken || data.noMeter) {
        captionLines.push(`*NO METER*     : ${data.noMeter || '-'}`);
      }
      captionLines.push(
        `*${waIsToken ? 'IDPEL' : 'IDPEL/NO PEL'}* : ${data.idPel || '-'}`,
        `*NAMA*         : ${data.nama || '-'}`,
        `*TARIF/DAYA*   : ${data.tarifDaya || '-'}`
      );

      if (!waIsToken) {
        if (data.blnThn) captionLines.push(`*BLN/THN*      : ${data.blnThn}`);
        if (data.standMeter) captionLines.push(`*STAND METER*  : ${data.standMeter}`);
      } else if (waKwhValue) {
        captionLines.push(`*JML KWH*      : ${waKwhValue}`);
      }

      if (waIsToken && waTokenValue) {
        captionLines.push(`---------------------------------`);
        captionLines.push(`*STROOM / TOKEN* :`);
        captionLines.push(`*${formatToken20(waTokenValue)}*`);
      }
    }

    captionLines.push(
      `---------------------------------`,
      `*${waIsToken ? 'RP BAYAR' : waIsBpjs ? 'RP TAGIHAN' : 'RP TAG PLN'}*  : ${formatRupiah(data.tagihan)}`,
      `*ADMIN BANK*  : ${formatRupiah(adminBankVal)}`,
      `*TOTAL BAYAR* : ${formatRupiah(totalBayarVal)}`,
      `---------------------------------`,
      `*NO REF*      : ${data.noRef || '-'}`,
      `*TANGGAL*     : ${data.tanggal || '-'}`,
      `_${data.footerDisclaimer || 'Simpan struk ini sebagai bukti pembayaran yang sah'}_`,
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

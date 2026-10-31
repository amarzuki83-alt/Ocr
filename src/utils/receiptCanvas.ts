import { ReceiptData, PaperSize } from '../types';
import { formatRupiah, formatTwoColumns, isTokenReceipt, isBpjsReceipt, getStroomToken, formatToken20, getReceiptKwh } from './escpos';

/**
 * Draws a high-resolution, authentic thermal receipt onto an HTML5 Canvas
 * and exports as a PNG Blob / File.
 * Resolution: 2x scale (640px width for 58mm, 860px for 80mm) for crisp mobile rendering.
 */
export function generateReceiptCanvas(data: ReceiptData, paperSize: PaperSize = '58mm'): HTMLCanvasElement {
  const is58 = paperSize === '58mm';
  // Lebar struk diperkecil lagi sesuai permintaan (ultra compact & slim):
  // 58mm: 210 CSS px (630 physical px pada 3x Hi-DPI supersampling)
  // 80mm: 275 CSS px (825 physical px pada 3x Hi-DPI supersampling)
  const baseWidth = is58 ? 210 : 275;
  const paddingX = is58 ? 6 : 10;
  const colWidth = is58 ? 17 : 22;

  const isToken = isTokenReceipt(data);
  const isBpjs = isBpjsReceipt(data);
  const tokenValue = getStroomToken(data);
  const kwhValue = getReceiptKwh(data);

  // Scratch canvas height sebagai render buffer yang aman sebelum dipotong presisi
  const scratchHeight = 650;

  // 3x Ultra Hi-DPI Supersampling: menghasilkan resolusi ultra tinggi (630px / 825px)
  // Sangat tajam dan jernih ketika dicetak pada printer tinta (inkjet printer)
  const scale = 3;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(baseWidth * scale);
  canvas.height = Math.round(scratchHeight * scale);

  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);

  // Background Paper: Putih bersih pekat murni (#ffffff)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, baseWidth, scratchHeight);

  // Start y dengan margin atas yang lebih ringkas & pendek
  let y = 14;

  // Header Baris 1: LOKET PPOB ATHAR DIGITAL (Wajib dipertahankan, Bold, Centered)
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.font = is58
    ? 'bold 11.5px "Courier Prime", "Courier New", Courier, monospace'
    : 'bold 14.5px "Courier Prime", "Courier New", Courier, monospace';
  ctx.fillText('LOKET PPOB ATHAR DIGITAL', baseWidth / 2, y);
  y += 13;

  // Alamat di bawah nama loket (Font tebal / bold)
  const alamatVal = data.alamat ?? 'Jl. Raya Bapuhbandung Glagah';
  if (alamatVal) {
    ctx.font = is58
      ? 'bold 7.5px "Courier Prime", "Courier New", Courier, monospace'
      : 'bold 9.5px "Courier Prime", "Courier New", Courier, monospace';
    ctx.fillStyle = '#000000';
    ctx.fillText(alamatVal, baseWidth / 2, y);
    y += 10;
  }

  // Garis putus-putus DI ATAS judul struk (sesuai permintaan user)
  drawDashedLine(ctx, paddingX, baseWidth - paddingX, y, 4, '#000000', 1.5);
  y += 10;

  // Header Baris 2: Judul Struk
  ctx.font = is58
    ? 'bold 8.5px "Courier Prime", "Courier New", Courier, monospace'
    : 'bold 11px "Courier Prime", "Courier New", Courier, monospace';
  ctx.fillStyle = '#000000';
  ctx.fillText((data.headerTitle || 'STRUK PEMBAYARAN TAGIHAN LISTRIK').toUpperCase(), baseWidth / 2, y);
  y += 7;

  // Garis putus-putus DI BAWAH judul struk
  drawDashedLine(ctx, paddingX, baseWidth - paddingX, y, 4, '#000000', 1.5);
  y += 13;

  // Column layout coordinates for 2-column format with colon separator:
  // Column 1: Label (left-aligned at xLabel)
  // Column 2: Colon ':' (posisi proporsional dengan jarak lega dari label)
  // Column 3: Value (left-aligned at xValue)
  const xLabel = paddingX;
  const xColon = is58 ? paddingX + 75 : paddingX + 100;
  const xValue = xColon + 6;
  const baseFontSize = is58 ? 8.5 : 10.5;
  const valueFontSize = is58 ? 9 : 11;

  // Metadata: Tanggal & No Ref
  if (data.tanggal) {
    drawRowWithColon(ctx, 'TANGGAL', data.tanggal, xLabel, xColon, xValue, y, { fontSize: is58 ? 8 : 10 });
    y += 14;
  }
  if (data.noRef) {
    drawRowWithColon(ctx, 'NO REF', data.noRef, xLabel, xColon, xValue, y, { fontSize: is58 ? 8.5 : 10.5 });
    y += 14;
  }
  y += 2;

  // Customer details
  if (isBpjs) {
    drawRowWithColon(ctx, 'NO POLIS', data.noPolis || data.idPel || '-', xLabel, xColon, xValue, y, { boldValue: true, fontSize: valueFontSize });
    y += 15;
    if (data.nama) {
      drawRowWithColon(ctx, 'NAMA', data.nama.toUpperCase(), xLabel, xColon, xValue, y, { boldValue: true, fontSize: valueFontSize });
      y += 15;
    }
    drawRowWithColon(ctx, 'JML PESERTA', data.jmlPeserta || '1 ORANG', xLabel, xColon, xValue, y, { fontSize: baseFontSize });
    y += 14;
    drawRowWithColon(ctx, 'PERIODE', data.periode || data.blnThn || '-', xLabel, xColon, xValue, y, { fontSize: baseFontSize });
    y += 14;
  } else {
    // Customer details: NO METER, IDPEL, NAMA, TARIF/DAYA
    if (isToken || data.noMeter) {
      drawRowWithColon(ctx, 'NO METER', data.noMeter || '-', xLabel, xColon, xValue, y, { boldValue: true, fontSize: valueFontSize });
      y += 15;
    }
    if (data.idPel) {
      drawRowWithColon(ctx, isToken ? 'IDPEL' : 'IDPEL/NO PEL', data.idPel, xLabel, xColon, xValue, y, { boldValue: true, fontSize: valueFontSize });
      y += 15;
    }
    if (data.nama) {
      drawRowWithColon(ctx, 'NAMA', data.nama.toUpperCase(), xLabel, xColon, xValue, y, { boldValue: true, fontSize: valueFontSize });
      y += 15;
    }
    if (data.tarifDaya) {
      drawRowWithColon(ctx, 'TARIF / DAYA', data.tarifDaya, xLabel, xColon, xValue, y, { fontSize: baseFontSize });
      y += 14;
    }

    // For Token Listrik: BLN/THN and STAND METER are completely omitted
    if (!isToken) {
      if (data.blnThn) {
        drawRowWithColon(ctx, 'BLN / THN', data.blnThn, xLabel, xColon, xValue, y, { fontSize: baseFontSize });
        y += 14;
      }
      if (data.standMeter) {
        drawRowWithColon(ctx, 'STAND METER', data.standMeter, xLabel, xColon, xValue, y, { fontSize: baseFontSize });
        y += 14;
      }
    } else if (kwhValue) {
      // JML KWH for Token Listrik
      drawRowWithColon(ctx, 'JML KWH', kwhValue, xLabel, xColon, xValue, y, { boldValue: true, fontSize: valueFontSize });
      y += 15;
    }

    // STROOM / TOKEN Section: 20 Digit Enlarged & Prominent
    if (isToken && tokenValue) {
      y += 2;
      drawDashedLine(ctx, paddingX, baseWidth - paddingX, y, 4, '#000000', 1.5);
      y += 12;

      // Label with colon
      drawRowWithColon(ctx, 'STROOM / TOKEN', '', xLabel, xColon, xValue, y, {
        boldLabel: true,
        fontSize: is58 ? 9.5 : 11.5,
        labelColor: '#000000',
      });
      y += 13;

      // Prominent enlarged 20-digit token box (high contrast, ultra-bold font)
      const tokenFormatted = formatToken20(tokenValue);
      const boxH = is58 ? 27 : 33;
      const boxW = baseWidth - (paddingX * 2);

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(paddingX, y - 18, boxW, boxH);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(paddingX, y - 18, boxW, boxH);

      ctx.textAlign = 'center';
      // Perbesar angka token stroom secara maksimal dan tegas
      ctx.font = is58
        ? '900 12.5px "Courier Prime", "Courier New", Courier, monospace'
        : '900 16px "Courier Prime", "Courier New", Courier, monospace';
      ctx.fillStyle = '#000000';
      ctx.fillText(tokenFormatted, baseWidth / 2, y + 1.5);
      y += 17;

      drawDashedLine(ctx, paddingX, baseWidth - paddingX, y, 4, '#000000', 1.5);
      y += 12;
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
        y += 14;
      }
    }
  }

  y += 2;

  // Financials: For Token Listrik, "RP TAG PLN" is changed to "RP BAYAR", for BPJS "RP TAGIHAN"
  const tagihanLabel = isToken ? 'RP BAYAR' : isBpjs ? 'RP TAGIHAN' : 'RP TAG PLN';
  const adminBankVal = data.adminBank !== undefined && data.adminBank > 0 ? data.adminBank : 5000;
  const totalBayarVal = data.totalBayar || ((data.tagihan || 0) + adminBankVal);

  drawRowWithColon(ctx, tagihanLabel, formatRupiah(data.tagihan), xLabel, xColon, xValue, y, { boldValue: true, fontSize: valueFontSize });
  y += 15;
  drawRowWithColon(ctx, 'ADMIN BANK', formatRupiah(adminBankVal), xLabel, xColon, xValue, y, { boldValue: true, fontSize: valueFontSize });
  y += 12; // Berikan jarak vertikal bersih di bawah ADMIN BANK agar garis tidak menempel pada angka

  // TOTAL BAYAR (Bold, Prominent with aligned colon)
  const totalFormatted = formatRupiah(totalBayarVal);
  const totalFontSize = is58 ? 10 : 12;

  // Line above total: dimulai tepat sejajar dari titik : sampai angka terakhir total bayar
  ctx.save();
  ctx.font = `bold ${totalFontSize}px "Courier Prime", "Courier New", Courier, monospace`;
  const textWidth = ctx.measureText(totalFormatted).width;
  const lineEndX = xValue + textWidth;
  ctx.restore();

  drawDashedLine(ctx, xColon, lineEndX, y, 3, '#000000', 1.5);
  y += 14; // Berikan jarak vertikal bersih dari garis ke baris TOTAL BAYAR

  drawRowWithColon(ctx, 'TOTAL BAYAR', totalFormatted, xLabel, xColon, xValue, y, {
    boldLabel: true,
    boldValue: true,
    fontSize: totalFontSize,
    labelColor: '#000000',
    valueColor: '#000000',
  });
  y += 13;

  // Footer Disclaimer (Wajib tepat SATU BARIS saja tanpa wrapping)
  ctx.textAlign = 'center';
  ctx.font = is58
    ? 'italic 7px "Courier Prime", "Courier New", Courier, monospace'
    : 'italic 9px "Courier Prime", "Courier New", Courier, monospace';
  ctx.fillStyle = '#18181b';

  const footerText = data.footerDisclaimer || 'Simpan struk ini sebagai bukti pembayaran';
  if (footerText) {
    ctx.fillText(footerText, baseWidth / 2, y);
    y += 11;
  }

  const greetingText = data.footerGreeting !== undefined ? data.footerGreeting : 'Terimakasih';
  if (greetingText) {
    y += 2;
    ctx.font = is58
      ? 'bold 9.5px "Courier Prime", "Courier New", Courier, monospace'
      : 'bold 11.5px "Courier Prime", "Courier New", Courier, monospace';
    ctx.fillStyle = '#000000';
    ctx.fillText(greetingText.toUpperCase(), baseWidth / 2, y);
    y += 12;
  }

  // Potong kanvas pas di batas akhir konten (ditambah padding bawah ringkas 8 CSS px)
  // Ini memastikan panjang struk PNG jauh lebih pendek dan tidak ada ruang putih kosong
  const finalHeightCSS = Math.ceil(y + 8);
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = Math.round(baseWidth * scale);
  finalCanvas.height = Math.round(finalHeightCSS * scale);
  const finalCtx = finalCanvas.getContext('2d')!;

  // Salin isi dari canvas sementara ke canvas final yang sudah dipangkas panjangnya
  finalCtx.drawImage(
    canvas,
    0, 0, Math.round(baseWidth * scale), Math.round(finalHeightCSS * scale),
    0, 0, Math.round(baseWidth * scale), Math.round(finalHeightCSS * scale)
  );

  return finalCanvas;
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
      `*LOKET PPOB ATHAR DIGITAL*`,
      `*${data.alamat || 'Jl. Raya Bapuhbandung Glagah'}*`,
      `---------------------------------`,
      `*${(data.headerTitle || (waIsBpjs ? 'STRUK PEMBAYARAN IURAN BPJS' : 'STRUK PEMBAYARAN TAGIHAN LISTRIK')).toUpperCase()}*`,
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
      `_${data.footerDisclaimer || 'Simpan struk ini sebagai bukti pembayaran'}_`,
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

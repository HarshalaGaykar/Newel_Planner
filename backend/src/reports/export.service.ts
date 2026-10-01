import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { richTextToPlain } from './rich-text.util';

export interface ColDef {
  header: string;
  key: string;
  /**
   * Optional Excel display format for this column (e.g. '0.00'). Formats the
   * cell for display only — the underlying value stays full-precision, so
   * sums/formulas built on the exported sheet still use the real number.
   */
  numFmt?: string;
}

export interface TrackerRow {
  srNo: number;
  id: string;
  title: string;
  startDate: Date | null;
  endDate: Date | null;
  actualStartDate: Date | null;
  actualEndDate: Date | null;
  currentStage: string;
  status: string;
  remarks: { date: string; content: string }[];
  // old values in chronological order (for strike-through)
  endDateHistory: string[];
  actualEndDateHistory: string[];
}

export interface TrackerExportData {
  projectName: string;
  preparedBy: string;
  reportDate: Date;
  statusSummary: string;
  rows: TrackerRow[];
}

// RAG ARGB colours
const RAG_COLORS = {
  green: 'FF00B050',
  amber: 'FFFFC000',
  red:   'FFFF0000',
  none:  'FFD9D9D9',
};

/**
 * RAG colour for a tracker row, as an ExcelJS ARGB string. Shared with the HTML
 * renderer so the emailed report and the workbook can never disagree.
 */
export function computeRAGColor(row: TrackerRow): string {
  if (row.status === 'CLOSED') return RAG_COLORS.green;
  const due = row.endDate;
  if (!due) return RAG_COLORS.none;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dueDay = new Date(due); dueDay.setHours(0, 0, 0, 0);
  const diff = (today.getTime() - dueDay.getTime()) / 86_400_000;
  if (diff < 1) return RAG_COLORS.green;
  if (diff < 2) return RAG_COLORS.amber;
  return RAG_COLORS.red;
}

function strikethroughDateCell(
  cell: ExcelJS.Cell,
  oldDates: string[],
  current: string,
) {
  if (!oldDates.length) { cell.value = current; return; }
  cell.value = {
    richText: [
      ...oldDates.map(d => ({
        font: { strike: true, color: { argb: 'FF999999' }, size: 9 },
        text: d + '\n',
      })),
      { font: { size: 10 }, text: current },
    ],
  };
}

@Injectable()
export class ExportService {
  async toExcel(reportName: string, columns: ColDef[], rows: any[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(reportName);

    const headerRow = sheet.addRow(columns.map(c => c.header));
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B579A' } };
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

    rows.forEach(row => sheet.addRow(columns.map(c => row[c.key])));

    columns.forEach((c, i) => {
      if (c.numFmt) sheet.getColumn(i + 1).numFmt = c.numFmt;
    });

    sheet.columns.forEach(col => {
      const lengths = (col.values as any[])
        .filter(v => v != null)
        .map(v => String(v).length);
      // Plain loop, not Math.max(...lengths) — spreading a large array into a
      // function call blows V8's call-stack limit on wide reports.
      col.width = lengths.reduce((max, len) => (len > max ? len : max), 10) + 2;
    });

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  /**
   * Build a single workbook with multiple sheets. Each sheet reuses the same
   * styled-header + auto-width logic as `toExcel`.
   */
  async toMultiSheetExcel(
    sheets: { name: string; columns: ColDef[]; rows: any[] }[],
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();

    for (const { name, columns, rows } of sheets) {
      // Excel sheet names are capped at 31 chars and forbid a few characters.
      const safeName = name.replace(/[\\/*?:[\]]/g, ' ').slice(0, 31);
      const sheet = workbook.addWorksheet(safeName || 'Sheet');

      const headerRow = sheet.addRow(columns.map(c => c.header));
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B579A' } };
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

      rows.forEach(row => sheet.addRow(columns.map(c => row[c.key])));

      columns.forEach((c, i) => {
        if (c.numFmt) sheet.getColumn(i + 1).numFmt = c.numFmt;
      });

      sheet.columns.forEach(col => {
        const lengths = (col.values as any[])
          .filter(v => v != null)
          .map(v => String(v).length);
        // Plain loop, not Math.max(...lengths) — spreading a large array into a
        // function call blows V8's call-stack limit on wide reports.
        col.width = lengths.reduce((max, len) => (len > max ? len : max), 10) + 2;
      });

      sheet.views = [{ state: 'frozen', ySplit: 1 }];
    }

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async toTrackerExcel(data: TrackerExportData): Promise<Buffer> {
    const { projectName, preparedBy, reportDate, statusSummary, rows: items } = data;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Delivery Tracker');

    const COL_COUNT = 9;

    ws.columns = [
      { key: 'srNo',            width: 6  },
      { key: 'title',           width: 34 },
      { key: 'plannedStart',    width: 14 },
      { key: 'plannedEnd',      width: 17 },
      { key: 'actualStart',     width: 14 },
      { key: 'actualEnd',       width: 14 },
      { key: 'currentStage',    width: 20 },
      { key: 'status',          width: 15 },
      { key: 'remarks',         width: 60 },
    ];

    // Column positions used for per-cell styling below.
    const COL = {
      srNo: 1, title: 2, plannedStart: 3, plannedEnd: 4,
      actualStart: 5, actualEnd: 6, currentStage: 7,
      status: 8, remarks: 9,
    } as const;

    // One palette + one typeface for the whole sheet, so the report reads as a
    // single document rather than a stack of differently-styled blocks.
    const FONT = 'Calibri';
    /** Roughly 11 lines — beyond this a single row starts to own the viewport. */
    const ROW_HEIGHT_CAP = 170;
    const NAVY = 'FF1F3864';
    const INK = 'FF262626';
    const LABEL_INK = 'FF7F7F7F';
    const HAIRLINE = 'FFD0D7E5';
    const TINT = 'FFF4F7FB';

    const hairline = (): Partial<ExcelJS.Borders> => ({
      top: { style: 'thin', color: { argb: HAIRLINE } },
      bottom: { style: 'thin', color: { argb: HAIRLINE } },
      left: { style: 'thin', color: { argb: HAIRLINE } },
      right: { style: 'thin', color: { argb: HAIRLINE } },
    });

    /** Section label: a rule of colour with the name centred on it. */
    const sectionHeader = (text: string) => {
      const row = ws.addRow([text.toUpperCase()]);
      ws.mergeCells(row.number, 1, row.number, COL_COUNT);
      row.height = 20;
      const cell = row.getCell(1);
      cell.font = { name: FONT, bold: true, size: 10, color: { argb: NAVY } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = { bottom: { style: 'medium', color: { argb: NAVY } } };
      return row;
    };

    /** Vertical breathing room — a short blank row reads as padding, not a gap. */
    const spacer = (height = 7) => {
      const row = ws.addRow([]);
      row.height = height;
      return row;
    };

    // ── Title ──────────────────────────────────────────────────────────────
    const titleRow = ws.addRow(['Delivery Tracker Report']);
    ws.mergeCells(titleRow.number, 1, titleRow.number, COL_COUNT);
    titleRow.height = 30;
    const titleCell = titleRow.getCell(1);
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    titleCell.font = { name: FONT, bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // Subtitle carries the identifying facts, so the band below can stay sparse.
    const subtitleRow = ws.addRow([`${projectName}  ·  ${reportDate.toLocaleDateString('en-GB')}`]);
    ws.mergeCells(subtitleRow.number, 1, subtitleRow.number, COL_COUNT);
    subtitleRow.height = 18;
    const subtitleCell = subtitleRow.getCell(1);
    subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    subtitleCell.font = { name: FONT, size: 10, color: { argb: 'FFC5D0E6' } };
    subtitleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    spacer(9);

    // ── Project Summary ────────────────────────────────────────────────────
    sectionHeader('Project Summary');

    // Label above value, three fields across, each pair inside one tinted cell
    // block — reads as a form rather than two loose rows of text.
    const FIELDS: [string, string][] = [
      ['Report Date', reportDate.toLocaleDateString('en-GB')],
      ['Project Name', projectName],
      ['Prepared By', preparedBy],
    ];
    const SPANS: [number, number][] = [[1, 4], [5, 7], [8, 10]];

    const summaryLabelRow = ws.addRow([]);
    summaryLabelRow.height = 14;
    const summaryValueRow = ws.addRow([]);
    summaryValueRow.height = 20;

    FIELDS.forEach(([label, value], i) => {
      const [from, to] = SPANS[i];

      ws.mergeCells(summaryLabelRow.number, from, summaryLabelRow.number, to);
      const labelCell = summaryLabelRow.getCell(from);
      labelCell.value = label.toUpperCase();
      labelCell.font = { name: FONT, bold: true, size: 8, color: { argb: LABEL_INK } };
      labelCell.alignment = { vertical: 'bottom', horizontal: 'left', indent: 1 };
      labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TINT } };

      ws.mergeCells(summaryValueRow.number, from, summaryValueRow.number, to);
      const valueCell = summaryValueRow.getCell(from);
      valueCell.value = value;
      valueCell.font = { name: FONT, bold: true, size: 11, color: { argb: INK } };
      valueCell.alignment = { vertical: 'top', horizontal: 'left', indent: 1 };
      valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TINT } };

      // Border the pair as one block: top edge on the label, bottom on the value.
      for (let c = from; c <= to; c++) {
        const border = hairline();
        summaryLabelRow.getCell(c).border = { ...border, bottom: undefined };
        summaryValueRow.getCell(c).border = { ...border, top: undefined };
        summaryLabelRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TINT } };
        summaryValueRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TINT } };
      }
    });

    spacer(9);

    // ── Status Summary ─────────────────────────────────────────────────────
    sectionHeader('Status Summary');

    // The summary is rich text from the editor; a worksheet cell would print the
    // raw tags, so flatten it back to plain text (lists become bullets).
    const summaryText = richTextToPlain(statusSummary) || 'No remarks recorded yet.';
    const summaryRow = ws.addRow([summaryText]);
    ws.mergeCells(summaryRow.number, 1, summaryRow.number, COL_COUNT);
    // Counting newlines alone under-measures badly: the cell spans every column,
    // so one long paragraph wraps to many visual lines. Estimate the wrapped
    // count from the merged width (Excel's width unit ≈ one character).
    const mergedCharWidth = ws.columns.reduce((sum, c) => sum + (c.width ?? 10), 0);
    const rawLines = summaryText
      .split('\n')
      .reduce((n, line) => n + Math.max(1, Math.ceil(line.length / mergedCharWidth)), 0);
    // Wrapping breaks on word boundaries, so real lines run a little over the
    // character-count estimate — 15% headroom keeps the last line from clipping.
    const summaryLines = Math.ceil(rawLines * 1.15);
    // 409 is Excel's hard row-height ceiling; stay just under it.
    summaryRow.height = Math.max(34, Math.min(summaryLines * 14 + 10, 400));
    const summaryCell = summaryRow.getCell(1);
    summaryCell.font = { name: FONT, size: 10, color: { argb: INK } };
    summaryCell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true, indent: 1 };
    for (let c = 1; c <= COL_COUNT; c++) {
      summaryRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TINT } };
      summaryRow.getCell(c).border = hairline();
    }

    spacer(9);

    // ── Project Overview ───────────────────────────────────────────────────
    sectionHeader('Project Overview');

    const headers = [
      'Sr No', 'Item',
      'Planned Start', 'Planned End',
      'Actual Start', 'Actual End',
      'Current Stage', 'Status', 'Remarks',
    ];
    const headerRow = ws.addRow(headers);
    headerRow.height = 20;
    headerRow.eachCell(cell => {
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
      cell.font      = { name: FONT, bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border    = hairline();
    });

    const fmt = (d: Date | null) => d ? d.toLocaleDateString('en-GB') : '';

    items.forEach((item, i) => {
      const remarkText = item.remarks.map(r => `${r.date}: ${r.content}`).join('\n');
      // Capped: an item with a long remark history would otherwise produce a row
      // hundreds of pixels tall and push the rest of the table off-screen. The
      // full text stays in the cell — only the displayed height is bounded.
      const rowHeight  = Math.min(
        ROW_HEIGHT_CAP,
        Math.max(
          30,
          item.remarks.length * 16,
          (item.endDateHistory.length + 1) * 14,
          (item.actualEndDateHistory.length + 1) * 14,
        ),
      );
      const ragColor   = computeRAGColor(item);
      const isAlt      = i % 2 === 0;

      const row = ws.addRow([
        item.srNo, item.title,
        fmt(item.startDate), '',
        fmt(item.actualStartDate), '',
        item.currentStage, '', remarkText,
      ]);
      row.height = rowHeight;

      // Planned End — with strike-through history of superseded dates
      if (item.endDate || item.endDateHistory.length) {
        strikethroughDateCell(row.getCell(COL.plannedEnd), item.endDateHistory, fmt(item.endDate));
      }

      // Actual End — same strike-through treatment
      if (item.actualEndDate || item.actualEndDateHistory.length) {
        strikethroughDateCell(row.getCell(COL.actualEnd), item.actualEndDateHistory, fmt(item.actualEndDate));
      }

      // Status cell — RAG colour + status text
      const statusCell = row.getCell(COL.status);
      statusCell.value     = item.status.replace('_', ' ');
      statusCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: ragColor } };
      statusCell.font      = { name: FONT, bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      statusCell.alignment = { vertical: 'middle', horizontal: 'center' };

      // Alignments — dates centred, prose wrapped
      row.getCell(COL.srNo).alignment         = { vertical: 'top', horizontal: 'center' };
      row.getCell(COL.title).alignment        = { vertical: 'top', wrapText: true };
      row.getCell(COL.plannedStart).alignment = { vertical: 'top', horizontal: 'center' };
      row.getCell(COL.plannedEnd).alignment   = { vertical: 'top', horizontal: 'center', wrapText: true };
      row.getCell(COL.actualStart).alignment  = { vertical: 'top', horizontal: 'center' };
      row.getCell(COL.actualEnd).alignment    = { vertical: 'top', horizontal: 'center', wrapText: true };
      row.getCell(COL.currentStage).alignment = { vertical: 'top', wrapText: true };
      row.getCell(COL.remarks).alignment      = { vertical: 'top', wrapText: true };

      // Borders + alternate shading
      row.eachCell({ includeEmpty: true }, (cell, colNum) => {
        if (colNum !== COL.status && isAlt) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TINT } };
        }
        if (colNum === COL.status) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ragColor } };
        }
        if (colNum !== COL.status) {
          cell.font = { name: FONT, size: 10, color: { argb: INK } };
        }
        cell.border = hairline();
      });
    });

    // No frozen pane. Freezing the table header would pin everything above it
    // too — title, summary band and the status box — and that block is tall
    // enough to leave only a sliver of the table scrolling.
    ws.views = [{ state: 'normal' }];

    // Sort/filter on the table without needing a frozen header.
    ws.autoFilter = {
      from: { row: headerRow.number, column: 1 },
      to: { row: headerRow.number + items.length, column: COL_COUNT },
    };

    return Buffer.from(await wb.xlsx.writeBuffer());
  }
}

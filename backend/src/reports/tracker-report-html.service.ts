import { Injectable } from '@nestjs/common';
import { TrackerExportData, TrackerRow, computeRAGColor } from './export.service';
import { renderRichText } from './rich-text.util';

/**
 * Renders the delivery tracker status report as email-safe HTML.
 *
 * Written for mail clients, not browsers: table layout only, every style inline,
 * fixed pixel widths, no class selectors, no CSS variables and no dark-mode
 * dependencies — Outlook drops all of those. The same output feeds the send
 * dialog's preview, so what the sender reviews is what recipients receive.
 */
@Injectable()
export class TrackerReportHtmlService {
  private static readonly NAVY = '#1F3864';
  private static readonly SUBTITLE_INK = '#C5D0E6';
  private static readonly INK = '#262626';
  private static readonly LABEL_INK = '#7F7F7F';
  private static readonly HAIRLINE = '#D0D7E5';
  private static readonly TINT = '#F4F7FB';
  private static readonly FONT = "Calibri, 'Segoe UI', Arial, sans-serif";

  /** Total is the table width: Outlook will not scroll, so it has to fit. */
  private static readonly COLS: { header: string; width: number }[] = [
    { header: 'Sr No',          width: 40  },
    { header: 'Item',           width: 140 },
    { header: 'Planned Start',  width: 68  },
    { header: 'Planned End',    width: 72  },
    { header: 'Actual Start',   width: 68  },
    { header: 'Actual End',     width: 68  },
    { header: 'Current Stage',  width: 100 },
    { header: 'Status',         width: 64  },
    { header: 'Remarks',        width: 260 },
  ];

  private static readonly TABLE_WIDTH = TrackerReportHtmlService.COLS.reduce((n, c) => n + c.width, 0);

  /** All report text is user-authored and lands in an outbound email. */
  private esc(value: string | number | null | undefined): string {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private escLines(value: string): string {
    return this.esc(value).replace(/\r?\n/g, '<br />');
  }

  private fmtDate(d: Date | string | null | undefined): string {
    if (!d) return '';
    const date = d instanceof Date ? d : new Date(d);
    return isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-GB');
  }

  /** ExcelJS ARGB ('FFFFC000') → CSS hex ('#FFC000'). */
  private argbToHex(argb: string): string {
    return `#${argb.slice(2)}`;
  }

  /** Amber and grey need dark text; green and red need light. */
  private readableInk(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? '#000000' : '#FFFFFF';
  }

  private sectionHeader(text: string): string {
    const { NAVY, TABLE_WIDTH } = TrackerReportHtmlService;
    return `<tr><td style="padding:0 0 4px 0;border-bottom:2px solid ${NAVY};text-align:center;font-size:10px;font-weight:bold;letter-spacing:0.06em;color:${NAVY};text-transform:uppercase;width:${TABLE_WIDTH}px;">${this.esc(text)}</td></tr>`;
  }

  private spacer(height = 12): string {
    return `<tr><td style="height:${height}px;line-height:${height}px;font-size:0;">&nbsp;</td></tr>`;
  }

  /** Superseded dates struck through above the current value, as in the workbook. */
  private dateCellWithHistory(history: string[], current: string): string {
    const { LABEL_INK } = TrackerReportHtmlService;
    if (!history.length) return this.esc(current) || '&nbsp;';
    const old = history
      .map(d => `<s style="color:${LABEL_INK};font-size:9px;">${this.esc(d)}</s>`)
      .join('<br />');
    return `${old}<br />${this.esc(current)}`;
  }

  private summaryBand(projectName: string, reportDate: Date, preparedBy: string): string {
    const { FONT, INK, LABEL_INK, HAIRLINE, TINT, COLS } = TrackerReportHtmlService;
    const fields: [string, string][] = [
      ['Report Date', this.fmtDate(reportDate)],
      ['Project Name', projectName],
      ['Prepared By', preparedBy],
    ];
    // Widths mirror the workbook's 4/3/3 column spans over the same grid.
    const spans = [
      COLS.slice(0, 4).reduce((n, c) => n + c.width, 0),
      COLS.slice(4, 7).reduce((n, c) => n + c.width, 0),
      COLS.slice(7, 10).reduce((n, c) => n + c.width, 0),
    ];

    const cells = fields
      .map(([label, value], i) =>
        `<td width="${spans[i]}" style="width:${spans[i]}px;background-color:${TINT};border:1px solid ${HAIRLINE};padding:5px 8px;font-family:${FONT};vertical-align:top;">` +
        `<div style="font-size:8px;font-weight:bold;letter-spacing:0.06em;color:${LABEL_INK};text-transform:uppercase;">${this.esc(label)}</div>` +
        `<div style="font-size:11px;font-weight:bold;color:${INK};padding-top:2px;">${this.esc(value) || '&nbsp;'}</div>` +
        `</td>`,
      )
      .join('');

    return `<tr><td style="padding:0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${TrackerReportHtmlService.TABLE_WIDTH}" style="border-collapse:collapse;width:${TrackerReportHtmlService.TABLE_WIDTH}px;"><tr>${cells}</tr></table></td></tr>`;
  }

  private overviewTable(rows: TrackerRow[]): string {
    const { FONT, NAVY, INK, HAIRLINE, TINT, COLS, TABLE_WIDTH } = TrackerReportHtmlService;

    const headerCells = COLS.map(
      c =>
        `<th width="${c.width}" bgcolor="${NAVY}" style="width:${c.width}px;background-color:${NAVY};color:#FFFFFF;font-family:${FONT};font-size:10px;font-weight:bold;text-align:center;vertical-align:middle;padding:5px 4px;border:1px solid ${HAIRLINE};">${this.esc(c.header)}</th>`,
    ).join('');

    const body = rows.length
      ? rows
          .map((row, i) => {
            const rag = this.argbToHex(computeRAGColor(row));
            const ragInk = this.readableInk(rag);
            const zebra = i % 2 === 0 ? TINT : '#FFFFFF';
            const base = `font-family:${FONT};font-size:10px;color:${INK};border:1px solid ${HAIRLINE};padding:4px 5px;vertical-align:top;background-color:${zebra};`;
            const centered = `${base}text-align:center;`;

            const remarks = row.remarks.length
              ? row.remarks
                  .map(r => `<div style="padding-bottom:2px;">${this.esc(r.date)}: ${this.escLines(r.content)}</div>`)
                  .join('')
              : '&nbsp;';

            return (
              `<tr>` +
              `<td style="${centered}">${this.esc(row.srNo)}</td>` +
              `<td style="${base}">${this.escLines(row.title)}</td>` +
              `<td style="${centered}">${this.esc(this.fmtDate(row.startDate)) || '&nbsp;'}</td>` +
              `<td style="${centered}">${this.dateCellWithHistory(row.endDateHistory, this.fmtDate(row.endDate))}</td>` +
              `<td style="${centered}">${this.esc(this.fmtDate(row.actualStartDate)) || '&nbsp;'}</td>` +
              `<td style="${centered}">${this.dateCellWithHistory(row.actualEndDateHistory, this.fmtDate(row.actualEndDate))}</td>` +
              `<td style="${base}">${this.escLines(row.currentStage) || '&nbsp;'}</td>` +
              // bgcolor and background-color both set: different Outlook builds honour different ones.
              `<td bgcolor="${rag}" style="font-family:${FONT};font-size:10px;font-weight:bold;color:${ragInk};background-color:${rag};border:1px solid ${HAIRLINE};padding:4px 5px;text-align:center;vertical-align:middle;">${this.esc(row.status.replace('_', ' '))}</td>` +
              `<td style="${base}">${remarks}</td>` +
              `</tr>`
            );
          })
          .join('')
      : `<tr><td colspan="${COLS.length}" style="font-family:${FONT};font-size:10px;color:${TrackerReportHtmlService.LABEL_INK};font-style:italic;text-align:center;padding:14px 5px;border:1px solid ${HAIRLINE};">No items yet.</td></tr>`;

    return `<tr><td style="padding:0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${TABLE_WIDTH}" style="border-collapse:collapse;width:${TABLE_WIDTH}px;table-layout:fixed;"><tr>${headerCells}</tr>${body}</table></td></tr>`;
  }

  /** The report block on its own — title band through overview table. */
  render(data: TrackerExportData): string {
    const { projectName, preparedBy, reportDate, statusSummary, rows } = data;
    const { FONT, NAVY, SUBTITLE_INK, INK, HAIRLINE, TINT, TABLE_WIDTH } = TrackerReportHtmlService;

    const title =
      `<tr><td bgcolor="${NAVY}" style="background-color:${NAVY};padding:10px 12px;text-align:center;font-family:${FONT};">` +
      `<div style="font-size:16px;font-weight:bold;color:#FFFFFF;">Delivery Tracker Report</div>` +
      `<div style="font-size:10px;color:${SUBTITLE_INK};padding-top:3px;">${this.esc(projectName)} &nbsp;&middot;&nbsp; ${this.esc(this.fmtDate(reportDate))}</div>` +
      `</td></tr>`;

    // Rich text from the editor — sanitised and inline-styled here; legacy plain
    // text is escaped and keeps its line breaks.
    const summaryText = renderRichText(statusSummary) || 'No remarks recorded yet.';
    const summaryBlock =
      `<tr><td style="background-color:${TINT};border:1px solid ${HAIRLINE};padding:8px 10px;font-family:${FONT};font-size:10px;color:${INK};line-height:1.5;">${summaryText}</td></tr>`;

    return (
      `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${TABLE_WIDTH}" style="border-collapse:collapse;width:${TABLE_WIDTH}px;font-family:${FONT};">` +
      title +
      this.spacer(14) +
      this.sectionHeader('Project Summary') +
      this.spacer(6) +
      this.summaryBand(projectName, reportDate, preparedBy) +
      this.spacer(14) +
      this.sectionHeader('Status Summary') +
      this.spacer(6) +
      summaryBlock +
      this.spacer(14) +
      this.sectionHeader('Project Overview') +
      this.spacer(6) +
      this.overviewTable(rows) +
      `</table>`
    );
  }

  /**
   * Full email body: the sender's message, a rule, then the report. `message` is
   * rich text from the send dialog — sanitised before it is inlined, since it is
   * user-authored content going into an outbound email.
   */
  renderEmail(data: TrackerExportData, message: string): string {
    const { FONT, INK, HAIRLINE, TABLE_WIDTH } = TrackerReportHtmlService;
    const noteHtml = renderRichText(message);
    const note = noteHtml
      ? `<div style="font-family:${FONT};font-size:13px;color:${INK};line-height:1.6;padding-bottom:14px;">${noteHtml}</div>` +
        `<div style="border-top:1px solid ${HAIRLINE};font-size:0;line-height:0;height:1px;margin-bottom:16px;">&nbsp;</div>`
      : '';
    // Outlook ignores max-width on divs, so the wrapper is a fixed-width table.
    return (
      `<div style="background-color:#FFFFFF;padding:16px;">` +
      `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${TABLE_WIDTH}" style="border-collapse:collapse;width:${TABLE_WIDTH}px;">` +
      `<tr><td style="padding:0;">${note}${this.render(data)}</td></tr>` +
      `</table></div>`
    );
  }

  /** Standalone document — used by the preview endpoint, which renders in an iframe. */
  renderDocument(data: TrackerExportData): string {
    return (
      `<!doctype html><html><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>Delivery Tracker Report</title></head>` +
      `<body style="margin:0;padding:0;background-color:#FFFFFF;">${this.renderEmail(data, '')}</body></html>`
    );
  }
}

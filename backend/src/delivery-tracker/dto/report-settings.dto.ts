import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Per-project header fields for the delivery tracker report. All optional —
 * clearing a field falls the report back to its generated default.
 */
export class ReportSettingsDto {
  /**
   * Date printed as "Report Date" on the report.
   * @example "2026-08-14"
   */
  @IsOptional()
  @IsDateString()
  reportDate?: string;

  /**
   * Name printed as "Prepared By" on the report.
   * @example "Arjun Sharma"
   */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  preparedBy?: string;

  /**
   * Free-text Status Summary section of the report.
   */
  // Rich text from the editor — HTML markup inflates the length well beyond what
  // the same text needed as plain text.
  @IsOptional()
  @IsString()
  @MaxLength(50000)
  statusSummary?: string;
}

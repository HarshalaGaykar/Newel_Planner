import { ArrayMinSize, IsArray, IsBoolean, IsDateString, IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class SendReportDto {
  /**
   * Primary recipient email addresses.
   * @example ["client.contact@example.com"]
   */
  @IsArray()
  @ArrayMinSize(1)
  @IsEmail({}, { each: true })
  to: string[];

  /**
   * CC'd email addresses.
   */
  @IsArray()
  @IsEmail({}, { each: true })
  @IsOptional()
  cc?: string[];

  /**
   * Email subject line.
   * @example "Delivery Tracker Report - Acme Interiors - 14 Aug 2026"
   */
  @IsString()
  @IsNotEmpty()
  subject: string;

  /**
   * Covering message shown above the report. Rich text (HTML) from the send
   * dialog's editor; sanitised server-side before it is rendered into the email.
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(50000)
  body: string;

  /**
   * Attach the Excel workbook in addition to the in-body report. Off by default:
   * the report itself is rendered into the message.
   */
  @IsBoolean()
  @IsOptional()
  includeExcelAttachment?: boolean;

  /**
   * Override for the Status Summary section of the attached Excel report.
   * Falls back to the auto-generated rollup of remarks when omitted.
   */
  @IsString()
  @IsOptional()
  statusSummary?: string;

  /**
   * Override for the "Report Date" field in the attached Excel report.
   * Defaults to the moment the report is generated.
   * @example "2026-08-14"
   */
  @IsDateString()
  @IsOptional()
  reportDate?: string;

  /**
   * Override for the "Prepared By" field in the attached Excel report.
   * Defaults to the name of the user sending it.
   * @example "Arjun Sharma"
   */
  @IsString()
  @MaxLength(120)
  @IsOptional()
  preparedBy?: string;
}

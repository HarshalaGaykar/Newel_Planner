import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class UpsertConfigDto {
  /**
   * The configuration value to store for the given key.
   * @example "30"
   */
  @IsString()
  @IsNotEmpty()
  value: string;

  /**
   * Human-readable label describing the configuration entry.
   * @example "Backdated Timesheet Days Limit"
   */
  @IsString()
  @IsOptional()
  label?: string;

  /**
   * Logical group the configuration entry belongs to.
   * @example "timesheet"
   */
  @IsString()
  @IsOptional()
  group?: string;
}

export class UpdateNumberSeriesDto {
  /**
   * Prefix prepended to every generated number in the series.
   * @example "PRJ"
   */
  @IsString()
  @IsNotEmpty()
  prefix: string;

  /**
   * Separator placed between the prefix and the numeric sequence.
   * @example "-"
   */
  @IsString()
  @IsOptional()
  separator?: string;

  /**
   * Number of digits the numeric sequence is zero-padded to.
   * @example 4
   */
  @IsNotEmpty()
  padding: number;
}

export class LockPeriodDto {
  /**
   * Month of the timesheet period to lock (1-12).
   * @example 7
   */
  @IsNotEmpty()
  month: number;

  /**
   * Calendar year of the timesheet period to lock.
   * @example 2026
   */
  @IsNotEmpty()
  year: number;
}

export class FinancialYearDto {
  /**
   * Display label identifying the financial year.
   * @example "FY 2026-27"
   */
  @IsString()
  @IsNotEmpty()
  label: string;

  /**
   * Month in which the financial year begins (1-12).
   * @example 4
   */
  @IsNotEmpty()
  startMonth: number;

  /**
   * Calendar year in which the financial year begins.
   * @example 2026
   */
  @IsNotEmpty()
  startYear: number;

  /**
   * Month in which the financial year ends (1-12).
   * @example 3
   */
  @IsNotEmpty()
  endMonth: number;

  /**
   * Calendar year in which the financial year ends.
   * @example 2027
   */
  @IsNotEmpty()
  endYear: number;
}

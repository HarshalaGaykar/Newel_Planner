import {
  IsString, IsNotEmpty, IsOptional, IsBoolean, IsNumber, Min,
} from 'class-validator';

export class CreateCurrencyDto {
  /**
   * The ISO 4217 currency code identifying the currency.
   * @example "USD"
   */
  @IsString()
  @IsNotEmpty()
  code: string;

  /**
   * The full human-readable name of the currency.
   * @example "US Dollar"
   */
  @IsString()
  @IsNotEmpty()
  name: string;

  /**
   * The display symbol used to represent the currency.
   * @example "$"
   */
  @IsString()
  @IsNotEmpty()
  symbol: string;

  /**
   * The exchange rate of this currency relative to the base currency.
   * @example 1.0
   */
  @IsNumber()
  @Min(0)
  @IsOptional()
  exchangeRate?: number;

  /**
   * Whether this currency is the base currency for conversions.
   * @example true
   */
  @IsBoolean()
  @IsOptional()
  isBase?: boolean;

  /**
   * Whether this currency is currently active and available for use.
   * @example true
   */
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

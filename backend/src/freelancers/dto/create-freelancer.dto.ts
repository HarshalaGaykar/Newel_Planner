import {
  IsString,
  IsEmail,
  IsOptional,
  IsInt,
  IsNumber,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  Min,
} from 'class-validator';
import { RateType, NdaStatus, FreelancerStatus } from '@prisma/client';

export class CreateFreelancerDto {
  /**
   * Full legal name of the freelancer.
   * @example "Jane Doe"
   */
  @IsString()
  @IsNotEmpty()
  fullName: string;

  /**
   * Primary email address used to contact the freelancer.
   * @example "jane.doe@example.com"
   */
  @IsEmail()
  email: string;

  /**
   * Contact mobile phone number of the freelancer.
   * @example "+1-202-555-0143"
   */
  @IsOptional()
  @IsString()
  mobile?: string;

  /**
   * Identifier of the vendor or agency the freelancer is associated with.
   * @example "7c9e6679-7425-40de-944b-e07fc1f90ae7"
   */
  @IsOptional()
  @IsString()
  vendorId?: string;

  /**
   * Total years of professional experience the freelancer has.
   * @example 8
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  experience?: number;

  /**
   * Country where the freelancer is based.
   * @example "India"
   */
  @IsOptional()
  @IsString()
  country?: string;

  /**
   * City or specific location of the freelancer.
   * @example "Pune"
   */
  @IsOptional()
  @IsString()
  location?: string;

  /**
   * Date on which the freelancer's contract begins.
   * @example "2026-07-15"
   */
  @IsDateString()
  contractStart: string;

  /**
   * Date on which the freelancer's contract ends.
   * @example "2027-07-14"
   */
  @IsDateString()
  contractEnd: string;

  /**
   * Basis on which the freelancer is charged for their work.
   * @example "HOURLY"
   */
  @IsOptional()
  @IsEnum(RateType)
  rateType?: RateType;

  /**
   * Internal cost incurred per hour of the freelancer's work.
   * @example 40
   */
  @IsNumber()
  @Min(0)
  costPerHour: number;

  /**
   * Rate billed to the client per hour for the freelancer's work.
   * @example 65
   */
  @IsNumber()
  @Min(0)
  billingRate: number;

  /**
   * Identifier of the currency used for the freelancer's rates.
   * @example "7c9e6679-7425-40de-944b-e07fc1f90ae7"
   */
  @IsOptional()
  @IsString()
  currencyId?: string;

  /**
   * Current status of the freelancer's non-disclosure agreement.
   * @example "SIGNED"
   */
  @IsOptional()
  @IsEnum(NdaStatus)
  ndaStatus?: NdaStatus;

  /**
   * URL pointing to the signed agreement or contract document.
   * @example "https://files.example.com/agreements/jane-doe.pdf"
   */
  @IsOptional()
  @IsString()
  agreementUrl?: string;

  /**
   * Current engagement status of the freelancer.
   * @example "ACTIVE"
   */
  @IsOptional()
  @IsEnum(FreelancerStatus)
  status?: FreelancerStatus;
}

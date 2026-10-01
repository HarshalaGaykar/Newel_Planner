import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ClientContactDto {
  /**
   * Name of this contact person at the client organization.
   * @example "Priya Sharma"
   */
  @IsString()
  @IsNotEmpty()
  name: string;

  /**
   * Email address of this contact person.
   * @example "priya.sharma@acmeinteriors.com"
   */
  @IsEmail()
  email: string;

  /**
   * Job title/designation of this contact at the client organization.
   * @example "Procurement Manager"
   */
  @IsString()
  @IsOptional()
  designation?: string;

  /**
   * Whether this contact is currently active.
   * @example true
   */
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

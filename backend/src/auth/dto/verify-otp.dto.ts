import { IsEmail, IsNotEmpty, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class VerifyOtpDto {
  /**
   * Email address the OTP was sent to.
   * @example "jane.doe@newel.com"
   */
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  @IsEmail()
  @IsNotEmpty()
  email: string;

  /**
   * Six digit one-time password delivered by email.
   * @example "482915"
   */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(/^\d{6}$/, { message: 'OTP must be exactly 6 digits' })
  otp: string;
}

import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Match } from './match.decorator';

export const PASSWORD_RULE =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;

export const PASSWORD_RULE_MESSAGE =
  'Password must contain an uppercase letter, a lowercase letter, a number and a special character';

export class ResetPasswordDto {
  /**
   * Short lived reset token issued after a successful OTP verification.
   * @example "9f1c1a2b3d4e5f6071829304a5b6c7d8e9f0a1b2c3d4e5f60718293041a2b3c4"
   */
  @IsString()
  @IsNotEmpty()
  resetToken: string;

  /**
   * New password to set for the account.
   * @example "N3wS3cure@Pass"
   */
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(PASSWORD_RULE, { message: PASSWORD_RULE_MESSAGE })
  newPassword: string;

  /**
   * Repeat of the new password. Must be identical to newPassword.
   * @example "N3wS3cure@Pass"
   */
  @IsString()
  @IsNotEmpty()
  @Match('newPassword', { message: 'Passwords do not match' })
  confirmPassword: string;
}

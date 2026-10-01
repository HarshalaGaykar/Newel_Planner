import { IsDateString, IsNotEmpty, IsNumber, IsPositive, IsUUID } from 'class-validator';

export class CreateCompOffDto {
  /**
   * Unique identifier of the user the comp-off request belongs to.
   * @example "7c9e6679-7425-40de-944b-e07fc1f90ae7"
   */
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  /**
   * The date on which the extra work was performed that earns the comp-off.
   * @example "2026-07-15"
   */
  @IsDateString()
  @IsNotEmpty()
  date: string;

  /**
   * Number of hours worked on the given date that qualify for comp-off.
   * @example 8
   */
  @IsNumber()
  @IsPositive()
  hoursWorked: number;
}

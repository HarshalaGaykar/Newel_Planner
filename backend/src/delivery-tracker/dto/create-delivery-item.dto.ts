import { IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { DeliveryStatus } from '../delivery-tracker.types';

export class CreateDeliveryItemDto {
  /**
   * Sequential display number ordering this item within the project tracker.
   * @example 1
   */
  @IsInt()
  @Min(1)
  srNo: number;

  /**
   * Short title describing the delivery item or deliverable.
   * @example "Kitchen cabinet shop drawings"
   */
  @IsString()
  @IsNotEmpty()
  title: string;

  /**
   * Planned start date of the delivery item.
   * @example "2026-07-15"
   */
  @IsOptional()
  @IsDateString()
  plannedStart?: string;

  /**
   * Planned completion date of the delivery item.
   * @example "2026-07-30"
   */
  @IsOptional()
  @IsDateString()
  plannedEnd?: string;

  /**
   * Date the delivery item actually started.
   * @example "2026-07-16"
   */
  @IsOptional()
  @IsDateString()
  actualStart?: string;

  /**
   * Date the delivery item was actually completed.
   * @example "2026-08-02"
   */
  @IsOptional()
  @IsDateString()
  actualEnd?: string;

  /**
   * Id of the delivery stage from the stage master. Empty string clears it.
   * @example "4a9a76e5-c9c4-4d24-8d0c-93f3a277411f"
   */
  @IsOptional()
  @IsString()
  stageId?: string;

  /**
   * Overall delivery status of the item.
   * @example "IN_PROGRESS"
   */
  @IsOptional()
  @IsEnum(DeliveryStatus)
  status?: DeliveryStatus;

  /**
   * Optional initial remark to record against this delivery item at creation time.
   * @example "Kickoff call held with client on 15th."
   */
  @IsOptional()
  @IsString()
  remarks?: string;
}

import { IsString, IsNotEmpty } from 'class-validator';

export class CreateSpokespersonDto {
  /**
   * Display name of the client-side spokesperson.
   * @example "Ravi Kumar"
   */
  @IsString()
  @IsNotEmpty()
  name: string;

  /**
   * Identifier of the client this spokesperson belongs to.
   * @example "7c9e6679-7425-40de-944b-e07fc1f90ae7"
   */
  @IsString()
  @IsNotEmpty()
  clientId: string;
}

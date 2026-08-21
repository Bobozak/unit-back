import { ApiProperty } from '@nestjs/swagger';

export class UnitnameAvailableResponseDto {
  @ApiProperty({ example: true })
  available: boolean;
}

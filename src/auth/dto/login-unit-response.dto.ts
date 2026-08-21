import { ApiProperty } from '@nestjs/swagger';
import { IsJWT } from 'class-validator';

export class LoginUnitResponseDto {
  @IsJWT()
  @ApiProperty()
  accessToken: string;
}

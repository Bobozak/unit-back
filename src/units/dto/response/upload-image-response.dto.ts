import { ApiProperty } from '@nestjs/swagger';

export class UploadImageResponseDto {
  @ApiProperty({
    example:
      'https://res.cloudinary.com/dvtqfngv5/image/upload/v1731847029/example.png',
  })
  secure_url: string;
}

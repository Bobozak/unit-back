import {
  Body,
  Controller,
  Delete,
  FileTypeValidator,
  Get,
  MaxFileSizeValidator,
  ParseFilePipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { AllowWhenBlocked, Unit } from '@/common';

import { DeleteMeDto } from './dto/delete-me.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { UnitEntity } from './entities/unit.entity';
import {
  DeleteMeDocs,
  GetMeDocs,
  UpdateMeDocs,
  UploadImageDocs,
} from './swagger-docs';
import { UnitsService } from './units.service';

@Controller('units')
@ApiTags('Units')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  @Get('me')
  @AllowWhenBlocked()
  @GetMeDocs()
  async loadUnit(@Unit() unit: UnitEntity) {
    return await this.unitsService.me(unit.id);
  }

  @Patch('me')
  @UpdateMeDocs()
  updateMe(@Unit('id') unitId: string, @Body() updateUnitDto: UpdateUnitDto) {
    return this.unitsService.update(unitId, updateUnitDto);
  }

  @Delete('me')
  @UseGuards(JwtAuthGuard)
  @DeleteMeDocs()
  async deleteMe(@Unit('id') id: string, @Body() dto: DeleteMeDto) {
    return this.unitsService.deleteMe(id, dto.securityAnswer);
  }

  @Post('image')
  @UseInterceptors(FileInterceptor('image'))
  @UploadImageDocs()
  async uploadImage(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 2 * 1024 * 1024 }), // 2MB
          new FileTypeValidator({ fileType: /image\// }),
        ],
      }),
    )
    image: Express.Multer.File,
    @Unit('id') unitId: string,
  ) {
    const imageUrl = await this.unitsService.uploadImage(image, unitId);
    return imageUrl;
  }
}

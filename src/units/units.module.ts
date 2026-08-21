import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CloudinaryService } from '@/cloudinary/cloudinary.service';
import { Session } from '@/session/entities/session.entity';
import { SessionService } from '@/session/session.service';

import { UnitEntity } from './entities/unit.entity';
import { UnitsController } from './units.controller';
import { UnitsService } from './units.service';

@Module({
  imports: [TypeOrmModule.forFeature([UnitEntity, Session])],
  controllers: [UnitsController],
  providers: [SessionService, UnitsService, CloudinaryService],
  exports: [UnitsService],
})
export class UnitsModule {}

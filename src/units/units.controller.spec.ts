import { Test, TestingModule } from '@nestjs/testing';

import { TEST_UNIT_ID } from '../../test/helpers/uuid-fixtures';
import { UnitEntity } from './entities/unit.entity';
import { UnitsController } from './units.controller';
import { UnitsService } from './units.service';

describe('UnitsController', () => {
  let controller: UnitsController;

  const unitsService = {
    me: jest.fn(),
    update: jest.fn(),
    deleteMe: jest.fn(),
    uploadImage: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UnitsController],
      providers: [{ provide: UnitsService, useValue: unitsService }],
    }).compile();

    controller = module.get<UnitsController>(UnitsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('loadUnit delegates to unitsService.me', async () => {
    const unit = { id: TEST_UNIT_ID, unitname: 'Kira' } as UnitEntity;
    const profile = { id: TEST_UNIT_ID, unitname: 'Kira' };
    unitsService.me.mockResolvedValue(profile);

    const result = await controller.loadUnit(unit);

    expect(unitsService.me).toHaveBeenCalledWith(TEST_UNIT_ID);
    expect(result).toEqual(profile);
  });

  it('updateMe delegates to unitsService.update', async () => {
    const dto = { unitname: 'Kira' };
    const updated = { id: TEST_UNIT_ID, ...dto };
    unitsService.update.mockResolvedValue(updated);

    const result = await controller.updateMe(TEST_UNIT_ID, dto as any);

    expect(unitsService.update).toHaveBeenCalledWith(TEST_UNIT_ID, dto);
    expect(result).toEqual(updated);
  });

  it('deleteMe delegates to unitsService.deleteMe', async () => {
    const deleteResult = { affected: 1 };
    const dto = { securityAnswer: 'night city' };
    unitsService.deleteMe.mockResolvedValue(deleteResult);

    const result = await controller.deleteMe(TEST_UNIT_ID, dto);

    expect(unitsService.deleteMe).toHaveBeenCalledWith(
      TEST_UNIT_ID,
      dto.securityAnswer,
    );
    expect(result).toEqual(deleteResult);
  });

  it('uploadImage delegates to unitsService.uploadImage', async () => {
    const file = {
      originalname: 'avatar.png',
      mimetype: 'image/png',
      buffer: Buffer.from('img'),
    } as Express.Multer.File;
    const response = { secure_url: 'https://cdn.example/new.png' };
    unitsService.uploadImage.mockResolvedValue(response);

    const result = await controller.uploadImage(file, TEST_UNIT_ID);

    expect(unitsService.uploadImage).toHaveBeenCalledWith(file, TEST_UNIT_ID);
    expect(result).toEqual(response);
  });
});

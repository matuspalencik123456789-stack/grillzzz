import { Module } from '@nestjs/common';
import { GrillzController } from './grillz.controller';
import { GrillzService } from './grillz.service';
import { ManufacturingService } from './manufacturing.service';
import { PricingModule } from '../pricing/pricing.module';

@Module({
  imports: [PricingModule],
  controllers: [GrillzController],
  providers: [GrillzService, ManufacturingService],
  exports: [GrillzService, ManufacturingService],
})
export class GrillzModule {}

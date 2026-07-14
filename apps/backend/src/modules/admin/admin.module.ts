import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { CatalogModule } from '../catalog/catalog.module';
import { PricingModule } from '../pricing/pricing.module';

@Module({
  imports: [CatalogModule, PricingModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}

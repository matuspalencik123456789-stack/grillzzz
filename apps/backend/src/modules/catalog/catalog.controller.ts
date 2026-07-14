import { Controller, Get } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { Public } from '../../common/decorators';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Public()
  @Get('materials')
  materials() {
    return this.catalog.listMaterials();
  }

  @Public()
  @Get('patterns')
  patterns() {
    return this.catalog.listPatterns();
  }
}

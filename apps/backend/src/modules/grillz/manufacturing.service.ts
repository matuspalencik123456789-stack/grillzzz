import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@grillz/database';
import {
  analyzeMesh,
  buildGrillzShell,
  exportGlb,
  exportObj,
  exportStl,
  parseGlb,
  type RawMesh,
} from '@grillz/cad-engine';
import type { GrillzConfig, PriceQuote, TriangleRange } from '@grillz/shared-types';
import { fdiDisplayName } from '@grillz/shared-types';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../../infra/prisma.module';
import { StorageService } from '../../infra/storage.module';
import { AuditService } from '../audit/audit.service';

export interface ManufacturingArtifact {
  format: 'STL' | 'OBJ' | 'GLTF' | 'PDF';
  fileKey: string;
  sizeBytes: number;
}

/**
 * Manufacturing export: rebuilds the shell from the segmented scan, writes
 * STL/OBJ/GLB and the printable production report to S3, and records the
 * artifact set on the design. Used by the studio "Export" action and by the
 * production-job creation flow after payment.
 */
@Injectable()
export class ManufacturingService {
  private readonly logger = new Logger(ManufacturingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  async exportAll(grillzId: string, actorId: string): Promise<ManufacturingArtifact[]> {
    const grillz = await this.prisma.grillz.findUnique({
      where: { id: grillzId },
      include: {
        material: true,
        pattern: true,
        diamondSetting: true,
        project: { include: { scans: { where: { status: 'READY' }, include: { teeth: true } } } },
      },
    });
    if (!grillz) throw new NotFoundException('Design not found');

    const config = grillz.configJson as unknown as GrillzConfig;
    const shell = await this.buildShell(grillz.project.scans, config);
    const analysis = analyzeMesh(shell);

    const base = `manufacturing/${grillzId}`;
    const artifacts: ManufacturingArtifact[] = [];

    const stl = exportStl(shell, `Grillz Studio ${grillz.name}`);
    await this.storage.putObject(`${base}/grillz.stl`, stl, 'model/stl');
    artifacts.push({ format: 'STL', fileKey: `${base}/grillz.stl`, sizeBytes: stl.length });

    const obj = exportObj(shell, grillz.name.replace(/\s+/g, '_'));
    await this.storage.putObject(`${base}/grillz.obj`, obj, 'model/obj');
    artifacts.push({ format: 'OBJ', fileKey: `${base}/grillz.obj`, sizeBytes: obj.length });

    const glb = exportGlb(shell, {
      name: grillz.name,
      baseColorHex: grillz.material.colorHex,
      metallic: grillz.material.metalness,
      roughness: grillz.material.roughness,
    });
    await this.storage.putObject(`${base}/grillz.glb`, glb, 'model/gltf-binary');
    artifacts.push({ format: 'GLTF', fileKey: `${base}/grillz.glb`, sizeBytes: glb.length });

    const pdf = await this.productionReport(grillz, config, {
      volumeMm3: analysis.volumeMm3,
      surfaceAreaMm2: analysis.surfaceAreaMm2,
      triangleCount: analysis.triangleCount,
      watertight: analysis.watertight,
    });
    await this.storage.putObject(`${base}/production-report.pdf`, pdf, 'application/pdf');
    artifacts.push({ format: 'PDF', fileKey: `${base}/production-report.pdf`, sizeBytes: pdf.length });

    await this.prisma.grillz.update({
      where: { id: grillzId },
      data: { exportedFiles: artifacts as unknown as Prisma.InputJsonValue },
    });
    this.audit.record({
      actorId,
      action: 'grillz.export_manufacturing',
      entityType: 'Grillz',
      entityId: grillzId,
      metadata: { formats: artifacts.map((a) => a.format) },
    });
    this.logger.log(`exported ${artifacts.length} artifacts for design ${grillzId}`);
    return artifacts;
  }

  async presignArtifacts(grillzId: string): Promise<Array<ManufacturingArtifact & { url: string }>> {
    const grillz = await this.prisma.grillz.findUnique({ where: { id: grillzId } });
    if (!grillz?.exportedFiles) throw new BadRequestException('No manufacturing export yet');
    const artifacts = grillz.exportedFiles as unknown as ManufacturingArtifact[];
    return Promise.all(
      artifacts.map(async (a) => ({
        ...a,
        url: await this.storage.presignDownload(a.fileKey, 3600, a.fileKey.split('/').pop()),
      })),
    );
  }

  /** Rebuilds the shell mesh for a design from its project's segmented scans. */
  async buildShell(
    scans: Array<{
      processedGlbKey: string | null;
      teeth: Array<{ fdiNumber: number; triangleRange: unknown }>;
    }>,
    config: GrillzConfig,
  ): Promise<RawMesh> {
    const wanted = new Set(config.toothNumbers);

    for (const scan of scans) {
      if (!scan.processedGlbKey) continue;
      const ranges: TriangleRange[] = scan.teeth
        .filter((t) => wanted.has(t.fdiNumber))
        .map((t) => t.triangleRange as TriangleRange);
      if (ranges.length === 0) continue;

      const glb = await this.storage.getObject(scan.processedGlbKey);
      const mesh = parseGlb(glb);
      return buildGrillzShell(mesh, ranges, config.geometry);
    }
    throw new BadRequestException(
      'No processed scan covers the selected teeth — upload and process a dental scan first',
    );
  }

  private productionReport(
    grillz: {
      id: string;
      name: string;
      toothNumbers: number[];
      material: { name: string };
      pattern: { name: string } | null;
      diamondSetting: {
        stoneType: string;
        shape: string;
        stoneSizeMm: number;
        spacingMm: number;
        density: number;
      } | null;
      priceSnapshot: unknown;
      engravingText: string | null;
    },
    config: GrillzConfig,
    mesh: { volumeMm3: number; surfaceAreaMm2: number; triangleCount: number; watertight: boolean },
  ): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 48 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(new Uint8Array(Buffer.concat(chunks))));
      doc.on('error', reject);

      const line = (label: string, value: string) => {
        doc.font('Helvetica-Bold').fontSize(10).text(label, { continued: true });
        doc.font('Helvetica').text(`  ${value}`);
      };

      doc.font('Helvetica-Bold').fontSize(22).text('GRILLZ STUDIO', { align: 'left' });
      doc.font('Helvetica').fontSize(11).fillColor('#666666')
        .text('Production Work Order', { align: 'left' })
        .fillColor('#000000')
        .moveDown(1.5);

      doc.font('Helvetica-Bold').fontSize(14).text(grillz.name).moveDown(0.5);
      line('Design ID:', grillz.id);
      line('Generated:', new Date().toISOString());
      doc.moveDown();

      doc.font('Helvetica-Bold').fontSize(12).text('Coverage').moveDown(0.3);
      line('Set type:', config.setType);
      line('Teeth (FDI):', grillz.toothNumbers.map((n) => fdiDisplayName(n)).join(', '));
      doc.moveDown();

      doc.font('Helvetica-Bold').fontSize(12).text('Material & Finish').moveDown(0.3);
      line('Material:', grillz.material.name);
      line('Finish:', config.finish);
      line('Pattern:', grillz.pattern?.name ?? 'Classic');
      if (grillz.engravingText) line('Engraving:', `"${grillz.engravingText}"`);
      doc.moveDown();

      doc.font('Helvetica-Bold').fontSize(12).text('Geometry (mm)').moveDown(0.3);
      line('Wall thickness:', config.geometry.thicknessMm.toFixed(2));
      line('Offset:', config.geometry.offsetMm.toFixed(2));
      line('Fit tolerance (cement gap):', config.geometry.fitToleranceMm.toFixed(2));
      line('Chamfer:', config.geometry.chamferMm.toFixed(2));
      line('Edge radius:', config.geometry.edgeRadiusMm.toFixed(2));
      doc.moveDown();

      if (grillz.diamondSetting) {
        doc.font('Helvetica-Bold').fontSize(12).text('Stone Setting').moveDown(0.3);
        line('Stone type:', grillz.diamondSetting.stoneType.replace('_', ' '));
        line('Shape:', grillz.diamondSetting.shape);
        line('Stone size:', `${grillz.diamondSetting.stoneSizeMm.toFixed(2)} mm`);
        line('Spacing:', `${grillz.diamondSetting.spacingMm.toFixed(2)} mm`);
        line('Coverage density:', `${Math.round(grillz.diamondSetting.density * 100)}%`);
        doc.moveDown();
      }

      doc.font('Helvetica-Bold').fontSize(12).text('CAD Mesh').moveDown(0.3);
      line('Shell volume:', `${mesh.volumeMm3.toFixed(1)} mm³`);
      line('Surface area:', `${mesh.surfaceAreaMm2.toFixed(1)} mm²`);
      line('Triangles:', String(mesh.triangleCount));
      line('Watertight:', mesh.watertight ? 'yes' : 'NO — REVIEW BEFORE PRINTING');
      doc.moveDown();

      const quote = grillz.priceSnapshot as PriceQuote | null;
      if (quote) {
        doc.font('Helvetica-Bold').fontSize(12).text('Commercials').moveDown(0.3);
        line('Estimated metal weight:', `${quote.computed.metalWeightGrams.toFixed(2)} g`);
        line('Stone count:', String(quote.computed.stoneCount));
        line('Labor estimate:', `${quote.computed.laborHours.toFixed(1)} h`);
        line('Quote total:', `$${(quote.totalMinor / 100).toFixed(2)} ${quote.currency}`);
        line('Price book:', quote.priceBookVersion);
      }

      doc.moveDown(2);
      doc.fontSize(8).fillColor('#999999').text(
        'Files: grillz.stl (print/cast), grillz.obj (CAM), grillz.glb (visual). ' +
          'Chamfer and edge radius are post-machining parameters, not baked into the mesh.',
      );

      doc.end();
    });
  }
}

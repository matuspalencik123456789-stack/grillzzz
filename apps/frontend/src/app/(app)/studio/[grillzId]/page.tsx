'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  fdiDisplayName,
  GEOMETRY_LIMITS,
  grillzSetTypeSchema,
  materialTypeSchema,
  patternKindSchema,
  stoneShapeSchema,
  stoneTypeSchema,
  surfaceFinishSchema,
  type GrillzConfig,
  type PriceQuote,
} from '@grillz/shared-types';
import { LIGHTING_PRESETS } from '@grillz/three-engine';
import {
  Badge,
  Button,
  Label,
  Skeleton,
  Slider,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  cn,
} from '@grillz/ui';
import {
  useDesign,
  useExportDesign,
  useMaterials,
  usePatterns,
  useProject,
  useScanMeshUrl,
  useUpdateDesign,
} from '@/features/api/hooks';
import { useStudioStore } from '@/features/studio/store';
import { PricePanel } from '@/features/studio/PricePanel';
import { AiPanel } from '@/features/studio/AiPanel';
import { CheckoutDialog } from '@/features/studio/CheckoutDialog';
import { formatBytes } from '@/lib/format';

// three.js must never render on the server
const StudioViewer = dynamic(() => import('@/features/studio/StudioViewer'), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

const SET_TYPES = grillzSetTypeSchema.options;
const MATERIALS = materialTypeSchema.options;
const FINISHES = surfaceFinishSchema.options;
const STONE_TYPES = stoneTypeSchema.options;
const STONE_SHAPES = stoneShapeSchema.options;
const PATTERNS = patternKindSchema.options;

export default function StudioPage({ params }: { params: { grillzId: string } }) {
  const { grillzId } = params;
  const { data: design } = useDesign(grillzId);
  const { data: project } = useProject(design?.projectId ?? '', {});
  const updateDesign = useUpdateDesign(grillzId);
  const exportDesign = useExportDesign(grillzId);

  const config = useStudioStore((s) => s.config);
  const dirty = useStudioStore((s) => s.dirty);
  const viewer = useStudioStore((s) => s.viewer);
  const hoveredTooth = useStudioStore((s) => s.hoveredTooth);
  const loadConfig = useStudioStore((s) => s.loadConfig);
  const markSaved = useStudioStore((s) => s.markSaved);
  const applySetType = useStudioStore((s) => s.applySetType);
  const updateConfig = useStudioStore((s) => s.updateConfig);
  const updateGeometry = useStudioStore((s) => s.updateGeometry);
  const updateDiamonds = useStudioStore((s) => s.updateDiamonds);
  const setViewer = useStudioStore((s) => s.setViewer);

  const [quote, setQuote] = useState<PriceQuote | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  // hydrate the store once per design load
  useEffect(() => {
    if (design) loadConfig(design.configJson as GrillzConfig);
  }, [design, loadConfig]);

  // autosave: push dirty configs to the server after 1.2 s of quiet
  useEffect(() => {
    if (!dirty || !design) return;
    const timer = setTimeout(() => {
      updateDesign.mutate({ config }, { onSuccess: () => markSaved() });
    }, 1200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, dirty]);

  const readyScan = useMemo(
    () => project?.scans.find((s) => s.status === 'READY' && (s.teeth?.length ?? 0) > 0),
    [project],
  );
  const { data: meshUrl } = useScanMeshUrl(readyScan?.id ?? null);
  const availableTeeth = useMemo(
    () => readyScan?.teeth?.map((t) => t.fdiNumber) ?? [],
    [readyScan],
  );

  const { data: materials } = useMaterials();
  const { data: patterns } = usePatterns();

  if (!design) {
    return (
      <div className="mx-auto max-w-7xl space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-[70vh]" />
      </div>
    );
  }

  const locked = design.status === 'LOCKED' || design.status === 'IN_PRODUCTION';

  return (
    <div className="mx-auto max-w-[1500px]">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link href={`/projects/${design.projectId}`} className="text-sm text-muted-foreground hover:text-foreground">
          ← {design.project?.name ?? 'Project'}
        </Link>
        <h1 className="font-display text-xl">{design.name}</h1>
        <Badge variant={locked ? 'gold' : 'outline'}>{design.status.toLowerCase()}</Badge>
        <span className="text-xs text-muted-foreground">
          {dirty ? 'saving…' : updateDesign.isPending ? 'saving…' : 'saved'}
        </span>
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportDesign.mutate()}
            disabled={exportDesign.isPending || !readyScan}
          >
            {exportDesign.isPending ? 'Exporting…' : 'Export manufacturing files'}
          </Button>
          <Button
            variant="gold"
            size="sm"
            onClick={() => setCheckoutOpen(true)}
            disabled={!quote || locked}
          >
            Order
          </Button>
        </div>
      </div>

      {exportDesign.data && (
        <div className="glass mb-4 flex flex-wrap items-center gap-3 rounded-lg p-3 text-sm">
          <span className="text-muted-foreground">Manufacturing files:</span>
          {exportDesign.data.map((artifact) => (
            <a
              key={artifact.format}
              href={artifact.url}
              className="text-gold-300 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              {artifact.format} ({formatBytes(artifact.sizeBytes)})
            </a>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* ── viewer ────────────────────────────────────────────────────── */}
        <div className="glass relative h-[72vh] overflow-hidden rounded-xl">
          {readyScan && meshUrl ? (
            <StudioViewer scan={readyScan} meshUrl={meshUrl.url} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <p className="text-muted-foreground">No processed scan in this project yet.</p>
              <Link href={`/projects/${design.projectId}`}>
                <Button variant="outline" size="sm">
                  Upload a dental scan
                </Button>
              </Link>
            </div>
          )}

          {/* toolbar */}
          <div className="absolute left-3 top-3 flex flex-col gap-2">
            <div className="glass flex gap-1 rounded-lg p-1">
              {Object.values(LIGHTING_PRESETS).map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setViewer({ lighting: preset.id })}
                  className={cn(
                    'rounded-md px-2 py-1 text-xs transition-colors',
                    viewer.lighting === preset.id
                      ? 'bg-gold-500/20 text-gold-200'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="glass flex gap-1 rounded-lg p-1">
              <ToolbarToggle
                label="Wireframe"
                active={viewer.wireframe}
                onClick={() => setViewer({ wireframe: !viewer.wireframe })}
              />
              <ToolbarToggle
                label="Section"
                active={viewer.sectionEnabled}
                onClick={() => setViewer({ sectionEnabled: !viewer.sectionEnabled })}
              />
              <ToolbarToggle
                label="Measure"
                active={viewer.measureActive}
                onClick={() => setViewer({ measureActive: !viewer.measureActive })}
              />
              <ToolbarToggle
                label="Scan"
                active={viewer.showScan}
                onClick={() => setViewer({ showScan: !viewer.showScan })}
              />
            </div>
            {viewer.sectionEnabled && (
              <div className="glass w-44 rounded-lg p-3">
                <Label className="text-xs text-muted-foreground">Section offset</Label>
                <Slider
                  className="mt-2"
                  min={-40}
                  max={40}
                  step={0.5}
                  value={[viewer.sectionOffset]}
                  onValueChange={([v]) => setViewer({ sectionOffset: v ?? 0 })}
                />
              </div>
            )}
          </div>

          {hoveredTooth !== null && (
            <div className="glass pointer-events-none absolute bottom-3 left-3 rounded-lg px-3 py-1.5 text-xs">
              {fdiDisplayName(hoveredTooth)}
            </div>
          )}
          <div className="glass pointer-events-none absolute bottom-3 right-3 rounded-lg px-3 py-1.5 text-[11px] text-muted-foreground">
            click: select · shift+click: multi-select · drag: orbit · right-drag: pan · wheel: zoom
          </div>
        </div>

        {/* ── control panels ────────────────────────────────────────────── */}
        <div className="flex max-h-[72vh] flex-col gap-4 overflow-y-auto pr-1">
          <Tabs defaultValue="design">
            <TabsList className="w-full">
              <TabsTrigger value="design" className="flex-1">Design</TabsTrigger>
              <TabsTrigger value="stones" className="flex-1">Stones</TabsTrigger>
              <TabsTrigger value="fit" className="flex-1">Fit</TabsTrigger>
              <TabsTrigger value="ai" className="flex-1">AI</TabsTrigger>
            </TabsList>

            <TabsContent value="design" className="space-y-5">
              <PanelSection title="Set">
                <div className="grid grid-cols-4 gap-1.5">
                  {SET_TYPES.map((setType) => (
                    <OptionChip
                      key={setType}
                      label={setType.replace('_', ' ').toLowerCase()}
                      active={config.setType === setType}
                      disabled={locked || availableTeeth.length === 0}
                      onClick={() => applySetType(setType, availableTeeth)}
                    />
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {config.toothNumbers.length} teeth: {config.toothNumbers.join(', ')}
                </p>
              </PanelSection>

              <PanelSection title="Material">
                <div className="grid grid-cols-2 gap-1.5">
                  {MATERIALS.map((material) => {
                    const row = materials?.find((m) => m.type === material);
                    return (
                      <OptionChip
                        key={material}
                        label={row?.name ?? material.replace('_', ' ').toLowerCase()}
                        active={config.material === material}
                        disabled={locked}
                        onClick={() => updateConfig({ material })}
                        swatch={row?.colorHex}
                      />
                    );
                  })}
                </div>
              </PanelSection>

              <PanelSection title="Finish">
                <div className="grid grid-cols-4 gap-1.5">
                  {FINISHES.map((finish) => (
                    <OptionChip
                      key={finish}
                      label={finish.toLowerCase()}
                      active={config.finish === finish}
                      disabled={locked}
                      onClick={() => updateConfig({ finish })}
                    />
                  ))}
                </div>
              </PanelSection>

              <PanelSection title="Pattern">
                <div className="grid grid-cols-2 gap-1.5">
                  {PATTERNS.map((pattern) => {
                    const row = patterns?.find((p) => p.kind === pattern);
                    return (
                      <OptionChip
                        key={pattern}
                        label={row?.name ?? pattern.replace('_', ' ').toLowerCase()}
                        active={config.pattern === pattern}
                        disabled={locked}
                        onClick={() => updateConfig({ pattern })}
                      />
                    );
                  })}
                </div>
                {config.pattern === 'CUSTOM_ENGRAVING' && (
                  <input
                    className="mt-2 w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm"
                    placeholder="Engraving text (max 24 chars)"
                    maxLength={24}
                    value={config.engravingText ?? ''}
                    disabled={locked}
                    onChange={(e) => updateConfig({ engravingText: e.target.value || undefined })}
                  />
                )}
              </PanelSection>
            </TabsContent>

            <TabsContent value="stones" className="space-y-5">
              <PanelSection title="Diamonds">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Set stones</Label>
                  <Switch
                    checked={config.diamonds.enabled}
                    disabled={locked}
                    onCheckedChange={(enabled) => updateDiamonds({ enabled })}
                  />
                </div>
              </PanelSection>
              {config.diamonds.enabled && (
                <>
                  <PanelSection title="Stone type">
                    <div className="grid grid-cols-3 gap-1.5">
                      {STONE_TYPES.map((stoneType) => (
                        <OptionChip
                          key={stoneType}
                          label={stoneType.replace('_', ' ').toLowerCase()}
                          active={config.diamonds.stoneType === stoneType}
                          disabled={locked}
                          onClick={() => updateDiamonds({ stoneType })}
                        />
                      ))}
                    </div>
                  </PanelSection>
                  <PanelSection title="Shape">
                    <div className="grid grid-cols-4 gap-1.5">
                      {STONE_SHAPES.map((shape) => (
                        <OptionChip
                          key={shape}
                          label={shape.toLowerCase()}
                          active={config.diamonds.shape === shape}
                          disabled={locked}
                          onClick={() => updateDiamonds({ shape })}
                        />
                      ))}
                    </div>
                  </PanelSection>
                  <ParamSlider
                    label="Stone size"
                    unit="mm"
                    value={config.diamonds.stoneSizeMm}
                    min={GEOMETRY_LIMITS.stoneSizeMm.min}
                    max={GEOMETRY_LIMITS.stoneSizeMm.max}
                    step={0.1}
                    disabled={locked}
                    onChange={(stoneSizeMm) => updateDiamonds({ stoneSizeMm })}
                  />
                  <ParamSlider
                    label="Stone spacing"
                    unit="mm"
                    value={config.diamonds.spacingMm}
                    min={GEOMETRY_LIMITS.stoneSpacingMm.min}
                    max={GEOMETRY_LIMITS.stoneSpacingMm.max}
                    step={0.05}
                    disabled={locked}
                    onChange={(spacingMm) => updateDiamonds({ spacingMm })}
                  />
                  <ParamSlider
                    label="Coverage density"
                    unit="%"
                    value={Math.round(config.diamonds.density * 100)}
                    min={5}
                    max={100}
                    step={5}
                    disabled={locked}
                    onChange={(pct) => updateDiamonds({ density: pct / 100 })}
                  />
                </>
              )}
            </TabsContent>

            <TabsContent value="fit" className="space-y-5">
              <ParamSlider
                label="Wall thickness"
                unit="mm"
                value={config.geometry.thicknessMm}
                min={GEOMETRY_LIMITS.thicknessMm.min}
                max={GEOMETRY_LIMITS.thicknessMm.max}
                step={0.05}
                disabled={locked}
                onChange={(thicknessMm) => updateGeometry({ thicknessMm })}
              />
              <ParamSlider
                label="Offset"
                unit="mm"
                value={config.geometry.offsetMm}
                min={GEOMETRY_LIMITS.offsetMm.min}
                max={GEOMETRY_LIMITS.offsetMm.max}
                step={0.01}
                disabled={locked}
                onChange={(offsetMm) => updateGeometry({ offsetMm })}
              />
              <ParamSlider
                label="Fit tolerance"
                unit="mm"
                value={config.geometry.fitToleranceMm}
                min={GEOMETRY_LIMITS.fitToleranceMm.min}
                max={GEOMETRY_LIMITS.fitToleranceMm.max}
                step={0.01}
                disabled={locked}
                onChange={(fitToleranceMm) => updateGeometry({ fitToleranceMm })}
              />
              <ParamSlider
                label="Chamfer"
                unit="mm"
                value={config.geometry.chamferMm}
                min={GEOMETRY_LIMITS.chamferMm.min}
                max={GEOMETRY_LIMITS.chamferMm.max}
                step={0.05}
                disabled={locked}
                onChange={(chamferMm) => updateGeometry({ chamferMm })}
              />
              <ParamSlider
                label="Edge radius"
                unit="mm"
                value={config.geometry.edgeRadiusMm}
                min={GEOMETRY_LIMITS.edgeRadiusMm.min}
                max={GEOMETRY_LIMITS.edgeRadiusMm.max}
                step={0.05}
                disabled={locked}
                onChange={(edgeRadiusMm) => updateGeometry({ edgeRadiusMm })}
              />
            </TabsContent>

            <TabsContent value="ai">
              <AiPanel />
            </TabsContent>
          </Tabs>

          <PricePanel scanTeeth={readyScan?.teeth ?? []} onQuote={setQuote} />
        </div>
      </div>

      <CheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        grillzId={grillzId}
        quote={quote}
      />
    </div>
  );
}

function ToolbarToggle({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-md px-2 py-1 text-xs transition-colors',
        active ? 'bg-gold-500/20 text-gold-200' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </button>
  );
}

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

function OptionChip({
  label,
  active,
  disabled,
  onClick,
  swatch,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  swatch?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs capitalize transition-colors disabled:opacity-40',
        active
          ? 'border-gold-500/60 bg-gold-500/15 text-gold-200'
          : 'border-border text-muted-foreground hover:border-gold-500/30 hover:text-foreground',
      )}
    >
      {swatch && (
        <span className="h-2.5 w-2.5 rounded-full border border-white/20" style={{ background: swatch }} />
      )}
      {label}
    </button>
  );
}

function ParamSlider({
  label,
  unit,
  value,
  min,
  max,
  step,
  disabled,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <Label className="text-sm">{label}</Label>
        <span className="font-mono text-xs text-gold-300">
          {value}
          {unit}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        disabled={disabled}
        onValueChange={([v]) => {
          if (v !== undefined) onChange(v);
        }}
      />
    </div>
  );
}

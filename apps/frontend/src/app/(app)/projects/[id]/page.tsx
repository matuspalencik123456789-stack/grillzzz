'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { defaultGrillzConfig, UPPER_FRONT_EIGHT } from '@grillz/shared-types';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@grillz/ui';
import { useCreateDesign, useProject } from '@/features/api/hooks';
import { ScanUploader } from '@/features/scans/ScanUploader';
import { formatDate, formatMoney } from '@/lib/format';

const SCAN_STATUS_LABEL: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'destructive' | 'outline' }> = {
  AWAITING_UPLOAD: { label: 'awaiting upload', variant: 'outline' },
  UPLOADED: { label: 'queued', variant: 'warning' },
  VALIDATING: { label: 'validating', variant: 'warning' },
  OPTIMIZING: { label: 'optimizing', variant: 'warning' },
  ANALYZING: { label: 'analyzing', variant: 'warning' },
  SEGMENTING: { label: 'detecting teeth', variant: 'warning' },
  READY: { label: 'ready', variant: 'success' },
  FAILED: { label: 'failed', variant: 'destructive' },
};

export default function ProjectPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const { data: project, isLoading } = useProject(id, { pollWhileProcessing: true });
  const createDesign = useCreateDesign();

  const readyScan = useMemo(
    () => project?.scans.find((s) => s.status === 'READY' && (s.teeth?.length ?? 0) > 0),
    [project],
  );

  const startDesign = async () => {
    if (!project) return;
    const teeth = readyScan?.teeth?.length
      ? readyScan.teeth.slice(0, 8).map((t) => t.fdiNumber)
      : [...UPPER_FRONT_EIGHT];
    const design = await createDesign.mutateAsync({
      projectId: project.id,
      name: `${project.name} — design ${project.grillz.length + 1}`,
      setType: 'EIGHT',
      config: { ...defaultGrillzConfig(teeth), setType: 'EIGHT' },
    });
    router.push(`/studio/${design.id}`);
  };

  if (isLoading || !project) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">{project.name}</h1>
          {project.description && (
            <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>
          )}
        </div>
        <Button
          variant="gold"
          onClick={() => void startDesign()}
          disabled={createDesign.isPending}
        >
          {createDesign.isPending ? 'Creating…' : 'New design'}
        </Button>
      </div>

      <section className="mb-10">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Dental scans
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {project.scans.map((scan) => {
            const status = SCAN_STATUS_LABEL[scan.status] ?? { label: scan.status, variant: 'outline' as const };
            return (
              <Card key={scan.id}>
                <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
                  <CardTitle className="break-all text-base">{scan.name}</CardTitle>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <div className="flex gap-4 text-xs">
                    <span>{scan.format}</span>
                    <span>{scan.jaw !== 'UNKNOWN' ? `${scan.jaw.toLowerCase()} jaw` : 'jaw: detecting'}</span>
                    {scan.teeth && scan.teeth.length > 0 && <span>{scan.teeth.length} teeth</span>}
                    {scan.meshStats && <span>{scan.meshStats.triangleCount.toLocaleString()} tris</span>}
                  </div>
                  {scan.status === 'FAILED' && scan.errorMessage && (
                    <p className="mt-2 text-xs text-red-400">{scan.errorMessage}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
          <ScanUploader projectId={project.id} />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Designs
        </h2>
        {project.grillz.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            No designs yet — upload a scan and hit “New design”.
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {project.grillz.map((design) => (
              <Link key={design.id} href={`/studio/${design.id}`}>
                <Card className="transition-colors hover:border-gold-500/30">
                  <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
                    <CardTitle className="text-base">{design.name}</CardTitle>
                    <Badge variant={design.status === 'DRAFT' ? 'outline' : 'gold'}>
                      {design.status.toLowerCase().replace('_', ' ')}
                    </Badge>
                  </CardHeader>
                  <CardContent className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{design.material.name}</span>
                    <span>{design.toothNumbers.length} teeth</span>
                    {design.priceSnapshot && (
                      <span className="text-gold-300">{formatMoney(design.priceSnapshot.totalMinor)}</span>
                    )}
                    <span className="ml-auto">{formatDate(design.updatedAt)}</span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

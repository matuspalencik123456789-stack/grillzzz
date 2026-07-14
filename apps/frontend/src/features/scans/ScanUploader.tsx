'use client';

import { useCallback, useRef, useState } from 'react';
import { MAX_SCAN_BYTES, type ScanFormat } from '@grillz/shared-types';
import { Button } from '@grillz/ui';
import { useUploadScan } from '@/features/api/hooks';
import { formatBytes } from '@/lib/format';

const FORMAT_BY_EXT: Record<string, ScanFormat> = {
  stl: 'STL',
  ply: 'PLY',
  obj: 'OBJ',
  glb: 'GLB',
  gltf: 'GLTF',
};

export function ScanUploader({ projectId }: { projectId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const upload = useUploadScan(projectId);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      const format = FORMAT_BY_EXT[ext];
      if (!format) {
        setError(`Unsupported file type .${ext} — use STL, PLY, OBJ, GLB or GLTF`);
        return;
      }
      if (file.size > MAX_SCAN_BYTES) {
        setError(`File is ${formatBytes(file.size)}; the limit is ${formatBytes(MAX_SCAN_BYTES)}`);
        return;
      }
      setProgress(0);
      try {
        await upload.mutateAsync({
          file,
          dto: { projectId, fileName: file.name, format, fileSizeBytes: file.size },
          onProgress: setProgress,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setProgress(null);
      }
    },
    [projectId, upload],
  );

  return (
    <div
      className={`glass flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
        dragging ? 'border-gold-400/70 bg-gold-500/5' : 'border-border'
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) void handleFile(file);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".stl,.ply,.obj,.glb,.gltf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = '';
        }}
      />
      {progress !== null ? (
        <div className="w-full max-w-xs">
          <p className="mb-2 text-sm text-muted-foreground">
            {progress < 1 ? `Uploading… ${Math.round(progress * 100)}%` : 'Queuing processing…'}
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full bg-gradient-to-r from-gold-500 to-gold-300 transition-all"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        </div>
      ) : (
        <>
          <p className="font-medium">Drop a dental scan here</p>
          <p className="mt-1 text-xs text-muted-foreground">
            STL · PLY · OBJ · GLB · GLTF — up to {formatBytes(MAX_SCAN_BYTES)}
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => inputRef.current?.click()}>
            Browse files
          </Button>
        </>
      )}
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </div>
  );
}

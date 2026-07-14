import { parseGlb, type RawMesh } from '@grillz/cad-engine';

/**
 * Fetches a processed scan GLB (presigned URL) into a RawMesh. We use the
 * cad-engine parser rather than three's GLTFLoader because the studio needs
 * the raw typed arrays for tooth-range slicing and client-side shell builds —
 * the render geometry is then created zero-copy from the same buffers.
 */
export async function loadScanMesh(url: string, signal?: AbortSignal): Promise<RawMesh> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Failed to load scan mesh (${res.status})`);
  const buffer = await res.arrayBuffer();
  return parseGlb(new Uint8Array(buffer));
}

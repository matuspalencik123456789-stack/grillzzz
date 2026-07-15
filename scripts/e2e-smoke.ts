/* End-to-end smoke test against the live local stack. */
import { generateSyntheticArch, exportStl } from '../packages/cad-engine/src/index';
import { defaultGrillzConfig } from '../packages/shared-types/src/index';

const API = 'http://localhost:4000/api/v1';
let token = '';

async function call<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(json)}`);
  return json as T;
}

function ok(step: string, detail = '') {
  console.log(`✓ ${step}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
  // 1. register + login
  const email = `smoke-${Date.now()}@test.dev`;
  const reg = await call<{ user: { id: string }; tokens: { accessToken: string } }>(
    '/auth/register', 'POST',
    { email, password: 'super-secret-password-1', name: 'Smoke Tester' },
  );
  token = reg.tokens.accessToken;
  ok('register + JWT', email);

  // 1b. account-recovery endpoints answer without leaking account existence
  const forgotKnown = await call<{ ok: boolean }>('/auth/forgot-password', 'POST', { email });
  const forgotUnknown = await call<{ ok: boolean }>('/auth/forgot-password', 'POST', {
    email: `ghost-${Date.now()}@test.dev`,
  });
  if (!forgotKnown.ok || !forgotUnknown.ok) throw new Error('forgot-password did not return ok');
  ok('password-reset request accepted (uniform response)');

  // 2. create project
  const project = await call<{ id: string }>('/projects', 'POST', { name: 'Smoke Project' });
  ok('project created', project.id);

  // 3. presigned upload of a synthetic 8-tooth arch STL
  const arch = generateSyntheticArch({ toothCount: 8 });
  const stl = exportStl(arch);
  const ticket = await call<{ scanId: string; uploadUrl: string }>('/scans/uploads', 'POST', {
    projectId: project.id,
    fileName: 'smoke-arch.stl',
    format: 'STL',
    fileSizeBytes: stl.length,
  });
  const put = await fetch(ticket.uploadUrl, {
    method: 'PUT',
    body: stl,
    headers: { 'content-length': String(stl.length) },
  });
  if (!put.ok) throw new Error(`S3 PUT failed ${put.status}: ${await put.text()}`);
  await call('/scans/uploads/complete', 'POST', { scanId: ticket.scanId });
  ok('scan uploaded to S3 + pipeline queued', `${stl.length} bytes`);

  // 4. wait for the pipeline
  let scan: { status: string; jaw: string; errorMessage: string | null; teeth: Array<{ fdiNumber: number }> } | null = null;
  for (let i = 0; i < 60; i++) {
    scan = await call(`/scans/${ticket.scanId}`);
    if (scan!.status === 'READY' || scan!.status === 'FAILED') break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (!scan || scan.status !== 'READY') {
    throw new Error(`pipeline did not finish: ${scan?.status} ${scan?.errorMessage ?? ''}`);
  }
  ok('scan pipeline READY', `jaw=${scan.jaw}, ${scan.teeth.length} teeth: ${scan.teeth.map((t) => t.fdiNumber).join(',')}`);

  // 4b. processed mesh + thumbnail
  const meshUrl = await call<{ url: string }>(`/scans/${ticket.scanId}/mesh-url`);
  const glbHead = await fetch(meshUrl.url);
  if (!glbHead.ok) throw new Error('mesh GLB not downloadable');
  const glbBytes = (await glbHead.arrayBuffer()).byteLength;
  const thumbUrl = await call<{ url: string }>(`/scans/${ticket.scanId}/thumbnail-url`);
  const thumb = await fetch(thumbUrl.url);
  if (!thumb.ok) throw new Error('thumbnail not downloadable');
  ok('processed GLB + auto thumbnail in S3', `glb=${glbBytes}B png=${(await thumb.arrayBuffer()).byteLength}B`);

  // 5. create a design over 6 detected teeth
  const teeth = scan.teeth.slice(1, 7).map((t) => t.fdiNumber);
  const config = defaultGrillzConfig(teeth);
  config.setType = 'SIX';
  config.material = 'GOLD_18K';
  config.diamonds = { ...config.diamonds, enabled: true, stoneType: 'LAB_DIAMOND', density: 0.7 };
  config.pattern = 'ICED';
  const design = await call<{ id: string }>('/grillz', 'POST', {
    projectId: project.id,
    name: 'Smoke Iced Six',
    setType: 'SIX',
    config,
  });
  ok('grillz design created', design.id);

  // 6. AI features
  const ai = await call<{ provider: string; suggestions: Array<{ name: string; estimatedPriceMinor: number }> }>(
    '/ai/designs', 'POST', { prompt: 'Luxury Miami grillz', toothNumbers: teeth },
  );
  ok('AI design generation', `${ai.suggestions.length} presets via ${ai.provider} (e.g. "${ai.suggestions[0]!.name}" $${(ai.suggestions[0]!.estimatedPriceMinor / 100).toFixed(0)})`);
  const validation = await call<{ manufacturable: boolean; issues: unknown[] }>('/ai/validate', 'POST', config);
  ok('AI manufacturing validation', `manufacturable=${validation.manufacturable}, ${validation.issues.length} findings`);

  // 7. authoritative price
  const quote = await call<{ totalMinor: number; computed: { metalWeightGrams: number; stoneCount: number } }>(
    `/grillz/${design.id}/price`, 'POST', {},
  );
  ok('server quote', `$${(quote.totalMinor / 100).toFixed(2)} (${quote.computed.metalWeightGrams}g, ${quote.computed.stoneCount} stones)`);

  // 8. place order (mock payment settles instantly)
  const order = await call<{ order: { id: string; number: string; status: string }; payment: { status: string } }>(
    '/orders', 'POST',
    {
      grillzId: design.id,
      quote,
      shippingAddress: {
        fullName: 'Smoke Tester', line1: '1 Test St', city: 'Miami',
        postalCode: '33101', countryCode: 'US',
      },
    },
  );
  ok('order placed', `${order.order.number}, payment=${order.payment.status}`);

  // 9. order should now be PAID with a production job
  const placed = await call<{ status: string; productionJob: { stage: string } | null }>(`/orders/${order.order.id}`);
  if (placed.status !== 'PAID') throw new Error(`expected PAID, got ${placed.status}`);
  if (!placed.productionJob) throw new Error('no production job created');
  ok('payment settled → production job', `status=${placed.status}, stage=${placed.productionJob.stage}`);

  // 10. manufacturing artifacts (auto-generated on payment)
  const artifacts = await call<Array<{ format: string; sizeBytes: number; url: string }>>(`/grillz/${design.id}/export`);
  for (const artifact of artifacts) {
    const download = await fetch(artifact.url);
    if (!download.ok) throw new Error(`${artifact.format} artifact not downloadable`);
  }
  ok('manufacturing export', artifacts.map((a) => `${a.format}(${a.sizeBytes}B)`).join(' '));

  // 11. notifications exist
  const notifications = await call<Array<{ type: string }>>('/notifications');
  ok('notifications', notifications.map((n) => n.type).join(', '));

  console.log('\nALL SMOKE STEPS PASSED');
}

main().catch((err) => {
  console.error('✗ SMOKE FAILED:', err.message);
  process.exit(1);
});

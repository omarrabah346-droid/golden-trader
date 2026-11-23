import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import { receiptType } from './receipt-format.mjs';

const bucket = 'vexora-v2-receipts';
const maxBytes = 5 * 1024 * 1024;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const origin = Deno.env.get('VEXORA_WEB_ORIGIN');

Deno.serve(async (request) => {
  const callerOrigin = request.headers.get('origin');
  if (callerOrigin && callerOrigin !== origin) return new Response(null, { status: 403 });
  const headers = {
    'Access-Control-Allow-Origin': origin ?? 'null',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-store',
    'Vary': 'Origin'
  };
  const json = (body: object, status = 200) => Response.json(body, { status, headers });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return json({ error: 'Authentication required' }, 401);

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const client = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: auth } },
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data: { user }, error: authError } = await client.auth.getUser(auth.slice(7));
    if (authError || !user) return json({ error: 'Authentication required' }, 401);
    const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const storage = service.storage.from(bucket);
    const params = new URL(request.url).searchParams;
    const order = params.get('order');
    if (!order || !uuid.test(order)) return json({ error: 'Invalid order' }, 400);

    if (params.get('action') === 'view') {
      const { data: key, error } = await client.rpc('vx_sub_v2_owner_receipt', { p_order: order });
      if (error || typeof key !== 'string') return json({ error: 'Receipt unavailable' }, 403);
      const signed = await storage.createSignedUrl(key, 60);
      if (signed.error) return json({ error: 'Receipt unavailable' }, 503);
      return json({ url: signed.data.signedUrl });
    }
    if (params.get('action') !== 'upload') return json({ error: 'Unknown action' }, 400);

    const check = await client.rpc('vx_sub_v2_may_upload_receipt', { p_order: order });
    if (check.error || check.data !== true) return json({ error: 'Order unavailable' }, 403);
    const reader = request.body?.getReader();
    if (!reader) return json({ error: 'Receipt required' }, 400);
    const bytes = new Uint8Array(maxBytes);
    let length = 0;
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      if (length + chunk.value.length > maxBytes) {
        await reader.cancel();
        return json({ error: 'Receipt too large' }, 413);
      }
      bytes.set(chunk.value, length);
      length += chunk.value.length;
    }
    const file = bytes.subarray(0, length);
    const type = receiptType(file);
    if (!type) return json({ error: 'Unsupported receipt format' }, 415);
    const key = `${user.id}/${order}/${crypto.randomUUID()}.${type.extension}`;
    const uploaded = await storage.upload(key, file, { contentType: type.mime, upsert: false });
    if (uploaded.error) return json({ error: 'Upload unavailable' }, 503);
    const bound = await service.rpc('vx_sub_v2_bind_receipt', {
      p_user: user.id, p_order: order, p_key: key
    });
    // Keep the object if the RPC outcome is ambiguous. Cleanup is a separate
    // server-side reconciliation after checking the persisted receipt binding.
    if (bound.error) return json({ error: 'Receipt binding unavailable' }, 409);
    return json({ received: true }, 201);
  } catch {
    return json({ error: 'Receipt service unavailable' }, 503);
  }
});

import { createClient } from 'npm:@supabase/supabase-js@2.49.4';

const origin = Deno.env.get('VEXORA_WEB_ORIGIN');
const url = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async request => {
  const caller = request.headers.get('origin');
  if (caller && caller !== origin) return new Response(null, { status: 403 });
  const headers = {
    'Access-Control-Allow-Origin': origin ?? 'null',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-store',
    'Vary': 'Origin'
  };
  const respond = (data: object, status: number) => Response.json(data, { status, headers });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return respond({ error: 'Method not allowed' }, 405);
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return respond({ error: 'Authentication required' }, 401);
  const media = new URL(request.url).searchParams.get('media');
  if (!media || !uuid.test(media)) return respond({ error: 'Invalid media identifier' }, 400);

  try {
    const callerClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const identity = await callerClient.auth.getUser(authorization.slice(7));
    if (identity.error || !identity.data.user) return respond({ error: 'Authentication required' }, 401);
    const { data: key, error } = await callerClient.rpc('vx_sub_v2_lesson_media_key', { p_media: media });
    if (error || typeof key !== 'string') return respond({ error: 'Media unavailable' }, 403);
    const signer = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data, error: signingError } = await signer.storage.from('vexora-v2-lesson-media').createSignedUrl(key, 60);
    if (signingError) return respond({ error: 'Media unavailable' }, 503);
    return respond({ url: data.signedUrl }, 200);
  } catch {
    return respond({ error: 'Media service unavailable' }, 503);
  }
});

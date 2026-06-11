/**
 * Next.js API Route: POST /api/prism-agent
 *
 * Proxies requests to the Prism /agent endpoint and streams SSE back
 * WITHOUT gzip compression. This is necessary because Next.js rewrites
 * compress SSE responses (Content-Encoding: gzip), which breaks the
 * browser's ReadableStream text decoding.
 */

const TRADING_SERVICE_URL = process.env.TRADING_SERVICE_URL || 'http://10.0.0.16:3031';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json();

    const upstream = await fetch(`${TRADING_SERVICE_URL}/api/v1/vllm/prism-agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Do NOT forward Accept-Encoding — we want raw uncompressed SSE
      },
      body: JSON.stringify(body),
    });

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => '');
      return new Response(errText || `Prism error: ${upstream.status}`, {
        status: upstream.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Pipe the upstream SSE response directly to the client
    // with explicit headers that prevent compression
    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering if behind nginx
        'Content-Encoding': 'identity', // Explicitly no compression
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ type: 'error', message: err.message }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

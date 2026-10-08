// POST /api/inquire
// Validates an inquiry and emails it through Cloudflare Email Service (REST) or Resend.
// Env (Cloudflare Pages > Settings > Variables and Secrets, or .dev.vars locally):
//   Always:      INQUIRY_TO (comma separated), INQUIRY_FROM (address on a verified sending domain)
//   Cloudflare:  CF_ACCOUNT_ID, CF_EMAIL_TOKEN (API token with Email Sending: Edit)
//   Resend:      RESEND_API_KEY
//   Optional:    EMAIL_PROVIDER = cloudflare | resend (default: cloudflare if its vars exist, else resend)
//                TURNSTILE_SECRET

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clip = (s, n) => String(s ?? '').trim().slice(0, n);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function onRequestPost({ request, env }) {
  let d;
  try { d = await request.json(); } catch { return json({ error: 'Invalid request.' }, 400); }

  // Bots: honeypot filled, or form submitted impossibly fast. Pretend success.
  if (d.company || (typeof d.elapsed === 'number' && d.elapsed < 2500)) return json({ ok: true });

  const lead = {
    name: clip(d.name, 120),
    email: clip(d.email, 200),
    phone: clip(d.phone, 40),
    timeline: clip(d.timeline, 60),
    interest: clip(d.interest, 80),
    representation: clip(d.representation, 80),
    message: clip(d.message, 3000),
    page: clip(d.page, 300)
  };
  if (!lead.name || !EMAIL.test(lead.email)) return json({ error: 'Please provide your name and a valid email.' }, 400);
  if (d.consent !== true) return json({ error: 'Please confirm you agree to be contacted.' }, 400);

  if (env.TURNSTILE_SECRET) {
    const ok = await verifyTurnstile(env.TURNSTILE_SECRET, d.token, request.headers.get('CF-Connecting-IP'));
    if (!ok) return json({ error: 'Verification failed. Please reload and try again.' }, 400);
  }

  const provider = pickProvider(env);
  if (!provider || !env.INQUIRY_TO || !env.INQUIRY_FROM) {
    console.error('inquire: email provider or INQUIRY_TO / INQUIRY_FROM not configured');
    return json({ error: 'Inquiries are not available right now. Please try again later.' }, 503);
  }

  const rows = [['Name', lead.name], ['Email', lead.email], ['Phone', lead.phone], ['Representation', lead.representation], ['Timeline', lead.timeline], ['Interest', lead.interest], ['Message', lead.message], ['Page', lead.page]]
    .filter(([, v]) => v);
  const html = `<h2>New inquiry: Waluga Park Lot 9</h2><table cellpadding="6">${rows
    .map(([k, v]) => `<tr><td><b>${esc(k)}</b></td><td>${esc(v).replace(/\n/g, '<br>')}</td></tr>`).join('')}</table>`;
  const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n');
  const mail = {
    from: env.INQUIRY_FROM,
    to: env.INQUIRY_TO.split(',').map((x) => x.trim()).filter(Boolean),
    replyTo: lead.email,
    subject: `Waluga Park Lot 9 inquiry from ${lead.name}`,
    html, text
  };

  try {
    const res = await (provider === 'cloudflare' ? sendCloudflare(env, mail) : sendResend(env, mail));
    if (!res.ok) {
      console.error('inquire:', provider, 'failed', res.status, await res.text().catch(() => ''));
      return json({ error: 'We could not send your inquiry. Please try again.' }, 502);
    }
  } catch (e) {
    console.error('inquire:', provider, 'threw', e && e.message);
    return json({ error: 'We could not send your inquiry. Please try again.' }, 502);
  }
  return json({ ok: true });
}

export function pickProvider(env) {
  const want = (env.EMAIL_PROVIDER || '').toLowerCase();
  const cf = env.CF_ACCOUNT_ID && env.CF_EMAIL_TOKEN, rs = env.RESEND_API_KEY;
  if (want === 'cloudflare') return cf ? 'cloudflare' : null;
  if (want === 'resend') return rs ? 'resend' : null;
  return cf ? 'cloudflare' : rs ? 'resend' : null;
}

// Cloudflare Email Service REST API (beta). The reply-to field name is not shown in the REST page I
// could read, so if the schema rejects it (400) we retry once without it; the lead's email is in the body.
async function sendCloudflare(env, m) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/email/sending/send`;
  const post = (body) => fetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.CF_EMAIL_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const base = { from: m.from, to: m.to, subject: m.subject, html: m.html, text: m.text };
  const res = await post({ ...base, reply_to: m.replyTo });
  if (res.status === 400) return post(base);
  return res;
}

function sendResend(env, m) {
  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: m.from, to: m.to, reply_to: m.replyTo, subject: m.subject, html: m.html, text: m.text })
  });
}

async function verifyTurnstile(secret, token, ip) {
  if (!token) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set('remoteip', ip);
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    return !!(await r.json()).success;
  } catch { return false; }
}

// onRequestPost wins for POST; anything else lands here.
export const onRequest = () => json({ error: 'Method not allowed.' }, 405);

// Worker entry: serves the static site from ./public and handles the inquiry form.
import { onRequestPost, onRequest } from './inquire.js';

const APEX = '4992parkbluff.com';
const HSTS = 'max-age=31536000; includeSubDomains';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const local = env.LOCAL_DEV === '1' || url.hostname === 'localhost';
    // One canonical address: https://4992parkbluff.com
    if (!local && (url.protocol === 'http:' || url.hostname === 'www.' + APEX)) {
      url.protocol = 'https:';
      url.hostname = APEX;
      return Response.redirect(url.toString(), 301);
    }
    const res = url.pathname === '/api/inquire'
      ? (request.method === 'POST' ? await onRequestPost({ request, env, ctx }) : onRequest())
      : await env.ASSETS.fetch(request);
    if (local) return res;
    const out = new Response(res.body, res);
    out.headers.set('Strict-Transport-Security', HSTS);
    return out;
  }
};

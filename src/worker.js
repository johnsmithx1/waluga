// Worker entry: serves the static site from ./public and handles the inquiry form.
import { onRequestPost, onRequest } from './inquire.js';

const APEX = '4992parkbluff.com';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.hostname === 'www.' + APEX) {
      url.hostname = APEX;
      return Response.redirect(url.toString(), 301);
    }
    if (url.pathname === '/api/inquire') {
      return request.method === 'POST' ? onRequestPost({ request, env, ctx }) : onRequest();
    }
    return env.ASSETS.fetch(request);
  }
};

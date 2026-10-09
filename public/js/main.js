(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const h = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === false || v == null) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null) n.append(kid.nodeType ? kid : document.createTextNode(kid));
    return n;
  };
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData = navigator.connection && navigator.connection.saveData;

  // An <img> that falls back to a second source, then to a labeled placeholder.
  function picture({ src, fallback, alt, label, sub }) {
    const ph = () => h('div', { class: 'ph' }, h('span', { text: label || 'Image' }), h('small', { text: sub || 'Image coming soon' }));
    const img = h('img', { alt: alt || label || '', loading: 'lazy', decoding: 'async' });
    let tried = 0;
    img.addEventListener('error', () => {
      if (tried === 0 && fallback) { tried = 1; img.src = fallback; }
      else img.replaceWith(ph());
    });
    img.src = src;
    return img;
  }

  const ICONS = {
    area: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 28V12L16 4l12 8v16z"/><path d="M12 28V18h8v10"/></svg>',
    bed: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M3 24V10M3 20h26v4M29 20v-5a4 4 0 0 0-4-4H12v9"/><circle cx="8" cy="15" r="2.4"/></svg>',
    bath: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M3 15h26v3a7 7 0 0 1-7 7H10a7 7 0 0 1-7-7zM8 15V8a3 3 0 0 1 6 0M7 28l1.5-3M25 28l-1.5-3"/></svg>',
    garage: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M3 28V12l13-7 13 7v16M8 28V16h16v12M8 20h16M8 24h16"/></svg>'
  };

  async function load() {
    const get = (u) => fetch(u, { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); });
    const [site, rooms, media] = await Promise.all([get('data/site.json'), get('data/rooms.json'), get('data/media.json')]);
    return { site, rooms: rooms.rooms.filter((r) => r.public !== false), media };
  }

  function renderHero(site) {
    const p = site.property, hero = site.hero;
    $('#status-pill').textContent = p.status;
    if (p.price) { const pr = $('#hero-price'); pr.innerHTML = ''; pr.append(h('small', { text: 'Offered at' }), h('span', { text: p.price })); pr.hidden = false; }
    $('#hero-sub').textContent = p.subhead;
    const box = $('#hero-media');
    box.append(picture({ src: hero.image, fallback: hero.fallback, alt: hero.alt, label: 'Hero image' }));
    const first = box.firstChild; if (first.tagName === 'IMG') first.loading = 'eager';
    // No film yet: slow push-in on the still stands in for it. Real file wins automatically once it exists.
    if (!reduceMotion) box.classList.add('kb');
    const film = $('#film-btn');
    const filmItem = { title: 'Film', src: hero.image, fallback: hero.fallback, mock: true };
    film.addEventListener('click', () => lbOpen([filmItem], 0));
    if (hero.video) {
      fetch(hero.video, { method: 'HEAD' }).then((r) => {
        if (!r.ok || !(r.headers.get('content-type') || '').startsWith('video')) return;
        delete filmItem.mock; filmItem.video = hero.video;
        if (reduceMotion || saveData) return;
        const v = h('video', { muted: true, loop: true, playsinline: true, autoplay: true, preload: 'metadata', 'aria-hidden': 'true' });
        v.muted = true;
        v.style.opacity = 0; v.style.transition = 'opacity .8s';
        v.addEventListener('canplay', () => { v.style.opacity = 1; box.classList.remove('kb'); v.play().catch(() => {}); });
        v.addEventListener('error', () => v.remove());
        v.src = hero.video;
        box.append(v);
      }).catch(() => {});
    }
  }

  function renderSpecs(site) {
    $('#spec-list').append(...site.property.specs.map((s) => {
      const li = h('li'); li.innerHTML = ICONS[s.icon] || '';
      li.append(h('div', {}, h('b', { text: s.value }), h('small', { text: s.label })));
      return li;
    }));
    $('#story-eyebrow').textContent = site.story.eyebrow;
    $('#story-title').textContent = site.story.title;
    $('#story-body').textContent = site.story.body;
    $('#swatches').append(...site.palette.map((c) => {
      const dot = h('i'); dot.style.background = c.hex;
      return h('li', { title: c.use }, dot, c.name);
    }));
  }

  // Mobile menu
  const menuBtn = $('#menu-btn'), menu = $('#menu');
  const setMenu = (open) => {
    menu.hidden = !open; menuBtn.setAttribute('aria-expanded', open);
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.documentElement.classList.toggle('menu-open', open);
  };
  menuBtn.addEventListener('click', () => setMenu(menu.hidden));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { setMenu(false); menuBtn.focus(); } });
  matchMedia('(min-width: 961px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });

  // Lightbox
  const lb = $('#lightbox'); let lbItems = [], lbIndex = 0;
  function lbShow() {
    const it = lbItems[lbIndex], stage = $('#lb-stage');
    stage.replaceChildren(it.video
      ? h('video', { src: it.video, controls: true, autoplay: true, playsinline: true })
      : it.mock
        ? h('div', { class: 'mock' }, picture({ src: it.src, fallback: it.fallback, alt: '' }),
            h('div', { class: 'mock-play' }, h('b', { text: '▶' }), h('span', { text: 'The film is on its way' })))
        : picture({ src: it.src, fallback: it.fallback, alt: it.title, label: it.title }));
    $('#lb-cap').textContent = it.mock ? 'Film · coming soon' : it.title + (it.type === 'render' ? ' · Rendering' : '') + (it.note ? ' · ' + it.note : '');
    lb.classList.toggle('single', lbItems.length < 2);
  }
  function lbOpen(items, i) { lbItems = items; lbIndex = i; lbShow(); if (!lb.open) lb.showModal(); }
  const lbStep = (d) => { lbIndex = (lbIndex + d + lbItems.length) % lbItems.length; lbShow(); };
  $('.lb-close').addEventListener('click', () => lb.close());
  $('.lb-prev').addEventListener('click', () => lbStep(-1));
  $('.lb-next').addEventListener('click', () => lbStep(1));
  lb.addEventListener('click', (e) => { if (e.target === lb) lb.close(); });
  lb.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') lbStep(-1); if (e.key === 'ArrowRight') lbStep(1); });
  lb.addEventListener('close', () => $('#lb-stage').replaceChildren());

  function renderReel(media) {
    const items = media.reel, stage = $('#reel-stage'), thumbs = $('#reel-thumbs');
    const pad = (n) => String(n).padStart(2, '0');
    const tag = { render: 'Rendering', photo: 'On site', drone: 'Aerial' };
    let i = 0;
    const btns = items.map((it, k) => h('button', {
      class: 'thumb', type: 'button', role: 'tab', 'aria-label': pad(k + 1) + ' ' + it.title, onclick: () => go(k)
    }, picture({ src: it.thumb || it.src, fallback: it.fallback, alt: '', label: it.title })));
    thumbs.append(...btns);
    function go(k, focus) {
      i = (k + items.length) % items.length;
      const it = items[i];
      const img = picture({ src: it.src, fallback: it.fallback, alt: it.title, label: it.title });
      if (img.tagName === 'IMG') img.loading = 'eager';
      stage.replaceChildren(img);
      stage.classList.remove('swap'); void stage.offsetWidth; stage.classList.add('swap');
      $('#reel-count').textContent = pad(i + 1) + ' / ' + pad(items.length);
      $('#reel-cap').textContent = it.title;
      $('#reel-tag').textContent = tag[it.type] || '';
      $('#reel-tag').dataset.t = it.type;
      btns.forEach((b, j) => { b.setAttribute('aria-selected', j === i); b.tabIndex = j === i ? 0 : -1; });
      const cur = btns[i]; thumbs.scrollTo({ left: cur.offsetLeft - (thumbs.clientWidth - cur.clientWidth) / 2, behavior: reduceMotion ? 'auto' : 'smooth' });
      if (focus) cur.focus({ preventScroll: true });
      // warm the neighbour
      const nx = new Image(); nx.src = items[(i + 1) % items.length].src;
    }
    $('.reel-prev').addEventListener('click', () => go(i - 1));
    $('.reel-next').addEventListener('click', () => go(i + 1));
    $('.reel-open').addEventListener('click', () => lbOpen(items, i));
    stage.addEventListener('click', () => lbOpen(items, i));
    const key = (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(i - 1, e.currentTarget === thumbs); }
      if (e.key === 'ArrowRight') { e.preventDefault(); go(i + 1, e.currentTarget === thumbs); }
      if (e.key === 'Enter' && e.currentTarget === stage) lbOpen(items, i);
    };
    stage.addEventListener('keydown', key); thumbs.addEventListener('keydown', key);
    // swipe
    let x0 = null;
    stage.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
    stage.addEventListener('pointerup', (e) => {
      if (x0 == null) return; const dx = e.clientX - x0; x0 = null;
      if (Math.abs(dx) > 50) { go(i + (dx < 0 ? 1 : -1)); stage.dataset.swiped = '1'; setTimeout(() => delete stage.dataset.swiped, 50); }
    });
    stage.addEventListener('click', (e) => { if (stage.dataset.swiped) e.stopImmediatePropagation(); }, true);
    go(0);
  }

  function renderInteriors(media) {
    const items = media.interiors || [];
    if (!items.length) { $('#interiors').remove(); return; }
    const groups = ['All', ...new Set(items.map((i) => i.group))];
    const grid = $('#int-grid'), bar = $('#int-filters');
    const paint = (g) => {
      const list = g === 'All' ? items : items.filter((i) => i.group === g);
      grid.replaceChildren(...list.map((it, k) => h('li', {}, h('button', { class: 'int-tile', type: 'button', 'aria-label': 'Enlarge ' + it.title, onclick: () => lbOpen(list, k) },
        h('span', { class: 'int-img' }, picture({ src: it.src, alt: it.title + ' rendering', label: it.title })),
        h('span', { class: 'int-cap' }, h('b', { text: it.title }), it.note ? h('small', { text: it.note }) : null)))));
      bar.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', c.dataset.g === g));
    };
    bar.append(...groups.map((g) => h('button', { class: 'chip', type: 'button', 'data-g': g, onclick: () => paint(g), text: g })));
    paint('All');
  }

  function renderPlans(site) {
    const tabs = $('#plan-tabs'), view = $('#plan-view');
    const show = (i) => {
      const p = site.floorplans[i];
      tabs.querySelectorAll('.tab').forEach((t, j) => { t.setAttribute('aria-selected', j === i); t.tabIndex = j === i ? 0 : -1; });
      view.replaceChildren(picture({ src: p.src, fallback: p.fallback, alt: p.level + ' level floor plan', label: p.level + ' level', sub: 'Floor plan coming soon' }));
    };
    tabs.append(...site.floorplans.map((p, i) => h('button', {
      class: 'tab', type: 'button', role: 'tab', text: p.level, onclick: () => show(i),
      onkeydown: (e) => {
        const n = site.floorplans.length;
        if (e.key === 'ArrowRight') { show((i + 1) % n); tabs.children[(i + 1) % n].focus(); }
        if (e.key === 'ArrowLeft') { show((i + n - 1) % n); tabs.children[(i + n - 1) % n].focus(); }
      }
    })));
    show(0);
  }

  function renderFinishes(site, rooms) {
    $('#board').append(...(site.materialBoard || []).map((m) => h('li', { class: 'mat' },
      h('div', { class: 'mat-img' }, picture({ src: m.img, alt: m.name + ' swatch', label: m.name })),
      h('h3', { text: m.name }), h('p', { class: 'mat-note', text: m.note }), h('p', { class: 'mat-where', text: m.where }))));
    const order = ['Exterior', 'Living spaces', 'Primary suite', 'Guest and utility', 'Lower level', 'Whole home'];
    const wrap = $('#rooms');
    for (const g of order) {
      const list = rooms.filter((r) => r.group === g); if (!list.length) continue;
      wrap.append(h('p', { class: 'group-h', text: g }));
      for (const r of list) {
        wrap.append(h('details', {}, h('summary', { text: r.name }),
          h('ul', {}, r.selections.map((s) => h('li', {}, h('b', { text: s.k }), s.v)))));
      }
    }
  }

  function renderProgress(media) {
    const fmt = (d) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const list = [...media.progress].sort((a, b) => b.date.localeCompare(a.date));
    $('#timeline').append(...list.map((e) => {
      const m = h('div', { class: 'media' });
      if (e.video) m.append(h('video', { src: e.video, controls: true, preload: 'none', playsinline: true, poster: e.src || null }));
      else m.append(picture({ src: e.src, alt: e.title, label: e.title, sub: 'Photo coming soon' }));
      return h('li', { class: 'entry' }, h('time', { datetime: e.date, text: fmt(e.date) }),
        h('div', {}, h('h3', { text: e.title }), h('p', { text: e.note || '' })), m);
    }));
  }

  function renderFooter(site) {
    $('#loc-body').textContent = site.neighborhood.body;
    const loc = site.location;
    if (loc) {
      $('#loc-list').append(...loc.highlights.map((x) => h('li', {}, h('b', { text: x.k }), x.v)));
      $('#loc-note').textContent = loc.note || '';
      const q = encodeURIComponent(loc.mapQuery);
      $('#map-frame').append(h('iframe', { title: 'Map showing ' + loc.address + ', ' + loc.cityLine, src: `https://maps.google.com/maps?q=${q}&z=15&output=embed`, loading: 'lazy', referrerpolicy: 'no-referrer-when-downgrade', allowfullscreen: true }));
      $('#map-addr').textContent = loc.address + ' · ' + loc.cityLine;
      $('#map-gps').textContent = `${loc.lat.toFixed(4)}° N, ${Math.abs(loc.lon).toFixed(4)}° W`;
      $('#map-dir').href = `https://www.google.com/maps/dir/?api=1&destination=${q}`;
    }
    const L = site.listing, row = (k, ...v) => [h('dt', { text: k }), h('dd', {}, ...v)];
    $('#contact').append(
      ...row('Listing agent', h('span', { class: 'c-name', text: L.agent }), h('span', { class: 'c-sub', text: [L.title, L.broker].filter(Boolean).join(' · ') })),
      ...(L.phone ? row('Direct telephone', h('a', { href: 'tel:' + L.phone.replace(/[^\d+]/g, ''), text: L.phone })) : []),
      ...(L.email ? row('Direct inquiries', h('a', { href: 'mailto:' + L.email, text: L.email })) : []),
      ...(loc ? row('Homesite', h('span', { text: loc.address }), h('span', { class: 'c-sub', text: loc.cityLine })) : [])
    );
    $('#foot-city').textContent = site.property.city;
    const l = site.listing;
    $('#foot-listing').append(h('p', { text: l.agent + (l.title ? ', ' + l.title : '') }), h('p', { text: l.broker }), h('p', { text: l.license }), l.phone ? h('p', {}, h('a', { href: 'tel:' + l.phone.replace(/[^\d+]/g, ''), text: l.phone })) : null, l.email ? h('p', {}, h('a', { href: 'mailto:' + l.email, text: l.email })) : null);
    $('#foot-credits').append(h('p', { text: 'Builder: ' + l.builder }), h('p', { text: 'Design: ' + l.designer }));
    $('#foot-disclaimer').textContent = site.disclaimer;
    if (site.credit) { const c = $('#foot-credit'); c.append(site.credit.url ? h('a', { href: site.credit.url, target: '_blank', rel: 'noopener', text: site.credit.text }) : site.credit.text); }
  }

  // Forms
  function setMsg(form, text, kind) { const m = $('.form-msg', form); m.textContent = text; m.className = 'form-msg ' + (kind || ''); }
  const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  $('.early').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.currentTarget, email = f.email.value.trim();
    if (!emailOk(email)) { setMsg(f, 'Please enter a valid email address.', 'err'); f.email.focus(); return; }
    setMsg(f, '');
    $('#f-email').value = email;
    $('#inquire').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
    setTimeout(() => $('#f-name').focus({ preventScroll: true }), 500);
  });

  const inquiry = $('#inquiry'); let tsToken = '', tsReady = false;
  const openedAt = Date.now();
  function initTurnstile(key) {
    if (!key) return;
    window.__tsDone = () => {
      tsReady = true;
      window.turnstile.render('#turnstile', { sitekey: key, callback: (t) => { tsToken = t; } });
    };
    document.head.append(h('script', { src: 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__tsDone', async: true, defer: true }));
  }

  inquiry.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = inquiry, d = Object.fromEntries(new FormData(f).entries());
    let bad = null;
    for (const [name, ok] of [['name', !!d.name?.trim()], ['email', emailOk((d.email || '').trim())]]) {
      const el = f.elements[name]; el.setAttribute('aria-invalid', !ok);
      if (!ok && !bad) bad = el;
    }
    if (bad) { setMsg(f, 'Please complete the highlighted fields.', 'err'); bad.focus(); return; }
    if (!f.elements.consent.checked) { setMsg(f, 'Please confirm you agree to be contacted.', 'err'); f.elements.consent.focus(); return; }
    const btn = $('button[type=submit]', f); btn.disabled = true; setMsg(f, 'Sending…');
    try {
      const res = await fetch('/api/inquire', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...d, consent: true, token: tsToken, elapsed: Date.now() - openedAt, page: location.href })
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || 'Something went wrong. Please try again.');
      f.reset(); setMsg(f, 'Thank you. We will be in touch soon.', 'ok');
    } catch (err) {
      setMsg(f, err.message || 'Something went wrong. Please try again.', 'err');
    } finally { btn.disabled = false; }
  });
  inquiry.addEventListener('input', (e) => e.target.removeAttribute && e.target.removeAttribute('aria-invalid'));

  load().then(({ site, rooms, media }) => {
    renderHero(site); renderSpecs(site); renderReel(media); renderPlans(site); renderInteriors(media);
    renderFinishes(site, rooms); renderProgress(media); renderFooter(site);
    initTurnstile(site.turnstileSiteKey);
  }).catch((err) => {
    console.error(err);
    $('#main').prepend(h('p', { class: 'wrap', text: 'The page could not load its content. Please refresh.' }));
  });
})();

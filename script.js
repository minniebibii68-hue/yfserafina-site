// 11 · Night walk — scroll walks forward through full-screen night scenes.
(() => {
  const root = document.documentElement;
  const wide = matchMedia('(min-width: 900px)');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const scenes = [...document.querySelectorAll('.scene')];
  const pages = [...document.querySelectorAll('.page')];
  const track = document.querySelector('.track');
  const stage = document.querySelector('.stage');
  const header = document.querySelector('.top');
  const driftBtn = document.querySelector('.drift');
  const navLinks = [...document.querySelectorAll('.top nav a')];
  const LEN = 1.25; // viewport heights of scrolling per scene
  let walking = false;
  let paused = false;
  let openPage = null;
  let returnFocus = null;

  const moving = () => walking && !reduce.matches && !paused;
  const sceneIndex = id => scenes.findIndex(s => s.id === id);
  const sceneTop = i => Math.round(i * LEN * innerHeight);

  /* ---- copy email ---- */
  document.querySelector('#copy').addEventListener('click', async () => {
    const email = document.querySelector('.email').textContent;
    const status = document.querySelector('[role="status"]');
    try { await navigator.clipboard.writeText(email); status.textContent = ' Email address copied.'; }
    catch { status.textContent = ' Select the email address to copy it.'; }
  });

  /* ---- layout mode ---- */
  function setMode() {
    walking = wide.matches;
    root.classList.toggle('walking', walking);
    root.classList.toggle('moving', moving());
    driftBtn.hidden = !walking || reduce.matches;
    track.style.height = walking ? ((scenes.length - 1) * LEN + 1) * innerHeight + 'px' : '';
    if (!walking) {
      scenes.forEach(s => { s.style.opacity = ''; s.classList.remove('on'); });
      pages.forEach(p => { p.hidden = false; p.removeAttribute('role'); p.removeAttribute('aria-modal'); });
      closeState();
    } else {
      pages.forEach(p => { p.setAttribute('role', 'dialog'); p.setAttribute('aria-modal', 'true'); });
      route(false);
    }
    update();
    startSky();
  }

  /* ---- scroll → scenes ---- */
  let current = -1;
  function update() {
    if (!walking) return;
    const t = scrollY / (LEN * innerHeight);
    scenes.forEach((s, i) => {
      const d = t - i, a = Math.abs(d);
      const o = Math.max(0, Math.min(1, 1 - (a - 0.18) / 0.52));
      s.style.setProperty('--d', d.toFixed(4));
      s.style.opacity = o.toFixed(3);
      s.classList.toggle('on', a < 0.5);
    });
    const idx = Math.max(0, Math.min(scenes.length - 1, Math.round(t)));
    if (idx !== current) {
      current = idx;
      navLinks.forEach(l => l.toggleAttribute('aria-current', l.hash === '#' + scenes[idx].id));
    }
    root.classList.toggle('at-end', idx === scenes.length - 1);
  }
  addEventListener('scroll', update, { passive: true });
  addEventListener('resize', () => { const i = current; setMode(); if (walking && i >= 0) scrollTo(0, sceneTop(i)); });
  wide.addEventListener('change', setMode);
  reduce.addEventListener('change', setMode);

  function goScene(id, smooth = true) {
    const i = sceneIndex(id);
    if (i < 0) return;
    scrollTo({ top: sceneTop(i), behavior: smooth && !reduce.matches ? 'smooth' : 'auto' });
  }

  // Keyboard users tabbing into another scene: bring that scene into view.
  stage.addEventListener('focusin', e => {
    if (!walking) return;
    const s = e.target.closest('.scene');
    if (s && e.target !== s && !s.classList.contains('on')) goScene(s.id, false);
  });

  /* ---- hash sub-pages (#/books …) ---- */
  function closeState() {
    root.classList.remove('page-open', 'page-books');
    stage.inert = false; header.inert = false;
    openPage = null;
  }
  function route(fromClick) {
    const h = decodeURIComponent(location.hash);
    if (!walking) return;
    const page = h.startsWith('#/') ? document.getElementById(h.slice(1)) : null;
    if (page) {
      if (!fromClick) goScene(page.dataset.scene, false);
      if (!openPage) returnFocus = document.activeElement;
      pages.forEach(p => { p.hidden = p !== page; });
      openPage = page;
      root.classList.add('page-open');
      root.classList.toggle('page-books', page.dataset.scene === 'books');
      stage.inert = true; header.inert = true;
      page.scrollTop = 0;
      page.querySelector('h3').focus({ preventScroll: true });
    } else {
      pages.forEach(p => { p.hidden = true; });
      const was = openPage;
      closeState();
      if (was) {
        const target = returnFocus && document.contains(returnFocus) ? returnFocus
          : document.querySelector(`#${was.dataset.scene} .key`);
        target?.focus({ preventScroll: true });
      }
    }
  }
  function closePage() {
    if (!openPage) return;
    if (history.state && history.state.page) history.back();
    else { history.replaceState(null, '', '#' + openPage.dataset.scene); route(true); }
  }

  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || !walking) return;
    const h = a.getAttribute('href');
    if (a.classList.contains('back')) { e.preventDefault(); closePage(); return; }
    if (h.startsWith('#/')) {
      e.preventDefault();
      history.pushState({ page: true }, '', h);
      route(true);
    } else if (sceneIndex(h.slice(1)) >= 0) {
      e.preventDefault();
      history.replaceState(null, '', h);
      goScene(h.slice(1));
      const s = document.getElementById(h.slice(1));
      s.tabIndex = -1; s.focus({ preventScroll: true });
    }
  });
  addEventListener('popstate', () => route(false));
  addEventListener('hashchange', () => route(false));
  addEventListener('keydown', e => { if (e.key === 'Escape' && openPage) closePage(); });
  pages.forEach(p => p.addEventListener('click', e => { if (e.target === p) closePage(); }));

  /* ---- drift toggle ---- */
  driftBtn.addEventListener('click', () => {
    paused = !paused;
    driftBtn.setAttribute('aria-pressed', String(paused));
    driftBtn.textContent = paused ? 'Let it drift' : 'Still the sky';
    root.style.setProperty('--m', paused ? '0' : '');
    root.classList.toggle('moving', moving());
    startSky();
  });

  /* ---- pointer: parallax + glow + pollen ---- */
  const glow = document.querySelector('.glow');
  const fine = matchMedia('(pointer: fine)');
  let mx = 0, my = 0, tx = 0, ty = 0, px = -999, py = -999;
  addEventListener('pointermove', e => {
    if (!walking || !fine.matches) return;
    root.classList.add('pointer');
    tx = e.clientX / innerWidth * 2 - 1; ty = e.clientY / innerHeight * 2 - 1;
    if (moving()) {
      glow.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      const dist = Math.hypot(e.clientX - px, e.clientY - py);
      if (dist > 14) { emit(e.clientX, e.clientY); px = e.clientX; py = e.clientY; }
    }
  }, { passive: true });
  document.addEventListener('pointerleave', () => root.classList.remove('pointer'));

  /* ---- sky canvas: stars rushing past as you walk, pollen motes ---- */
  const canvas = document.querySelector('.sky');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, raf = 0, lastY = scrollY, vel = 0;
  const stars = Array.from({ length: 170 }, () => newStar(Math.random()));
  const motes = Array.from({ length: 34 }, () => ({
    x: Math.random(), y: Math.random(), r: 1.2 + Math.random() * 2.6,
    s: 0.00004 + Math.random() * 0.00012, ph: Math.random() * 6.28, z: 0.4 + Math.random() * 0.8
  }));
  const pollen = [];
  function newStar(z) {
    return { x: (Math.random() * 2 - 1) * 1.4, y: (Math.random() * 2 - 1) * 1.0, z: z || 1, gold: Math.random() < 0.35 };
  }
  function emit(x, y) {
    for (let k = 0; k < 2; k++) pollen.push({ x, y, vx: (Math.random() - .5) * .6, vy: -.2 - Math.random() * .5, life: 1, r: .8 + Math.random() * 1.8 });
    if (pollen.length > 160) pollen.splice(0, pollen.length - 160);
  }
  function size() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function frame(time) {
    const live = moving();
    const y = scrollY; vel += ((y - lastY) - vel) * 0.2; lastY = y;
    mx += (tx - mx) * 0.05; my += (ty - my) * 0.05;
    if (live) { root.style.setProperty('--mx', mx.toFixed(3)); root.style.setProperty('--my', my.toFixed(3)); }
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    const cx = W / 2, cy = H / 2, f = Math.max(W, H) * 0.5;
    const dz = live ? 0.0006 + Math.max(-0.03, Math.min(0.03, vel * 0.00045)) : 0;
    for (const s of stars) {
      s.z -= dz;
      if (s.z < 0.04) Object.assign(s, newStar(1));
      if (s.z > 1) Object.assign(s, newStar(0.05));
      const sx = cx + (s.x / s.z) * f - mx * 18 * (1 - s.z), sy = cy + (s.y / s.z) * f - my * 12 * (1 - s.z);
      if (sx < -10 || sx > W + 10 || sy < -10 || sy > H + 10) { if (live) Object.assign(s, newStar(1)); continue; }
      const k = 1 - s.z;
      ctx.globalAlpha = Math.min(0.85, 0.1 + k * 0.9);
      ctx.fillStyle = s.gold ? '#dcbd84' : '#f3ead9';
      ctx.beginPath(); ctx.arc(sx, sy, 0.3 + k * 1.9, 0, 6.283); ctx.fill();
    }
    for (const m of motes) {
      if (live) { m.y -= m.s * 16; if (m.y < -0.05) { m.y = 1.05; m.x = Math.random(); } }
      const sx = (m.x + Math.sin(time / 4000 + m.ph) * 0.02) * W - mx * 30 * m.z;
      const sy = m.y * H - my * 20 * m.z;
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, m.r * 5);
      g.addColorStop(0, '#dcbd84cc'); g.addColorStop(1, '#dcbd8400');
      ctx.globalAlpha = 0.35 + 0.25 * Math.sin(time / 1300 + m.ph);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, m.r * 5, 0, 6.283); ctx.fill();
    }
    for (let i = pollen.length - 1; i >= 0; i--) {
      const p = pollen[i];
      p.x += p.vx; p.y += p.vy; p.vy -= 0.004; p.life -= 0.012;
      if (p.life <= 0) { pollen.splice(i, 1); continue; }
      ctx.globalAlpha = p.life * 0.9; ctx.fillStyle = p.life > .6 ? '#f3ead9' : '#dcbd84';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.5 + p.life * 0.6), 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    raf = live ? requestAnimationFrame(frame) : 0;
  }
  function startSky() {
    cancelAnimationFrame(raf); raf = 0;
    if (!walking) return;
    size();
    if (!moving()) { root.style.setProperty('--mx', 0); root.style.setProperty('--my', 0); }
    raf = requestAnimationFrame(frame); // still mode draws a single static frame
  }
  addEventListener('resize', () => walking && size());

  setMode();
  if (walking && location.hash && !location.hash.startsWith('#/') && sceneIndex(location.hash.slice(1)) >= 0) {
    goScene(location.hash.slice(1), false);
  }
})();

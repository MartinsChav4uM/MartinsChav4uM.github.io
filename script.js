(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const SVG = 'http://www.w3.org/2000/svg';

  document.getElementById('year').textContent = new Date().getFullYear();

  /* ---------- Nav ---------- */
  const nav = $('#nav');
  const onNav = () => nav.classList.toggle('scrolled', scrollY > 20);
  addEventListener('scroll', onNav, { passive: true });
  onNav();

  /* ---------- Diafragma (usado no topo e na abertura) ---------- */
  const N = 9, L = 400;
  const makeAperture = (group, clipR) => {
    if (clipR) {
      const id = 'clip' + Math.random().toString(36).slice(2, 8);
      const defs = document.createElementNS(SVG, 'defs');
      const cp = document.createElementNS(SVG, 'clipPath');
      const c = document.createElementNS(SVG, 'circle');
      cp.id = id; c.setAttribute('r', clipR);
      cp.appendChild(c); defs.appendChild(cp);
      group.parentNode.insertBefore(defs, group);
      group.setAttribute('clip-path', `url(#${id})`);
    }
    const blades = Array.from({ length: N }, () => {
      const p = document.createElementNS(SVG, 'polygon');
      p.setAttribute('class', 'blade');
      group.appendChild(p);
      return p;
    });
    return (r, twist) => {
      const v = Array.from({ length: N }, (_, i) => {
        const a = (i / N) * Math.PI * 2 + twist;
        return [Math.cos(a) * r, Math.sin(a) * r];
      });
      blades.forEach((b, i) => {
        const [x0, y0] = v[i], [x1, y1] = v[(i + 1) % N];
        let dx = x1 - x0, dy = y1 - y0;
        const len = Math.hypot(dx, dy) || 1;
        dx /= len; dy /= len;
        const nx = dy, ny = -dx; // normal para fora do polígono
        const pts = [
          [x0, y0],
          [x0 + dx * L, y0 + dy * L],
          [x0 + dx * L + nx * L, y0 + dy * L + ny * L],
          [x0 + nx * L, y0 + ny * L],
        ];
        b.setAttribute('points', pts.map(p => p.map(n => n.toFixed(2)).join(',')).join(' '));
      });
    };
  };

  /* Lente do topo: fica aberta e, a cada poucos segundos, fecha e reabre
     rápido como um disparo. Roda mesmo com "reduzir animações" porque é o
     visual principal da abertura (é lento e sem movimento de tela). */
  const drawHero = makeAperture($('#blades'));
  const flash = $('#heroFlash');
  const OPEN = 58, CLOSED = 1.5;
  const CYCLE = 3400, HOLD = 2500, SHUT = 170, DARK = 90; // ms
  let apR = CLOSED, heroStarted = false, lastShot = -1;
  drawHero(apR, 0);
  const easeIn = k => k * k * k;
  const easeOut = k => 1 - Math.pow(1 - k, 3);
  // Abertura do obturador no ciclo: 1 = aberta, 0 = fechada
  const shutter = t => {
    const c = t % CYCLE;
    if (c < HOLD) return 1;
    if (c < HOLD + SHUT) return 1 - easeIn((c - HOLD) / SHUT);
    if (c < HOLD + SHUT + DARK) return 0;
    return easeOut((c - HOLD - SHUT - DARK) / (CYCLE - HOLD - SHUT - DARK));
  };
  let t0 = 0;
  const tick = now => {
    if (heroStarted) {
      if (!t0) t0 = now;
      const t = now - t0;
      const max = OPEN - (OPEN - 22) * Math.min(1, scrollY / (innerHeight * .9));
      const target = CLOSED + (max - CLOSED) * shutter(t);
      // Fecha rápido (segue o alvo direto); na primeira abertura, entra suave.
      apR = t < 1200 ? apR + (max - apR) * 0.06 : target;
      const shot = Math.floor((t - HOLD - SHUT - DARK) / CYCLE);
      if (t > 1200 && shot > lastShot && (t - HOLD - SHUT - DARK) % CYCLE >= 0) {
        lastShot = shot;
        flash.animate([{ opacity: 0 }, { opacity: 1, offset: .15 }, { opacity: 0 }], { duration: 900, easing: 'ease-out' });
      }
    }
    drawHero(apR, (apR / OPEN) * 0.5);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  /* ---------- Reveal ---------- */
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    });
  }, { threshold: .18, rootMargin: '0px 0px -40px 0px' });
  const startPage = () => {
    heroStarted = true;
    $$('.reveal, .tile').forEach(el => io.observe(el));
  };

  /* ---------- Abertura: aparece uma vez por visita ---------- */
  const splash = $('#splash');
  let seen = false;
  try { seen = sessionStorage.getItem('gf-splash') === '1'; } catch (e) {}
  if (reduce || seen) {
    splash.remove();
    startPage();
  } else {
    try { sessionStorage.setItem('gf-splash', '1'); } catch (e) {}
    document.documentElement.style.overflow = 'hidden';
    const drawIris = makeAperture($('#splashBlades'), 98);
    const t0 = performance.now();
    const iris = now => {
      const k = Math.min(1, (now - t0) / 1100);
      const e = 1 - Math.pow(1 - k, 3);
      drawIris(8 + 82 * e, e * .6);
      if (k < 1) requestAnimationFrame(iris);
    };
    requestAnimationFrame(iris);
    setTimeout(() => {
      splash.classList.add('out');
      document.documentElement.style.overflow = '';
      setTimeout(startPage, 150);
      setTimeout(() => splash.remove(), 800);
    }, 1700);
  }

  /* ---------- Faixa de filme: as fotos passam devagar ----------
     Feito com Web Animations para rodar mesmo com "reduzir animações"
     (o movimento é bem lento e contínuo). */
  const film = $('#filmTrack');
  const filmAnim = film.animate(
    [{ transform: 'translateX(0)' }, { transform: 'translateX(-50%)' }],
    { duration: 80000, iterations: Infinity }
  );
  film.addEventListener('pointerenter', () => filmAnim.updatePlaybackRate(.25));
  film.addEventListener('pointerleave', () => filmAnim.updatePlaybackRate(1));

  /* ---------- Frase no visor: foca com a rolagem e a câmera dispara ---------- */
  const shotSec = $('#shot');
  const vf = $('#viewfinder');
  const vfState = $('#vfState');
  const vfCount = $('#vfCount');
  const vfFlash = $('#vfFlash');
  const shotHint = $('#shotHint');
  const drawShutter = makeAperture($('#shutterBlades'));
  const SHUT_OPEN = 140;
  drawShutter(SHUT_OPEN, 0);
  let taken = false, firing = false;
  const fire = () => {
    taken = true; firing = true;
    const t0 = performance.now();
    let flashed = false;
    const step = now => {
      const t = now - t0;
      let r;
      if (t < 170) r = SHUT_OPEN * (1 - Math.pow(t / 170, 2));      // fecha
      else if (t < 240) r = 0;                                         // fechado
      else r = SHUT_OPEN * (1 - Math.pow(1 - Math.min(1, (t - 240) / 260), 3)); // abre
      drawShutter(r, (1 - r / SHUT_OPEN) * .6);
      if (!flashed && t >= 200) {
        flashed = true;
        vf.classList.add('taken');
        vfCount.textContent = '35';
        vfState.textContent = 'Foto salva';
        vfFlash.animate([{ opacity: .95 }, { opacity: 0 }], { duration: 700, easing: 'ease-out' });
      }
      if (t < 500) requestAnimationFrame(step); else firing = false;
    };
    requestAnimationFrame(step);
  };
  const onStatement = () => {
    const r = shotSec.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, -r.top / (r.height - innerHeight)));
    const focus = taken ? 1 : Math.min(1, p / .5);
    vf.style.setProperty('--focus', focus.toFixed(3));
    vf.classList.toggle('locked', focus >= 1);
    if (!taken) vfState.textContent = focus >= 1 ? 'Foco OK' : 'Focando…';
    shotHint.style.opacity = taken ? 0 : Math.max(0, 1 - p * 3);
    if (!taken && p >= .58) fire();
    else if (taken && !firing && p < .4) {
      // Voltou para cima: prepara a cena para disparar de novo.
      taken = false;
      vf.classList.remove('taken');
      vfCount.textContent = '36';
    }
  };

  /* ---------- Fluxo: troca a tela conforme o passo ativo ---------- */
  const steps = $$('.step');
  const screens = $$('.scr');
  const railIcons = $$('.rail i');
  const flowStage = $('#flowStage');
  const flowFill = $('#flowFill');
  const flowNum = $('#flowNum');
  const dots = $$('.flow-rail i');
  const toasts = $$('.toast');
  const glows = ['rgba(226, 150, 58, .38)', 'rgba(76, 194, 131, .26)', 'rgba(240, 174, 78, .4)', 'rgba(229, 154, 64, .32)'];
  let stepNow = -1;
  const setStep = i => {
    steps.forEach(s => s.classList.toggle('active', +s.dataset.step === i));
    screens.forEach((s, k) => s.classList.toggle('on', k === i));
    railIcons.forEach(r => r.classList.toggle('r-on', (r.dataset.for || '').split(' ').includes(String(i))));
    if (i === stepNow) return;
    stepNow = i;
    dots.forEach((d, k) => { d.classList.toggle('done', k <= i); d.classList.toggle('now', k === i); });
    toasts.forEach(t => t.classList.toggle('on', +t.dataset.for === i));
    flowNum.textContent = String(i + 1).padStart(2, '0');
    flowStage.style.setProperty('--fg', glows[i]);
  };
  const flowVisual = $('.flow-visual');
  const onFlow = () => {
    // No celular a janela fica presa no alto: o passo ativo é o que está no meio do espaço abaixo dela.
    const fundo = innerWidth <= 760 ? Math.max(0, flowVisual.getBoundingClientRect().bottom) : 0;
    const mid = innerWidth <= 760 ? fundo + (innerHeight - fundo) / 2 : innerHeight * .55;
    let best = 0, bestD = Infinity;
    steps.forEach(s => {
      const r = s.getBoundingClientRect();
      const d = Math.abs(r.top + r.height / 2 - mid);
      if (d < bestD) { bestD = d; best = +s.dataset.step; }
    });
    setStep(best);
    // Trilho: enche do centro do primeiro passo ao centro do último.
    const a = steps[0].getBoundingClientRect(), b = steps[steps.length - 1].getBoundingClientRect();
    const from = a.top + a.height / 2, to = b.top + b.height / 2;
    flowFill.parentElement.style.setProperty('--fp', Math.min(1, Math.max(0, (mid - from) / (to - from))).toFixed(3));
  };
  // Janela inclina de leve seguindo o mouse.
  flowStage.addEventListener('pointermove', e => {
    const r = flowStage.getBoundingClientRect();
    flowStage.style.setProperty('--tx', ((e.clientX - r.left) / r.width - .5).toFixed(3));
    flowStage.style.setProperty('--ty', ((e.clientY - r.top) / r.height - .5).toFixed(3));
  });
  flowStage.addEventListener('pointerleave', () => {
    flowStage.style.setProperty('--tx', 0);
    flowStage.style.setProperty('--ty', 0);
  });

  /* ---------- Aparência: claro, escuro ou igual ao Windows ---------- */
  const galWin = $('#galWin');
  const seg = $('.seg');
  const segBtns = $$('button', seg);
  const pill = $('.seg-pill', seg);
  const sysDark = matchMedia('(prefers-color-scheme: dark)');
  let tema = 'escuro';
  const placePill = () => {
    const b = segBtns.find(x => x.dataset.tema === tema);
    pill.style.width = b.offsetWidth + 'px';
    pill.style.transform = `translateX(${b.offsetLeft}px)`;
  };
  const applyTema = t => {
    tema = t;
    const claro = t === 'claro' || (t === 'windows' && !sysDark.matches);
    galWin.classList.toggle('claro', claro);
    segBtns.forEach(b => b.setAttribute('aria-checked', String(b.dataset.tema === t)));
    placePill();
  };
  segBtns.forEach(b => b.addEventListener('click', () => applyTema(b.dataset.tema)));
  seg.addEventListener('keydown', e => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = segBtns.findIndex(b => b.dataset.tema === tema);
    const n = segBtns[(i + (e.key === 'ArrowRight' ? 1 : segBtns.length - 1)) % segBtns.length];
    applyTema(n.dataset.tema);
    n.focus();
  });
  sysDark.addEventListener?.('change', () => tema === 'windows' && applyTema('windows'));
  applyTema('escuro');
  document.fonts?.ready.then(placePill);

  /* ---------- Luz que segue o mouse (cards do site e cartões do app) ---------- */
  $$('.tile, .kpi, .app-card, .gal-grid figure').forEach(t => {
    t.addEventListener('pointermove', e => {
      const r = t.getBoundingClientRect();
      t.style.setProperty('--mx', `${e.clientX - r.left}px`);
      t.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });


  /* ---------- Menu em "liquid glass": a gota desliza até o link apontado
     e, sem mouse em cima, fica na seção que está na tela ---------- */
  const navLinks = $('.nav-links');
  const lens = $('.nav-lens');
  const lensIn = $('i', lens);
  const links = $$('a', navLinks);
  let lensAt = null, hovering = false;
  const moveLens = a => {
    if (!a) { lens.classList.remove('show'); lensAt = null; return; }
    if (a === lensAt) return;
    const first = !lensAt;
    lens.style.width = a.offsetWidth + 'px';
    lens.style.transform = `translateX(${a.offsetLeft}px)`;
    if (first) {
      // Primeira vez: aparece já no lugar, sem deslizar a partir da borda.
      lens.style.transition = 'none';
      lens.offsetWidth;
      lens.style.transition = '';
    } else {
      // Deslizando: a gota "estica" e volta, como líquido.
      lensIn.animate(
        [{ transform: 'scale(1, 1)' }, { transform: 'scale(1.12, .82)', offset: .35 }, { transform: 'scale(.97, 1.04)', offset: .7 }, { transform: 'scale(1, 1)' }],
        { duration: 520, easing: 'ease-out' }
      );
    }
    lens.classList.add('show');
    lensAt = a;
  };
  const sections = links.map(a => $(a.getAttribute('href')));
  const currentLink = () => {
    let cur = null;
    sections.forEach((s, i) => { if (s && s.getBoundingClientRect().top < innerHeight * .4) cur = links[i]; });
    // Depois das dúvidas (chamada final e rodapé) nenhum link fica marcado.
    if (cur === links[links.length - 1] && $('#teste').getBoundingClientRect().top < innerHeight * .4) cur = null;
    return cur;
  };
  const syncNav = () => {
    const cur = currentLink();
    links.forEach(a => a.classList.toggle('on', a === cur));
    if (!hovering) moveLens(cur);
  };
  links.forEach(a => a.addEventListener('pointerenter', () => { hovering = true; moveLens(a); }));
  navLinks.addEventListener('pointerleave', () => { hovering = false; syncNav(); });
  document.fonts?.ready.then(() => { lensAt = null; syncNav(); });
  navLinks.addEventListener('pointermove', e => {
    const r = navLinks.getBoundingClientRect();
    navLinks.style.setProperty('--lx', `${e.clientX - r.left}px`);
    navLinks.style.setProperty('--ly', `${e.clientY - r.top}px`);
  });
  /* ---------- Loop de scroll ---------- */
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      onStatement();
      onFlow();
      syncNav();
      ticking = false;
    });
  };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', () => { onScroll(); placePill(); });
  onScroll();

})();

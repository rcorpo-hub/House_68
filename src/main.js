import './style.css';
import { createEngine, createScene, flyTo, focusPoint, cancelFlight, VIEWS } from './scene/setup.js';
import { createMaterials } from './scene/materials.js';
import { buildEntryDoor } from './scene/entryDoor.js';
import { buildLandscape } from './scene/landscape.js';
import { CATEGORIES, findOption } from './catalog.js';
import { INTERIOR_CATEGORIES } from './interiorCatalog.js';
import { createStore } from './state.js';
import { createPanel } from './ui/panel.js';
import { createOverlay } from './ui/overlay.js';
import { createInteriorPicker } from './ui/interiorPicker.js';
import { createSummary } from './ui/summary.js';
import { createLighting } from './app/lighting.js';
import { buildCampHill, campExcludedInterior, campViews } from './homes/campHill.js';
import { createCapture } from './app/capture.js';

const $ = (s) => document.querySelector(s);
const canvas = $('#renderCanvas');
const stage = $('.stage');
const loader = $('.loader');
campViews(VIEWS);
const roof = CATEGORIES.find((category) => category.key === 'roof');
roof.notes = [...(roof.notes || []), 'Sarking and Anticon are concealed. Your choice appears in the summary.'];
const fascia = CATEGORIES.find((category) => category.key === 'fascia');
fascia.notes = ['One colour is used for the fascia.', fascia.notes.at(-1)];

for (let i = INTERIOR_CATEGORIES.length - 1; i >= 0; i--) {
  if (campExcludedInterior.includes(INTERIOR_CATEGORIES[i].key)) INTERIOR_CATEGORIES.splice(i, 1);
}

// Reference finishes are visible before the buyer makes a choice.
const previewColours = {
  roof: 'cb-woodland-grey', gutter: 'cb-monument', fascia: 'cb-monument',
  flashing: 'cb-shale-grey', cladding: 'dx-tristan', frame: 'fr-black',
  trim: 'cb-monument', garage: 'cb-woodland-grey', render: 'dx-natural-white',
};
function previewSelection(key, selection) {
  if (selection?.colour || !previewColours[key]) return selection;
  return { ...selection, colour: previewColours[key] };
}
const setLoad = (t) => (loader.querySelector('p').textContent = t);
// yield so the loader text can paint (timer fallback: rAF pauses in hidden tabs)
const tick = () => new Promise((r) => {
  requestAnimationFrame(() => setTimeout(r, 0));
  setTimeout(r, 60);
});

async function boot() {
  const engine = createEngine(canvas);
  const { scene, camera, sun, hemi, shadows, pipeline, setSky } = createScene(engine, canvas);
  setLoad('Painting the sky…');
  await tick();
  await setSky('day');
  setLoad('Mixing materials…');
  await tick();
  const { M, apply } = await createMaterials(scene);
  setLoad('Building your home…');
  await tick();
  const ground = buildLandscape(scene, M, shadows, { level: -0.5, showDriveway: false });
  const { house, interior } = buildCampHill({ scene, M, shadows });
  // The entry door leaf is cut to the selected profile, so it lives in its own
  // rebuildable module rather than in the merged house geometry.
  const entryDoor = buildEntryDoor({ scene, M, shadows, ...house.entryOpening });

  const store = createStore('68-boundary-road');
  for (const c of CATEGORIES) await apply(c.key, previewSelection(c.key, store.state.sel[c.key]), false);
  entryDoor.apply(store.state.sel.entry);

  setLoad('Fitting out the interior…');
  await tick();
  await interior.buildAll(store.state.int);

  // Guide p.18-19 extras are geometry, not just materials, so they are toggled
  // alongside the frame material whenever the Window Frame selection changes.
  const syncWindowExtras = (sel = store.state.sel.frame || {}) => {
    house.setWindowExtras({
      flyscreen: !!findOption(sel.flyscreen)?.mesh,
      barrier: !!findOption(sel.barrier)?.barrier,
      boutique: findOption(sel.boutique)?.boutique || null,
    });
  };
  syncWindowExtras();
  // Guide p.21 — brick infill with a steel lintel, or fibre cement sheeting.
  const syncInfill = (sel = store.state.sel.bricks) => house.setInfill(findOption(sel?.infill)?.infill || 'brick');
  syncInfill();

  // part → meshes (for hover highlight)
  const partMeshes = (part) => {
    if (!part) return [];
    return scene.meshes.filter((m) => m.metadata?.part === part);
  };

  // ------------------------------------------------ light, mood & cutaway
  const lighting = createLighting({
    scene, sun, hemi, pipeline, M, house, ground, interior, entryDoor, setSky,
    onInside: (on) => {
      const button = $('[data-act="transparent"]');
      button.classList.toggle('on', on);
    },
  });
  const setMood = lighting.setMood;
  const setInside = lighting.setInside;
  const floorFor = (view) => ['master', 'media', 'ensuite', 'wc'].includes(view) ? 1 : 0;
  function inspectView(view) {
    setInside(true);
    house.showFloor(floorFor(view));
  }

  // ------------------------------------------------ UI
  let autoRotate = false;
  const panel = createPanel({
    root: $('.panel'),
    store,
    onOpen: (cat, tab) => {
      setMode(tab);
      overlay.setActive(tab === 'int' ? null : cat?.key || null);
      if (!cat) return;
      stopRotate();
      if (tab === 'int') inspectView(cat.view);
      else setInside(false);
      flyTo(camera, cat.view);
      if (tab !== 'int') overlay.flash(cat.key);
    },
    onDone: () => showSummary(),
  });
  const note = document.createElement('p');
  note.className = 'camp-preview-note';
  note.textContent = '68 Boundary Road · Materials and fixtures shown as previews';
  $('.panel-head').append(note);
  const overlay = createOverlay({
    stage,
    scene,
    camera,
    engine,
    anchors: house.anchors,
    partMeshes,
    store,
    onPick: (key) => {
      if (panel.openKey !== key) panel.open(key);
      document.body.classList.add('sheet-open');
    },
  });

  const interiorPick = createInteriorPicker({
    stage,
    scene,
    engine,
    store,
    onPick: (key) => {
      if (panel.openKey !== key) panel.open(key);
      document.body.classList.add('sheet-open');
    },
  });

  // External mode shows the A–L pins; Internal mode hides them and makes every
  // configurable item in the house hoverable instead.
  let mode = 'ext';
  function setMode(next) {
    if (!next || mode === next) return;
    mode = next;
    const internal = mode === 'int';
    overlay.setEnabled(!internal);
    interiorPick.setEnabled(internal);
    document.body.classList.toggle('mode-int', internal);
    if (internal) setInside(true);
  }

  const summary = createSummary({
    root: $('#summary'),
    store,
    scene,
    exteriorViews: ['home', 'summaryRight', 'summaryLeft', 'aerial'],
    capture: createCapture({
      floor: { get: house.getFloor, set: house.showFloor, forView: floorFor },
      engine,
      canvas,
      camera,
      lighting,
      rotate: { isOn: () => autoRotate, stop: () => stopRotate(), toggle: () => toggleRotate() },
    }),
  });

  // Process snapshots in order so a slow texture load cannot restore an old choice.
  let prevSel = structuredClone(store.state.sel);
  let prevInt = structuredClone(store.state.int);
  let pendingPreview = Promise.resolve();
  store.subscribe((state) => {
    const nextSel = structuredClone(state.sel);
    const nextInt = structuredClone(state.int);
    pendingPreview = pendingPreview.catch(console.error).then(async () => {
      for (const c of CATEGORIES) {
        if (JSON.stringify(prevSel[c.key]) === JSON.stringify(nextSel[c.key])) continue;
        await apply(c.key, previewSelection(c.key, nextSel[c.key]), true);
        if (c.key === 'frame') syncWindowExtras(nextSel.frame);
        if (c.key === 'bricks') syncInfill(nextSel.bricks);
        if (c.key === 'entry') entryDoor.apply(nextSel.entry);
        prevSel[c.key] = nextSel[c.key];
      }
      for (const c of INTERIOR_CATEGORIES) {
        if (JSON.stringify(prevInt[c.key]) === JSON.stringify(nextInt[c.key])) continue;
        await interior.apply(c.key, nextInt[c.key]);
        prevInt[c.key] = nextInt[c.key];
      }
    });
  });

  // ------------------------------------------------ dock
  const dock = $('.dock');
  function stopRotate() {
    if (!autoRotate) return;
    toggleRotate();
  }
  function toggleRotate() {
    autoRotate = !autoRotate;
    camera.useAutoRotationBehavior = autoRotate;
    if (autoRotate) {
      camera.autoRotationBehavior.idleRotationSpeed = 0.12;
      camera.autoRotationBehavior.idleRotationWaitTime = 1500;
      camera.autoRotationBehavior.idleRotationSpinupTime = 1200;
    }
    dock.querySelector('[data-act="rotate"]').classList.toggle('on', autoRotate);
  }


  const insideTrigger = $('[data-act="transparent"]');
  const insideOptions = $('#inside-options');
  const insideControl = insideTrigger.closest('.inside-control');
  const insideChoices = [...insideOptions.querySelectorAll('[data-inside-view]')];

  function closeInsideOptions(restoreFocus = false) {
    insideOptions.hidden = true;
    insideTrigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus) insideTrigger.focus();
  }

  insideTrigger.addEventListener('click', () => {
    if (!insideOptions.hidden) {
      closeInsideOptions();
      return;
    }
    const current = !lighting.isInside() ? 'exterior'
      : house.getFloor() === 1 ? 'upper' : 'ground';
    for (const choice of insideChoices) {
      choice.setAttribute('aria-pressed', String(choice.dataset.insideView === current));
    }
    insideOptions.style.left = '0px';
    insideOptions.hidden = false;
    const overflow = insideOptions.getBoundingClientRect().right - stage.getBoundingClientRect().right + 8;
    if (overflow > 0) insideOptions.style.left = '-' + overflow + 'px';
    insideTrigger.setAttribute('aria-expanded', 'true');
    insideChoices.find((choice) => !choice.hidden)?.focus();
  });

  insideOptions.addEventListener('click', (event) => {
    const choice = event.target.closest('[data-inside-view]');
    if (!choice) return;
    const view = choice.dataset.insideView;
    const inside = view !== 'exterior';
    stopRotate();
    house.showFloor(view === 'ground' ? 0 : 1);
    setInside(inside);
    flyTo(camera, inside ? 'dollhouse' : 'home');
    for (const button of dock.querySelectorAll('[data-view]')) {
      button.classList.toggle('on', !inside && button.dataset.view === 'home');
    }
    closeInsideOptions(true);
  });
  document.addEventListener('pointerdown', (event) => {
    if (!insideOptions.hidden && !insideControl.contains(event.target)) closeInsideOptions();
  });
  insideControl.addEventListener('focusout', (event) => {
    if (!insideControl.contains(event.relatedTarget)) closeInsideOptions();
  });
  insideControl.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !insideOptions.hidden) {
      event.preventDefault();
      closeInsideOptions(true);
    }
  });

  dock.addEventListener('click', (e) => {
    const v = e.target.closest('[data-view]');
    if (v) {
      stopRotate();
      if (['living', 'kitchen', 'master', 'media', 'alfresco'].includes(v.dataset.view)) inspectView(v.dataset.view);
      else setInside(false);
      flyTo(camera, v.dataset.view);
      for (const b of dock.querySelectorAll('[data-view]')) b.classList.toggle('on', b === v);
      return;
    }
    const mood = e.target.closest('[data-mood]');
    if (mood) {
      setMood(mood.dataset.mood);
      for (const b of dock.querySelectorAll('[data-mood]')) b.classList.toggle('on', b === mood);
      return;
    }
    if (e.target.closest('[data-act="pins"]')) {
      const b = e.target.closest('[data-act="pins"]');
      b.classList.toggle('on');
      overlay.setPins(b.classList.contains('on'));
    }
    if (e.target.closest('[data-act="rotate"]')) toggleRotate();
  });
  // a manual drag/zoom cancels any camera glide and clears the active view button
  const userMoved = () => {
    cancelFlight();
    for (const b of dock.querySelectorAll('[data-view].on')) b.classList.remove('on');
  };
  canvas.addEventListener('pointerdown', userMoved);
  canvas.addEventListener('wheel', userMoved, { passive: true });

  // Double-click (or double-tap) anywhere to make that spot the pivot, so you can
  // orbit around whatever you are looking at.
  function recentre(e) {
    const pick = scene.pick(scene.pointerX, scene.pointerY, (m) => m.isPickable && m.isVisible && m.name !== 'skybox');
    if (!pick?.hit || !pick.pickedPoint) return;
    overlay.cancelTap();
    interiorPick.cancelTap();
    stopRotate();
    focusPoint(camera, pick.pickedPoint);
    ping(e);
  }
  canvas.addEventListener('dblclick', recentre);
  let lastTap = 0;
  let lastXY = null;
  canvas.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'mouse') return;
    const now = performance.now();
    const near = lastXY && Math.hypot(e.clientX - lastXY.x, e.clientY - lastXY.y) < 26;
    if (now - lastTap < 330 && near) {
      recentre(e);
      lastTap = 0;
    } else {
      lastTap = now;
      lastXY = { x: e.clientX, y: e.clientY };
    }
  });
  // brief marker so the new pivot is obvious
  const pingEl = document.createElement('div');
  pingEl.className = 'pivot-ping';
  pingEl.hidden = true;
  stage.appendChild(pingEl);
  let pingTimer = null;
  function ping(e) {
    const r = stage.getBoundingClientRect();
    pingEl.style.left = `${e.clientX - r.left}px`;
    pingEl.style.top = `${e.clientY - r.top}px`;
    pingEl.hidden = false;
    pingEl.classList.remove('on');
    void pingEl.offsetWidth;
    pingEl.classList.add('on');
    clearTimeout(pingTimer);
    pingTimer = setTimeout(() => {
      pingEl.hidden = true;
    }, 700);
  }
  async function showSummary() {
    await pendingPreview.catch(console.error);
    await summary.show();
  }
  $('[data-act="done-top"]').addEventListener('click', showSummary);
  store.subscribe(() => updateTopDone());
  function updateTopDone() {
    const n = store.completed().length + store.completedInt().length;
    const all = CATEGORIES.length + INTERIOR_CATEGORIES.length;
    const b = $('[data-act="done-top"]');
    b.disabled = store.completed().length < CATEGORIES.length;
    $('.top-progress b').textContent = `${n}/${all}`;
    $('.top-progress i').style.setProperty('--p', `${(n / all) * 360}deg`);
  }
  updateTopDone();

  // mobile: bottom sheet toggle
  $('[data-act="sheet"]').addEventListener('click', () => document.body.classList.toggle('sheet-open'));
  $('.panel').addEventListener('click', (e) => {
    if (e.target.closest('.panel-head') && matchMedia('(max-width: 820px)').matches) document.body.classList.toggle('sheet-open');
  });

  // ------------------------------------------------ go
  engine.runRenderLoop(() => scene.render());
  window.addEventListener('resize', () => engine.resize());
  new ResizeObserver(() => engine.resize()).observe(stage);
  await scene.whenReadyAsync();
  loader.classList.add('gone');
  setTimeout(() => loader.remove(), 800);
  if (store.completed().length < CATEGORIES.length) {
    // gentle intro sweep
    const v = VIEWS.home;
    camera.alpha = v.alpha - 0.5;
    camera.radius = v.radius + 6;
    flyTo(camera, 'home', 2200);
  }
}

boot().catch((err) => {
  console.error(err);
  setLoad('Sorry — 3D could not start on this device. Please try a recent version of Chrome, Edge, Safari or Firefox.');
});

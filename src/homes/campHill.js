import { Color3, PBRMaterial, PointLight, Vector3 } from '../scene/babylon.js';
import { Geo, Wall } from '../scene/geometry.js';
import { createApply, createMaterials, createTextures } from '../scene/interior/materials.js';
import { INTERIOR_CATEGORIES, resolveAll } from '../interiorCatalog.js';
import { createCampFitout } from './campHillFitout.js';
import { levels } from './campHillPlan.js';

export const campExcludedInterior = [];

const point = (u, y, v) => [v - 4.4, y, u - 11.05];
const vec = (...args) => new Vector3(...point(...args));

export function campViews(views) {
  const focus = (u, y, v, radius, alpha = -2, beta = 1.23) =>
    ({ target: point(u, y, v), radius, alpha, beta });
  Object.assign(views, {
    home: focus(9, 1.65, 4.4, 35), front: focus(2.2, 2.55, 4.4, 18, -Math.PI / 2, 1.43),
    left: focus(11, 2.6, 4.4, 31, Math.PI), right: focus(11, 2.6, 4.4, 31, 0),
    aerial: focus(11, 1.5, 4.4, 39, -2, 0.66), back: focus(23, 1.45, 4.4, 33, 1.11),
    summaryRight: focus(10.8, 1.8, 4.4, 34, -1.02),
    summaryLeft: focus(10.8, 1.8, 4.4, 34, -2.14),
    hall: focus(8.1,1.25,4.23,2.85,-1.55), wc: focus(9.9,4.1,1.3,2.4,0.5),
    dollhouse: focus(11,1.8,4,34,-2,0.55),
    living: focus(18,1.2,1.8,4.4,2.2), kitchen: focus(16,1.25,6.4,4.6,2.65),
    pantry: focus(12.8,1.2,6.3,2.3,2.65), master: focus(18.3,4.32,2,2.8,1.23),
    media: focus(2.7,4.32,5.2,4.4,2.2), alfresco: focus(23.6,1.2,4.4,5,1),
    bathroom: focus(10.55,1.2,6.5,2.5,0.5), vanity: focus(10.55,1.2,6.5,2.5,0.5),
    ensuite: focus(20.4,4.25,6.3,2.6,0.5), laundry: focus(8,1.2,6.5,2.2,0.5),
    roof: focus(10,5.8,4,30,-2,0.77), eaves: focus(1,5.9,3,9),
    fascia: focus(1,6.12,7.5,9,-1), downpipe: focus(0,2,0,8),
    cladding: focus(1,4.3,6.8,10), flashing: focus(0,6.1,4,10),
    entry: focus(3.8,1.3,1.2,8), entrydoor: focus(3.8,1.3,1.2,4),
    bricks: focus(2,1.5,8.62,10,-0.65), trim: focus(0,4.3,5.3,8),
    windows: focus(0,4.3,5.3,7), garage: focus(0,1.3,5.6,10), driveway: focus(-2.5,0,5.6,14),
  });
}

export function buildCampHill({ scene, M, shadows }) {
  const IM = createMaterials(scene, M);
  const S = {};
  const { applyMaterials } = createApply({ scene, M, IM, S, ...createTextures(scene) });
  const floors = [[], []];
  const walls = [];
  const roofs = [];
  const extras = [];
  const doorOpenings = [];
  const windows = [];
  const fixedGlass = M.glass.clone('camp-fixed-glass');
  const fixedMetal = IM.appSS;
  const paving = IM.wetTile;
  const groundFinish = IM.kick;
  const canopy = IM.appBlack.clone('camp-canopy');
  canopy.albedoColor = Color3.FromHexString('#7b8084').toLinearSpace();
  canopy.roughness = 0.68;
  let infill;
  let inside = false;
  let floor = 1;

  function mesh(name, material, part, int, level, geo) {
    const m = geo.toMesh(name, scene, material);
    m.material = material;
    m.metadata = { part, int };
    m.receiveShadows = true;
    shadows.addShadowCaster(m);
    if (level != null) floors[level].push(m);
    return m;
  }

  function box(name, u0, u1, v0, v1, y0, y1, material, { part, int, level } = {}) {
    const g = new Geo();
    g.box(...point(u0, y0, v0), ...point(u1, y1, v1));
    return mesh(name, material, part, int, level, g);
  }

  function segment(spec, level, external) {
    const [name, u0, v0, u1, v1, part, openings = []] = spec;
    const { base, height } = levels[level];
    const length = Math.hypot(u1 - u0, v1 - v0);
    const du = (u1 - u0) / length;
    const dv = (v1 - v0) / length;
    const reverseNormal = ['ground-left', 'upper-left', 'portico-return', 'deck-slider', 'master-rear', 'garage-return'].includes(name);
    const outward = reverseNormal ? -1 : 1;
    const wall = new Wall({ origin: point(u0, base, v0), dir: [dv, 0, du], out: [du * outward, 0, -dv * outward] });
    const thickness = external ? 0.18 : 0.09;
    const g = new Geo();
    wall.solid(g, 0, length, external && name.startsWith('garage') ? -0.35 : 0, height, thickness,
      openings.map(([s0, s1, y0, y1]) => ({ s0, s1, y0, y1 })));
    walls.push(mesh(name, external ? M[part] : part === 'feature' ? IM.feature : IM.wall,
      external ? part : undefined, external ? undefined : part, level, g));
    const piece = (id, a, b, c, d, material, tag, depth = 0.075) => {
      const shape = new Geo();
      wall.box(shape, a, b, c, d, depth, depth - 0.045);
      return mesh(name + '-' + id, material, tag, undefined, level, shape);
    };
    for (const [i, [a, b, lo, hi, kind]] of openings.entries()) {
      if (kind === 'entry') {
        entryOpening = { wall, x0: a, x1: b, height: hi };
        continue;
      }
      if (kind === 'door') {
        doorOpenings.push({ name, wall, a, b, hi, level, external });
        piece('jamb-left', a - 0.035, a, lo, hi, IM.woodwork);
        piece('jamb-right', b, b + 0.035, lo, hi, IM.woodwork);
        piece('jamb-head', a, b, hi, hi + 0.035, IM.woodwork);
        continue;
      }
      if (kind === 'garage') {
        piece('leaf', a, b, lo, hi, M.garage, 'garage');
        for (const [id, start, end] of [['left', a - 0.10, a], ['right', b, b + 0.10]]) {
          piece('garage-surround-' + id, start, end, lo, hi + 0.10, IM.appBlack, undefined, 0.09);
        }
        piece('garage-surround-head', a, b, hi, hi + 0.10, IM.appBlack, undefined, 0.09);
        infill = piece('infill', a, b, hi, hi + 0.16, M.bricks, 'bricks', 0.012);
        continue;
      }
      piece(i + '-glass', a, b, lo, hi, M.glass, 'frame', 0.012);
      const panels = name === 'deck-slider' ? 6 : name === 'media-front' ? 4 : 2;
      for (let j = 0; j <= panels; j++) {
        const s = a + (b - a) * j / panels;
        piece(i + '-frame-' + j, s - 0.024, s + 0.024, lo, hi, M.frame, 'frame');
      }
      for (const [j, y] of [lo, hi].entries()) {
        if (name === 'media-front') {
          piece(i + '-frame-rail-' + j, a, b, y - 0.035, y + 0.035, M.frame, 'frame');
        }
        piece(i + '-trim-' + j, a - 0.05, b + 0.05, y - 0.045, y + 0.045, M.trim, 'trim');
      }
      const slider = name === 'deck-slider' || name === 'media-front';
      windows.push({ name: name + '-' + i, wall, a, b, lo, hi, level, slider });
      // The glazed openings are traced without a sash schedule. Preview mesh on
      // the operable half and retain the other half as unobstructed fixed glass.
      const screenStart = (a + b) / 2;
      extras.push({
        slider,
        flyscreen: piece(i + '-screen', screenStart, b, lo, hi, M.flyscreen, 'frame', 0.09),
        barrier: piece(i + '-barrier', screenStart, b, lo, hi, M.barrier, 'frame', 0.12),
        boutique: piece(i + '-boutique', a, b, (lo + hi) / 2 - 0.022, (lo + hi) / 2 + 0.022, M.frame, 'frame'),
      });
    }
  }

  let entryOpening;
  levels.forEach(({ slabs, exterior, partitions }, level) => {
    const { base } = levels[level];
    slabs.forEach(([u0, u1, v0, v1, y = base], i) =>
      box('level-' + level + '-slab-' + i, u0, u1, v0, v1, y - (level ? 0.38 : 0.16), y,
        y < 0 ? IM.wetTile : u0 >= 22.05 || u0 < 0 ? paving : IM.floorMain,
        { level, int: y >= 0 && u0 >= 0 && u0 < 22.05 ? 'flooring' : undefined }));
    exterior.forEach((s) => segment(s, level, true));
    partitions.forEach(([name, a, b, c, d, door]) =>
      segment([name, a, b, c, d, 'paint', door ? [[...door, 0, 2.12, 'door']] : []], level, false));
    if (level === 0) {
      box('guest-carpet', 7.49, 11.28, 0.19, 3.43, 0.002, 0.012, IM.carpet, { level, int: 'carpet' });
    } else {
      for (const [name, a, b, c, d] of [
        ['media', 0.18, 6.16, 2.62, 7.73], ['bed4', 3.96, 7.59, 0.18, 3.29],
        ['bed3', 7.53, 11.03, 4.83, 7.73], ['bed2', 11.15, 14.8, 4.83, 7.73],
      ]) box(name + '-carpet', a, b, c, d, base + 0.002, base + 0.012, IM.carpet, { level, int: 'carpet' });
    }
  });

  function roof(name, a, b, c, d, y, material, part, thickness = 0.12, slope = 0, fall = 0) {
    const g = new Geo();
    g.box(...point(a, y, c), ...point(b, y + thickness, d));
    for (let i = 0; i < g.p.length; i += 3) g.p[i + 1] += (g.p[i] + 4.4 - c) * slope + (g.p[i + 2] + 11.05 - a) * fall;
    roofs.push(mesh(name, material, part, undefined, undefined, g));
  }
  // Issue G elevations and sections show a shallow hip over a rectangular shell.
  const roofGeo = new Geo();
  const eave = 6.23;
  const ridge = 6.76;
  const a = point(-0.16, eave, -0.16);
  const b = point(-0.16, eave, 8.08);
  const c = point(22.21, eave, 8.08);
  const d = point(22.21, eave, -0.16);
  const r0 = point(3.96, ridge, 3.96);
  const r1 = point(18.09, ridge, 3.96);
  for (const face of [[a,b,r0], [b,c,r1,r0], [c,d,r1], [d,a,r0,r1]]) {
    let normal = Vector3.Cross(Vector3.FromArray(face[1]).subtract(Vector3.FromArray(face[0])),
      Vector3.FromArray(face[2]).subtract(Vector3.FromArray(face[0]))).normalize();
    if (normal.y < 0) normal = normal.scale(-1);
    roofGeo.poly(face, normal.asArray());
  }
  roofGeo.poly([a,d,c,b], [0,-1,0]);
  roofs.push(mesh('hip-roof', M.roof, 'roof', undefined, undefined, roofGeo));
  roof('roof-wall-closure', 0, 22.05, 0, 7.92, 5.71, M.cladding, 'cladding', 0.52);
  for (const [side,v] of [['left',-0.16],['right',7.96]]) {
    roof('fascia-' + side,-0.16,22.21,v,v+0.12,6.05,M.fascia,'fascia',0.17);
    const outer = side === 'left' ? v - 0.1 : v + 0.12;
    roof('gutter-' + side,-0.19,22.24,outer,outer+0.1,6.10,M.gutter,'gutter',0.1);
  }
  for (const [end,u] of [['front',-0.16],['rear',22.09]]) {
    roof('fascia-' + end,u,u+0.12,-0.04,7.96,6.05,M.fascia,'fascia',0.17);
    const outer = end === 'front' ? u - 0.1 : u + 0.12;
    roof('gutter-' + end,outer,outer+0.1,-0.16,8.08,6.10,M.gutter,'gutter',0.1);
  }
  roof('front-portal-header',-1.15,-0.04,-0.2,7.94,5.82,M.render,'render',0.35);
  roof('front-flashing',-1.17,-0.02,-0.22,7.96,6.17,M.flashing,'flashing',0.035);
  walls.push(box('front-left-portal-pier',-1.15,-0.97,-0.2,0.23,3.12,5.82,M.render,{ part:'render', level:1 }));
  walls.push(box('garage-right-portal-pier',-1.12,0,8.38,8.83,-0.35,2.79,M.render,{ part:'render' }));
  walls.push(box('garage-feature-face',-0.055,0,2.56,3.02,-0.35,2.74,IM.appBlack));
  walls.push(box('garage-feature-face-right',-0.055,0,8.08,8.38,-0.35,2.74,IM.appBlack));
  walls.push(box('garage-feature-lintel',-0.06,0,2.56,8.38,2.23,2.74,IM.appBlack));
  box('front-lower-portal',-1.15,-0.04,-0.2,8.83,2.76,3.12,M.render,{part:'render',level:1});
  box('garage-canopy-soffit',-1.1,0,2.56,8.45,2.72,2.76,IM.oakDark,{level:1});
  const timber = new Geo();
  for (let v = 0.32; v < 2.56; v += 0.115) {
    timber.box(...point(-1.045,3.12,v),...point(-0.95,5.81,v+0.052));
  }
  mesh('front-void-timber-screen',IM.oakDark,undefined,undefined,1,timber);
  const soffit = new Geo();
  soffit.box(...point(-1.10,5.78,0.22),...point(0,5.81,7.92));
  for (let u = -1.10; u < -0.035; u += 0.075) {
    soffit.box(...point(u,5.754,0.22),...point(u+0.048,5.78,7.92));
  }
  roofs.push(mesh('front-timber-soffit',IM.oakDark,undefined,undefined,undefined,soffit));
  box('front-downpipe',0.14,0.25,-0.10,0.02,0,6.11,M.downpipe,{part:'downpipe'});
  box('rear-downpipe',21.87,21.98,7.91,8.02,0,6.11,M.downpipe,{part:'downpipe'});
  const drive = new Geo();
  drive.box(...point(-6,-0.72,2.56),...point(0,-0.35,8.62));
  for (let i=0;i<drive.p.length;i+=3) drive.p[i+1] += (drive.p[i+2]+11.05)*0.047;
  mesh('garage-driveway',M.driveway,'driveway',undefined,undefined,drive);
  box('entry-approach',-2.25,-1.09,0.23,2.48,-0.22,-0.02,paving);
  box('dry-court',6.78,11.85,7.92,8.82,-0.18,-0.02,paving);
  for (let i=0;i<4;i++) box('dry-court-step-'+i,10.55,11.45,8.02+i*0.21,8.24+i*0.21,-0.4,-0.045-i*0.09,paving);
  roof('alfresco-cover',22.05,25.25,-0.05,7.97,2.88,canopy,undefined,0.10,0,-0.045);
  for (const [side,v] of [['left',0.13],['right',7.79]]) {
    box('alfresco-post-'+side,25.1,25.22,v-0.06,v+0.06,0,2.76,fixedMetal);
  }
  function guard(name,u0,u1,v0,v1,y,level,height=1.06) {
    box(name+'-glass',u0,u1,v0,v1,y+0.07,y+height,fixedGlass,{level});
    for (const [i,u,v] of [[0,u0,v0],[1,u1,v1]]) {
      box(name+'-fixing-'+i,u-0.025,u+0.025,v-0.025,v+0.025,y,y+0.23,IM.appBlack,{level});
    }
  }
  for (let i=0;i<5;i++) {
    const v=2.59+i*1.06;
    guard('balcony-panel-'+i,-1.065,-1.035,v,v+1.032,3.12,1);
  }
  guard('balcony-side-return',-1.06,0,7.87,7.9,3.12,1);
  guard('stair-guard',13.48,15.4,3.3,3.34,3.12,1);
  const gate=new Geo();
  for(let v=0.25;v<2.48;v+=0.10) gate.box(...point(-1.08,0,v),...point(-1.035,0.91,v+0.044));
  mesh('entry-batten-gate',IM.oakDark,undefined,undefined,0,gate);

  const water = new PBRMaterial('pool-water-preview',scene);
  water.albedoColor = Color3.FromHexString('#619eaf');
  water.roughness = 0.21;
  box('rear-pool-water',26.2,30.55,-0.84,2.14,-0.38,-0.13,water);
  for (const [name,u0,u1,v0,v1] of [
    ['near',25.97,26.2,-1.07,2.37], ['far',30.55,30.78,-1.07,2.37],
    ['left',26.2,30.55,-1.07,-0.84], ['right',26.2,30.55,2.14,2.37],
  ]) box('pool-coping-'+name,u0,u1,v0,v1,-0.22,0,paving);
  box('pool-approach',25.25,25.97,-1.07,3.13,-0.16,0,paving);
  box('pool-terrace',25.25,30.78,2.37,7.92,-0.16,0,paving);
  guard('pool-barrier',25.28,25.31,-1.04,2.99,0);
  guard('pool-side-barrier',25.31,30.79,2.37,2.41,0);
  guard('pool-rear-barrier',30.75,30.79,-1.07,2.41,0);

  for (let i=0;i<18;i++) {
    const u=13.47+(i<9?i:17-i)*0.181;
    const v=i<9?1.74:0.23;
    const y=(i+1)*3.12/18;
    box('stair-tread-'+(i+1),u,u+0.23,v,v+1.39,y-0.15,y,IM.oak,{level:0});
  }
  box('stair-landing',15.10,15.4,0.23,3.13,1.40,1.56,IM.oak,{level:0});
  for (const [name,u,v,w,d,level] of [
    ['study-bed',8.05,0.43,1.55,2.05,0], ['bed4',4.4,0.33,1.55,2.05,1],
    ['bed3',8.08,5.46,2.05,1.55,1], ['bed2',11.49,5.45,2.05,1.55,1],
    ['master-bed',17.28,0.29,1.88,2.08,1], ['living-sofa',16.56,1.92,3.3,0.89,0],
    ['media-sofa',0.57,2.78,3.1,0.84,1], ['dining-table',18.68,5.36,2.15,1.02,0],
    ['alfresco-table',23.08,3.28,1.0,1.9,0],
  ]) {
    const y=levels[level].base;
    box(name,u,u+w,v,v+d,y+0.12,y+0.48,IM.oak,{level});
    box(name+'-top',u+0.03,u+w-0.03,v+0.03,v+d-0.03,y+0.48,y+0.65,IM.fabricSofa,{level});
  }
  const fitout = createCampFitout({ scene, shadows, IM, S, point, doors: doorOpenings, windows });
  const glow = box('entry-light-preview', 3.81, 3.86, 2.05, 2.21, 2.1, 2.23, M.glassFrosted);
  glow.setEnabled(false);
  const lights = [[18.5, 2.4, 4.5], [11, 2.4, 5], [19.7, 5.35, 3], [3.2, 5.35, 3.8]].map(
    (p, i) => {
      const l = new PointLight('camp-hill-room-light-' + i, vec(...p), scene);
      l.diffuse = new Color3(1, 0.87, 0.72);
      l.intensity = 0.42;
      l.range = 8;
      return l;
    });
  function refreshCutaway() {
    roofs.forEach((m) => { m.isVisible = !inside; });
    floors[1].forEach((m) => { m.isVisible = !inside || floor === 1; });
    walls.forEach((m) => { m.visibility = inside ? 0.32 : 1; });
    fitout.showUpper(!inside || floor === 1);
  }
  const house = {
    entryOpening, glow, lightSpots: [[-3.2, 2.25, -7.3], [0, 2.23, 11]],
    anchors: {
      roof: vec(9,6.77,3.96), gutter: vec(3,6.2,-0.2), fascia: vec(1,6.12,8.11),
      downpipe: vec(0.14,1.6,-0.1), cladding: vec(0,5.32,7.78), flashing: vec(-1.1,6.22,3.96),
      render: vec(-1.16,4.47,0.02), bricks: vec(1.8,1.3,8.63), trim: vec(0,5.35,5.22),
      frame: vec(0,4.6,5.45), garage: vec(0,1.02,5.55), driveway: vec(-3,-0.5,5.55),
      entry: vec(3.8,1.45,1.25),
    },
    setTransparent(on) { inside = on; refreshCutaway(); },
    showFloor(level) { floor = level; refreshCutaway(); },
    getFloor() { return floor; },
    setWindowExtras(options) {
      for (const { slider, flyscreen, barrier, boutique } of extras) {
        flyscreen.setEnabled(options.flyscreen);
        barrier.setEnabled(options.barrier);
        boutique.setEnabled(options.boutique === 'both' || options.boutique === (slider ? 'slider' : 'window'));
      }
    },
    setInfill(kind) { if (infill) infill.material = kind === 'brick' ? M.bricks : M.cladding; },
  };
  let pending = Promise.resolve();
  const interior = {
    async buildAll(state) {
      for (const { key } of INTERIOR_CATEGORIES) S[key] = resolveAll(key, state[key] || {});
      await applyMaterials();
      fitout.rebuild();
      refreshCutaway();
    },
    apply(key, selection) {
      pending = pending.catch(console.error).then(async () => {
        S[key] = resolveAll(key, selection);
        await applyMaterials();
        fitout.rebuild(key);
        refreshCutaway();
      });
      return pending;
    },
    setMood(dusk) { lights.forEach((light) => { light.intensity = dusk ? 1.6 : 0.42; }); },
    setTransparent() {},
  };
  return { house, interior };
}


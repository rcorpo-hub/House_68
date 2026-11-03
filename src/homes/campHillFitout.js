import { Group, cylinder, place, roundedBox } from '../scene/interiorParts.js';
import { createCabinets } from '../scene/interior/cabinets.js';
import { createBath } from '../scene/interior/bath.js';
import { setFinish } from '../scene/interior/materials.js';
import { lin } from '../scene/interior/layout.js';
import { levels } from './campHillPlan.js';

// All fixture positions are Camp Hill plan stations. Shared fixture builders
// take world coordinates; the bathroom adapter adds the correct storey datum.
export function createCampFitout({ scene, shadows, IM, S, point, doors, windows }) {
  const groups = new Map();
  const ctx = { scene, IM, S, lin };
  Object.assign(ctx, createCabinets(ctx));
  const { cabinetRun, benchTop, sinkRect, sinkAt, mixerAt } = ctx;
  const { vanity, shower, bathTub, toiletAt, towelRail } = createBath(ctx);
  const mats = {
    ...IM,
    doorLever: IM.handle.clone('camp-door-lever'),
    fixedLever: IM.handle.clone('camp-service-lever'),
    doorStop: IM.woodwork.clone('camp-door-stop'),
    vanityHandle: IM.handle.clone('camp-vanity-handle'),
    flush: IM.acc.clone('camp-flush'),
    basinWaste: IM.acc.clone('camp-basin-waste'),
    laundryMixer: IM.mixer.clone('camp-laundry-mixer'),
    curtainTrack: IM.acc.clone('camp-curtain-track'),
    laundryStone: IM.vStone.clone('camp-laundry-stone'),
  };

  function build(name, level, draw) {
    groups.get(name)?.group.dispose();
    const group = new Group(scene, mats, shadows, 'camp-' + name);
    const y = levels[level].base;
    const g = {
      box(key, x0, y0, z0, x1, y1, z1, opts) {
        group.box(key, x0, y0 + y, z0, x1, y1 + y, z1, opts);
      },
      add(mesh, key) {
        mesh.position.y += y;
        return group.add(mesh, key);
      },
    };
    draw(g);
    group.finish({ shadowCast: true });
    const offset = name === 'kitchen' ? [-0.9, -0.24] : name === 'laundry' ? [-1.03, -3.62] : null;
    if (offset) for (const mesh of group.meshes) {
      mesh.unfreezeWorldMatrix();
      mesh.position.x += offset[0];
      mesh.position.z += offset[1];
      mesh.freezeWorldMatrix();
    }
    groups.set(name, { group, level });
  }

  function target(g, category, remap = {}) {
    const key = (material) => (remap[material] || material) + '#' + category;
    return {
      box(material, ...args) { g.box(key(material), ...args); },
      add(mesh, material) { return g.add(mesh, key(material)); },
    };
  }

  function box(g, mat, u, v, w, d, y, h) {
    g.box(mat, ...point(u, y, v), ...point(u + w, y + h, v + d));
  }

  function kitchen() {
    build('kitchen', 0, (g) => {
      const cabinet = S['k-cabinets'];
      const handle = S['k-handles']?.handle;
      const style = S['k-benchtop']?.style;
      const stone = style?.thick ?? 0.02;
      const sink = S['k-sink']?.sink || {};
      const cook = S['k-cooking'];
      const appliances = S['k-appliances'];
      const free = cook?.setup?.id === 'cs-freestanding';
      const cabinets = {
        box(mat, ...args) { g.box(mat + '#' + (mat === 'handle' ? 'k-handles' : 'k-cabinets'), ...args); },
      };
      function run(key, u0, u1, v0, v1, opts = {}) {
        cabinetRun(cabinets, key, {
          x0: v0 - 4.4, x1: v1 - 4.4, z0: u0 - 11.05, z1: u1 - 11.05,
          face: 'x-', profile: cabinet?.profile, handle, ...opts,
        });
      }
      const stoneGroup = target(g, 'k-benchtop');
      const sinkGroup = target(g, 'k-sink');
      const [sx, , sz] = point(15.2, 0, 8.33);
      const hole = sinkRect(sink, sx, sz, 'x');
      run('kIsland', 15.4, 18.45, 5.6, 6.54, { drawers: true });
      if (style?.curved) {
        const top = roundedBox(scene, 0.99, stone, 3.1, 0.085);
        const [x, y, z] = point(16.925, 0.9 + stone / 2, 6.07);
        stoneGroup.add(place(top, x, y, z), 'kStone');
      } else {
        box(stoneGroup, 'kStone', 15.375, 5.575, 3.1, 0.99, 0.9, stone);
      }
      if (style?.waterfall) {
        for (const u of [15.375, 18.475 - stone]) box(stoneGroup, 'kStone', u, 5.575, stone, 0.99, 0, 0.9);
      }
      if (style?.id === 'bs-20-wf') box(stoneGroup, 'kick', 15.4, 5.585, 3.05, 0.018, 0.872, 0.028);

      run('kCab', 12.12, 13.99, 8.03, 8.63);
      run('kCab', 14.05, 14.68, 8.03, 8.63);
      // Leave the sink bowl and dishwasher bay physically clear.
      run('kCab', 14.68, 15.76, 8.03, 8.63, { y1: 0.68 });
      box(target(g, 'k-cabinets'), 'kCab', 14.69, 8.014, 1.06, 0.016, 0.68, 0.22);
      if (appliances?.dishwasher?.kind !== 'none') {
        const kind = appliances?.dishwasher?.kind;
        box(target(g, 'k-appliances'), kind === 'integrated' ? 'kCab' : kind === 'black' ? 'appBlack' : 'appSS',
          15.77, 8.025, 0.59, 0.58, 0.09, 0.79);
      }
      run('kCab', 16.38, 17.38, 8.03, 8.63, { drawers: true });
      run('kCab', free ? 18.31 : 17.38, 19.02, 8.12, 8.63, { y1: free ? 0.9 : 0.71 });
      benchTop(stoneGroup, 'kStone', 8.0 - 4.4, 0.9, 14.04 - 11.05,
        8.65 - 4.4, 0.9 + stone, (free ? 17.38 : 19.02) - 11.05, hole);
      if (free) box(stoneGroup, 'kStone', 18.31, 8.0, 0.71, 0.65, 0.9, stone);
      box(stoneGroup, 'kStone', 12.11, 8.0, 1.88, 0.65, 0.9, stone);
      sinkAt(sinkGroup, sx, sz, sink, stone, 'x');
      mixerAt(sinkGroup, sx - 0.23, sz, S['k-sink']?.mixer || {}, 0.9 + stone);
      const accessory = S['k-sink']?.accessory?.id;
      if (accessory && accessory !== 'sa-none') {
        const a = target(g, 'k-sink');
        if (accessory === 'sa-basket') {
          for (let i = 0; i < 7; i++) box(a, 'sink', 14.89 + i * 0.045, 8.12, 0.01, 0.4, 0.9 + stone, 0.04);
        } else {
          box(a, accessory === 'sa-board' ? 'oak' : 'sink', 14.89, 8.12, 0.28, 0.4, 0.9 + stone, 0.024);
        }
      }

      const cooking = target(g, 'k-cooking');
      const cooktop = cook?.cooktop;
      if (free) {
        box(cooking, 'cooker', 17.39, 8.0, 0.9, 0.63, 0.06, 0.84);
        box(cooking, 'appGlass', 17.46, 7.982, 0.76, 0.025, 0.37, 0.34);
      } else {
        const oven = cook?.oven;
        const w = oven?.w || 0.6;
        box(cooking, oven?.face === 'stainless' ? 'appSS' : 'appBlack',
          17.84 - w / 2, 7.99, w, 0.095, 0.19, 0.56);
        box(cooking, 'appGlass', 17.89 - w / 2, 7.98, w - 0.1, 0.016, 0.27, 0.35);
      }
      const cw = cooktop?.w || 0.9;
      const cy = 0.9 + (free ? 0 : stone);
      box(cooking, 'appGlass', 17.84 - cw / 2, 8.09, cw, 0.46, cy, 0.026);
      for (const [du, dv] of [[-0.18, -0.1], [0.18, -0.1], [-0.18, 0.1], [0.18, 0.1]]) {
        const [x, y, z] = point(17.84 + du, cy + 0.03, 8.32 + dv);
        const gas = free || cooktop?.kind === 'gas';
        const diameter = gas ? 0.12 : cooktop?.kind === 'induction' ? 0.15 : 0.17;
        cooking.add(place(cylinder(scene, gas ? 0.027 : 0.004, diameter, diameter), x, y, z),
          gas || cooktop?.kind === 'induction' ? 'appBlack' : 'appSS');
      }
      const hood = cook?.rangehood;
      const hw = hood?.w || 0.6;
      const hoodMat = hood?.dark ? 'appBlack' : 'appSS';
      box(cooking, hoodMat, 17.84 - hw / 2, hood?.kind === 'concealed' ? 8.29 : 8.12, hw, 0.45, 1.65,
        hood?.kind === 'canopy' ? 0.14 : 0.07);
      if (hood?.kind === 'canopy') box(cooking, hoodMat, 17.68, 8.37, 0.32, 0.22, 1.78, 0.52);
      if (hood?.kind === 'slideout') box(cooking, hoodMat, 17.84 - hw / 2, 8.03, hw, 0.13, 1.65, 0.035);

      const overhead = cabinet?.overheads?.kind;
      if (overhead === 'open') {
        for (const y of [1.58, 1.96]) box(target(g, 'k-cabinets'), 'kOver', 18.43, 8.3, 1.15, 0.32, y, 0.033);
      } else {
        run('kOver', 18.43, overhead === 'two' ? 19.51 : 20.02, 8.29, 8.63, { y0: 1.57, y1: 2.25 });
      }
      const appliance = target(g, 'k-appliances');
      if (appliances?.fridge?.kind === 'integrated') box(appliance, 'kCab', 13.03, 6.04, 0.72, 0.64, 0.08, 1.83);
      if (appliances?.microwave?.kind === 'builtin') {
        box(appliance, 'appSS', 13.81, 6.07, 0.59, 0.49, 1.24, 0.38);
        box(appliance, 'appGlass', 13.84, 6.04, 0.52, 0.04, 1.29, 0.27);
      }
    });
  }

  function bathrooms() {
    setFinish(mats.vanityHandle, S['b-vanity']?.handle?.finish);
    setFinish(mats.basinWaste, S['b-basin']?.waste?.finish);
    setFinish(mats.flush, S['b-toilet']?.button?.finish);
    const stoneT = S['b-benchtop']?.edge?.thick ?? 0.02;
    for (const room of [
      { name: 'guest-bath', level: 0, vanity: [9.44, 5.33, 6.49], shower: [10.77, 6.8, 7.73], wc: [11.35, 6.12] },
      { name: 'upper-bath', level: 1, vanity: [11.92, 1.85, 3.16], shower: [11.95, 0.19, 1.22], wc: [9.88, 0.47] },
      { name: 'ensuite', level: 1, vanity: [18.64, 4.72, 6.11], shower: [21.0, 6.94, 7.73], wc: [21.57, 5.9] },
    ]) {
      build(room.name, room.level, (g) => {
        const map = {
          vCab: 'b-vanity', handle: 'b-vanity', vStone: 'b-benchtop',
          basin: 'b-basin', mixer: 'b-basin', tap: 'b-basin', mirror: 'b-accessories',
        };
        const mapped = (mat, isWaste = false) => (
          (mat === 'handle' ? 'vanityHandle' : mat === 'mixer' ? 'tap' : isWaste ? 'basinWaste' : mat) +
          '#' + (map[mat] || 'b-vanity')
        );
        const vg = {
          box(mat, ...args) { g.box(mapped(mat), ...args); },
          add(mesh, mat) {
            return g.add(mesh, mapped(mat, mat === 'tap' && mesh.position.y < 1));
          },
        };
        const [u, a, b] = room.vanity;
        vanity(vg, { x0: a - 4.4, x1: b - 4.4, zWall: u - 11.05, dir: 1, stoneT });
        const [su, va, vb] = room.shower;
        const [x0, , z0] = point(su, 0, va);
        const [x1, , z1] = point(su + 0.91, 0, vb);
        const showerGroup = target(g, 'b-shower');
        const waste = S['b-shower']?.waste?.id;
        shower({
          ...showerGroup,
          box(mat, a, y0, c, b, y1, d) {
            showerGroup.box(mat === 'shower' && y1 < 0.05 && waste === 'fwz-tile' ? 'wetTile' : mat,
              a, y0, c, b, y1, d);
          },
        }, { x0, x1, z0, z1, head: S['b-shower']?.[room.name === 'ensuite' ? 'ensuite' : 'main'] });
        if (room.name === 'ensuite') {
          const [bx, , bz] = point(19.85, 0, 6.53);
          bathTub(target(g, 'b-bath'), S['b-bath']?.bath, bx, bz, S['b-bath']?.tap,
            { axis: 'z', w: 0.8, max: 1.72 });
        }
        const [wu, wv] = room.wc;
        toiletAt(target(g, 'b-toilet', { acc: 'flush' }), wu - 11.05, wv - 4.4, 1, S['b-toilet'], 'z');
        towelRail(target(g, 'b-accessories'), 'x', b - 4.22, u - 11.05, 1, S['b-accessories']);
      });
    }
  }

  function laundry() {
    build('laundry', 0, (group) => {
      const g = target(group, 'laundry', { mixer: 'laundryMixer' });
      const sel = S.laundry;
      const width = sel?.bench?.top === 'stone' ? 1.36 : 0.76;
      const [x, , z] = point(10.58 + width / 2, 0, 8.35);
      const tub = { bowls: 1, w: 0.48, mount: 'inset', mat: 'stainless' };
      const tubGroup = target(group, 'laundry', { sink: 'tub', mixer: 'laundryMixer' });
      box(g, 'mel', 10.58, 8.07, width, 0.56, 0.1, 0.59);
      box(g, 'mel', 10.58, 8.045, width, 0.024, 0.1, 0.8);
      benchTop(g, sel?.bench?.top === 'stone' ? 'laundryStone' : 'mel', 8.05 - 4.4, 0.9, 10.58 - 11.05, 8.64 - 4.4, 0.92, 10.58 + width - 11.05,
        sinkRect(tub, x, z, 'x'));
      sinkAt(tubGroup, x, z, tub, 0.02, 'x');
      setFinish(mats.laundryMixer, sel?.mixer?.finish);
      mixerAt(g, x + 0.25, z, { shape: 'gooseneck' }, 0.92);
      if (sel?.extras?.extras === 'overhead') box(g, 'mel', 10.58, 8.3, width, 0.33, 1.58, 0.63);
      if (sel?.extras?.extras === 'shelves') {
        for (const y of [1.6, 1.96]) box(g, 'mel', 10.58, 8.29, width, 0.34, y, 0.035);
      }
    });
  }

  function openings() {
    setFinish(mats.doorLever, S.handles?.finish?.finish);
    mats.curtainTrack.albedoColor = lin(S['window-furnishings']?.track?.hex || '#f2efea');
    levels.forEach((_, level) => build('openings-' + level, level, (g) => {
      for (const op of doors.filter((door) => door.level === level)) {
        const { wall, a, b, hi, external, name } = op;
        const style = external ? 'flush' : S.doors?.style?.panels || 'flush';
        const tag = external ? 'paint' : 'doors';
        // The plan uses swing doors. Display the leaf ajar for the cutaway.
        const hingeAtEnd = ['bath-hall', 'bed3-hall', 'bed2-hall', 'master-front', 'garage-hall'].includes(name);
        const hinge = hingeAtEnd ? b - 0.018 : a + 0.018;
        const sign = hingeAtEnd ? -1 : 1;
        const angle = external ? 0 : Math.PI / 2;
        const w = b - a - 0.035;
        const leaf = (mat, s0, s1, y0, y1, d0, d1, category = tag) => {
          const p = wall.world(hinge + sign * (s0 * Math.cos(angle) - d0 * Math.sin(angle)), y0,
            -0.045 + s0 * Math.sin(angle) + d0 * Math.cos(angle));
          const q = wall.world(hinge + sign * (s1 * Math.cos(angle) - d1 * Math.sin(angle)), y1,
            -0.045 + s1 * Math.sin(angle) + d1 * Math.cos(angle));
          g.box(mat + '#' + category, p[0], y0, p[2], q[0], y1, q[2]);
        };
        if (style === 'glazed') {
          leaf('woodwork', 0, 0.085, 0.02, hi, -0.02, 0.02);
          leaf('woodwork', w - 0.085, w, 0.02, hi, -0.02, 0.02);
          leaf('woodwork', 0.085, w - 0.085, 0.02, 0.18, -0.02, 0.02);
          leaf('woodwork', 0.085, w - 0.085, hi - 0.12, hi, -0.02, 0.02);
          leaf('glassFrosted', 0.085, w - 0.085, 0.18, hi - 0.12, -0.008, 0.008);
        } else {
          leaf('woodwork', 0, w, 0.02, hi - 0.01, -0.02, 0.02);
          if (['groove', 'barn'].includes(style)) {
            for (let s = 0.08; s < w - 0.04; s += 0.11) leaf('woodwork', s, s + 0.009, 0.06, hi - 0.07, 0.02, 0.027);
          } else if (['shaker', 'settler', 'panel'].includes(style)) {
            const rows = style === 'shaker' ? 2 : 3;
            for (let i = 0; i < rows; i++) {
              leaf('woodwork', 0.1, w - 0.1, 0.13 + i * 1.89 / rows, (i + 1) * 1.89 / rows, 0.02, 0.028);
            }
          }
        }
        const square = !external && ['dh-sierra', 'dh-rivera', 'dh-alba'].includes(S.handles?.lever?.id);
        leaf(external ? 'fixedLever' : 'doorLever', w - 0.12, w - 0.057, 0.99, 1.05, 0.02, 0.039, external ? 'paint' : 'handles');
        leaf(external ? 'fixedLever' : 'doorLever', w - (square ? 0.23 : 0.19), w - 0.07, 1.012, 1.029, 0.039, 0.068, external ? 'paint' : 'handles');
        if (!external) {
          const stop = S.doors?.stop?.id;
          const stopMaterial = stop === 'ds-cushion' ? 'doorStop' : 'appSS';
          leaf(stopMaterial, 0.12, 0.17, 0.021, stop === 'ds-magnetic' ? 0.067 : 0.046,
            -0.02, stop === 'ds-tube' ? -0.1 : -0.062);
        }
      }

      const furnishing = S['window-furnishings'];
      const kind = furnishing?.type?.kind;
      if (!kind) return;
      for (const { wall, a, b, lo, hi, slider } of windows.filter((op) => op.level === level)) {
        if (slider && kind === 'shutter') continue;
        const put = (mat, s0, s1, y0, y1, d0, d1) => {
          const p = wall.world(s0, y0, d0);
          const q = wall.world(s1, y1, d1);
          g.box(mat + '#window-furnishings', p[0], y0, p[2], q[0], y1, q[2]);
        };
        if (kind === 'roller') {
          const face = furnishing?.fitting?.id !== 'wr-reveal';
          put('blind', a - (face ? 0.08 : 0), b + (face ? 0.08 : 0), lo + (hi - lo) * 0.46,
            hi + (face ? 0.08 : 0), -0.21, -0.225);
        } else if (kind === 'shutter') {
          for (let y = lo + 0.035; y < hi - 0.04; y += 0.073) put('shutter', a, b, y, y + 0.027, -0.19, -0.24);
        } else {
          put('curtainTrack', a - 0.05, b + 0.05, hi + 0.06, hi + 0.085, -0.23, -0.28);
          for (let i = 0; i < 10; i++) {
            const s = i < 5 ? a + i * 0.048 : b - (10 - i) * 0.048;
            put('curtain', s, s + 0.055, Math.max(0.02, lo - 0.1), hi + 0.06, -0.23 - i % 2 * 0.026, -0.295);
          }
        }
      }
    }));
  }

  function finishes() {
    levels.forEach(({ height, partitions }, level) => build('finishes-' + level, level, (g) => {
      const trim = S.trims;
      const sk = trim?.skirting?.profile;
      const co = trim?.cornice;
      const trims = target(g, 'trims');
      for (const [, a, b, c, d, door] of partitions) {
        const length = Math.hypot(c - a, d - b);
        const ranges = door ? [[0, door[0]], [door[1], length]] : [[0, length]];
        for (const [start, end] of ranges) {
          for (const side of [-1, 1]) {
            const u = (t) => a + (c - a) * t / length - (d - b) * 0.05 * side / length;
            const v = (t) => b + (d - b) * t / length + (c - a) * 0.05 * side / length;
            const rail = (y, h, thick) => {
              trims.box('woodwork', ...point(u(start) - thick, y, v(start) - thick),
                ...point(u(end) + thick, y + h, v(end) + thick));
            };
            rail(0.014, sk === 'bevel' ? 0.082 : 0.062, 0.012);
            if (sk !== 'bevel') rail(0.076, sk === 'round' ? 0.015 : 0.008, sk === 'round' ? 0.012 : 0.006);
            if (co?.size) {
              rail(height - co.size, co.size, co.profile === 'cove' ? 0.026 : 0.043);
              if (co.profile !== 'cove') rail(height - co.size - 0.014, 0.016, co.profile === 'step' ? 0.029 : 0.02);
            }
          }
        }
      }
      for (const { wall, a, b, hi } of doors.filter((door) => door.level === level && !door.external)) {
        const width = sk === 'bevel' ? 0.052 : sk === 'round' ? 0.036 : 0.043;
        for (const face of [-0.105, 0.015]) {
          const edge = (s0, s1, y0, y1) => {
            const p = wall.world(s0, y0, face);
            const q = wall.world(s1, y1, face - 0.014);
            trims.box('woodwork', p[0], y0, p[2], q[0], y1, q[2]);
          };
          edge(a - width, a, 0.02, hi + width);
          edge(b, b + width, 0.02, hi + width);
          edge(a, b, hi, hi + width);
        }
      }
      if (level === 0) {
        const f = target(g, 'feature');
        const style = S.feature?.type?.id;
        if (style === 'fw-hardigroove') {
          for (let u = 18.23; u < 21.71; u += 0.11) box(f, 'feature', u, 0.182, 0.097, 0.018, 0.09, 2.55);
        } else if (style === 'fw-dado') {
          box(f, 'feature', 18.2, 0.182, 3.55, 0.028, 0.08, 1);
          box(f, 'woodwork', 18.2, 0.182, 3.55, 0.045, 1.08, 0.056);
        }
      }
    }));
  }

  function robes() {
    build('robes', 1, (group) => {
      const g = target(group, 'robes');
      const layout = S.robes?.fitout?.fitout;
      const material = S.robes?.door?.style === 'painted' ? 'woodwork' : 'robeDoor';
      for (const [u, v, w, d, walkIn] of [
        [6.86, 4.91, 0.57, 2.81, false], [14.79, 4.92, 0.53, 2.8, false],
        [7.76, 0.19, 1.46, 0.54, true], [15.54, 7.17, 2.81, 0.54, true],
      ]) {
        box(g, 'mel', u, v, w, d, 1.79, 0.034);
        box(g, 'appSS', u + 0.09, v + 0.06, w - 0.18, d - 0.12, 1.64, 0.023);
        if (!walkIn) box(g, material, u + w - 0.035, v, 0.03, d * 0.55, 0.04, 2.1);
        if (layout === 'towers' || layout === 'custom') {
          const board = layout === 'custom' ? 'oak' : 'mel';
          const depth = Math.min(d, 0.62);
          for (const y of [0.4, 0.73, 1.06, 1.39]) box(g, board, u, v, w, depth, y, 0.026);
          if (layout === 'custom') box(g, board, u, v, w, 0.028, 0.08, 0.61);
        }
      }
    });
  }

  const builders = { kitchen, bathrooms, laundry, openings, finishes, robes };
  function rebuild(category) {
    if (!category) Object.values(builders).forEach((draw) => draw());
    else if (category.startsWith('k-')) kitchen();
    else if (category.startsWith('b-')) bathrooms();
    else if (category === 'laundry') laundry();
    else if (['doors', 'handles', 'window-furnishings'].includes(category)) openings();
    else if (['feature', 'trims'].includes(category)) finishes();
    else if (category === 'robes') robes();
  }

  return {
    rebuild,
    showUpper(on) {
      for (const { group, level } of groups.values()) {
        if (level === 1) group.meshes.forEach((mesh) => { mesh.isVisible = on; });
      }
    },
  };
}

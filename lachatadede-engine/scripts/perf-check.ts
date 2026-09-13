import { Simulation } from '../src/engine/Simulation.js';
import type { SimulatePayload } from '../src/engine/types.js';

const payload: SimulatePayload = {
  match_id: 'perf-check',
  seed: 42,
  output_path: '/tmp',
  challenger: {
    players: [1, 2, 3, 4, 5].map((s) => ({ slot: s, x: s * 5, y: 25, script: '' })),
  },
  opponent: {
    players: [1, 2, 3, 4, 5].map((s) => ({ slot: s, x: 100 - s * 5, y: 25, script: '' })),
  },
};

const t0 = performance.now();
const file = await new Simulation(payload).run();
const elapsed = performance.now() - t0;
const json = JSON.stringify(file);
console.log('elapsed ms:', elapsed.toFixed(1));
console.log('frames:', file.total_frames);
console.log('json size MB:', (json.length / 1024 / 1024).toFixed(2));

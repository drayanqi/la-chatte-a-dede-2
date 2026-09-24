/**
 * Standalone docs viewer (Epic 8.2): mounts the REAL TacticsCanvas, loads a
 * situation frame file from docs/scripting/frames and exposes a seek hook so
 * the render spec can screenshot the canvas frame by frame.
 *
 * URL: /scripts/action-docs/viewer.html?situation=move-toward&frame=0
 */
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { TacticsCanvas, type TacticsCanvasHandle } from '@/components/canvas/TacticsCanvas';
import type { MatchFrame } from '@/types';

declare global {
  interface Window {
    __docReady?: boolean;
    __docSeek?: (frame: number) => void;
  }
}

const params = new URLSearchParams(window.location.search);
const situation = params.get('situation') ?? 'move-toward';
const targetFrame = Number(params.get('frame') ?? '0');

async function main(): Promise<void> {
  const res = await fetch(`/docs/scripting/frames/${situation}.json`);
  if (!res.ok) {
    throw new Error(`frames not found for situation "${situation}"`);
  }
  const file = (await res.json()) as { frames: MatchFrame[] };

  const container = document.createElement('div');
  container.style.width = '720px';
  container.style.height = '360px';
  document.body.appendChild(container);

  let handle: TacticsCanvasHandle | null = null;
  const el = createElement(TacticsCanvas, {
    ref: (h: TacticsCanvasHandle | null) => {
      handle = h;
    },
    onFrameChanged: () => {
      if (window.__docReady) return;
      window.__docReady = true;
      window.__docSeek?.(targetFrame);
    },
  });
  createRoot(container).render(el);

  // React commits asynchronously; wait for the imperative handle before
  // feeding frames (the engine queues them pre-init anyway).
  for (let i = 0; i < 200; i++) {
    if (handle) break;
    await new Promise((r) => setTimeout(r, 10));
  }
  if (!handle) throw new Error('TacticsCanvas handle never appeared');
  handle.loadFrames(file.frames);

  window.__docSeek = (frame: number) => {
    handle?.pause();
    handle?.seekFrame(frame);
  };
}

void main();

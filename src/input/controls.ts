import type { FaceZones } from './zones';

export type ControlsMode = 'none' | 'edges' | 'buttons' | 'both';

export interface ControlsHandlers {
  onEdgeClick: (visibleEdgeIndex: number) => void;
}

/**
 * Build per-edge UI controls (chevron buttons) or a button panel.
 * The controls are positioned over the active face zones.
 *
 * Returns a cleanup function.
 */
export function buildControls(
  controlsRoot: HTMLElement,
  getZones: () => FaceZones,
  getActiveFaceRect: () => { left: number; top: number; width: number; height: number },
  mode: ControlsMode,
  handlers: ControlsHandlers,
): () => void {
  controlsRoot.innerHTML = '';
  if (mode === 'none') return () => {};

  const buttons: HTMLButtonElement[] = [];

  function rebuild() {
    controlsRoot.innerHTML = '';
    buttons.length = 0;
    const zones = getZones();
    const rect = getActiveFaceRect();

    if (mode === 'edges' || mode === 'both') {
      // For each edge zone, place a chevron at the midpoint of the edge.
      for (let i = 0; i < zones.edgeZones.length; i++) {
        const tri = zones.edgeZones[i]!;
        const a = tri[1]!;
        const b = tri[2]!;
        const mx = (a[0] + b[0]) / 2;
        const my = (a[1] + b[1]) / 2;
        // Convert from face-local (centered) to controls-root coords.
        const cx = rect.left + rect.width / 2 + mx;
        const cy = rect.top + rect.height / 2 + my;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `pf-control pf-control--edge-${i}`;
        btn.setAttribute('aria-label', `Navigate via edge ${i + 1}`);
        btn.style.left = `${cx}px`;
        btn.style.top = `${cy}px`;
        const chev = document.createElement('span');
        chev.className = 'pf-control__chevron';
        // Rotate chevron toward the outward direction.
        const angle = Math.atan2(my, mx) * (180 / Math.PI);
        chev.style.transform = `rotate(${angle - 45}deg)`;
        btn.appendChild(chev);
        btn.addEventListener('click', () => handlers.onEdgeClick(i));
        controlsRoot.appendChild(btn);
        buttons.push(btn);
      }
    }
    if (mode === 'buttons' || mode === 'both') {
      // Disposed in a small panel along the bottom-center.
      const panel = document.createElement('div');
      panel.className = 'pf-control-panel';
      panel.style.position = 'absolute';
      panel.style.left = '50%';
      panel.style.bottom = '12px';
      panel.style.transform = 'translateX(-50%)';
      panel.style.display = 'flex';
      panel.style.gap = '6px';
      panel.style.pointerEvents = 'auto';
      for (let i = 0; i < zones.edgeZones.length; i++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `pf-control pf-control--button pf-control--edge-${i}`;
        btn.style.position = 'static';
        btn.style.transform = 'none';
        btn.textContent = String(i + 1);
        btn.setAttribute('aria-label', `Navigate via edge ${i + 1}`);
        btn.addEventListener('click', () => handlers.onEdgeClick(i));
        panel.appendChild(btn);
        buttons.push(btn);
      }
      controlsRoot.appendChild(panel);
    }
  }

  rebuild();

  return () => {
    controlsRoot.innerHTML = '';
    buttons.length = 0;
  };
}

import type { CarrierImage } from '@ombrix/stego-interface';
import type { ImageHistogram } from './types.js';

export function computeHistogram(carrier: CarrierImage): ImageHistogram {
  const r = new Uint32Array(256);
  const g = new Uint32Array(256);
  const b = new Uint32Array(256);
  const a = new Uint32Array(256);
  const luminance = new Uint32Array(256);

  const data = carrier.data;
  const len = data.length;

  for (let i = 0; i < len; i += 4) {
    const red = data[i] ?? 0;
    const green = data[i + 1] ?? 0;
    const blue = data[i + 2] ?? 0;
    const alpha = data[i + 3] ?? 0;

    r[red] = (r[red] ?? 0) + 1;
    g[green] = (g[green] ?? 0) + 1;
    b[blue] = (b[blue] ?? 0) + 1;
    a[alpha] = (a[alpha] ?? 0) + 1;

    // ITU-R BT.601 standard luminance calculation
    const lum = Math.min(255, Math.max(0, Math.round(0.299 * red + 0.587 * green + 0.114 * blue)));
    luminance[lum] = (luminance[lum] ?? 0) + 1;
  }

  return { r, g, b, a, luminance };
}

import { Chart } from 'chart.js/auto';
import { createIcons } from 'lucide';
import { icons } from './icons.js';

export function installLocalVisualLibraries(target = globalThis) {
  target.Chart = Chart;
  target.lucide = {
    ...(target.lucide || {}),
    icons,
    createIcons(options = {}) {
      const normalizedOptions = options && typeof options === 'object' ? options : {};
      return createIcons({ ...normalizedOptions, icons: normalizedOptions.icons || icons });
    }
  };

  return {
    Chart: target.Chart,
    lucide: target.lucide
  };
}

export { Chart, createIcons, icons };

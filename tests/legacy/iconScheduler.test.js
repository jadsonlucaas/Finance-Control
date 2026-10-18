import { describe, expect, it } from 'vitest';
import { installLucideIconScheduler } from '../../src/legacy/iconScheduler.js';

describe('iconScheduler', () => {
  it('coalesces empty lucide.createIcons calls into one animation frame', () => {
    const calls = [];
    const frames = [];
    const target = {
      lucide: {
        createIcons(...args) {
          calls.push(args);
        }
      },
      requestAnimationFrame(callback) {
        frames.push(callback);
        return frames.length;
      }
    };

    expect(installLucideIconScheduler(target)).toBe(true);
    target.lucide.createIcons();
    target.lucide.createIcons();

    expect(calls).toEqual([]);
    expect(frames).toHaveLength(1);

    frames[0]();
    expect(calls).toEqual([[]]);
  });

  it('keeps explicit lucide.createIcons arguments synchronous', () => {
    const calls = [];
    const target = {
      lucide: {
        createIcons(...args) {
          calls.push(args);
        }
      },
      requestAnimationFrame() {
        throw new Error('requestAnimationFrame should not run for explicit arguments');
      }
    };

    installLucideIconScheduler(target);
    target.lucide.createIcons({ attrs: { class: 'icon' } });

    expect(calls).toEqual([[{ attrs: { class: 'icon' } }]]);
  });
});

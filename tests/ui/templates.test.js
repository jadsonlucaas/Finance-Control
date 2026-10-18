import { describe, expect, it } from 'vitest';
import { authTemplate } from '../../src/ui/templates/authTemplate.js';
import { installInitialTemplates } from '../../src/ui/templates/installInitialTemplates.js';

describe('initial UI templates', () => {
  it('keeps auth template IDs used by legacy event bindings', () => {
    const html = authTemplate();

    expect(html).toContain('id="auth-screen"');
    expect(html).toContain('id="auth-form"');
    expect(html).toContain('id="auth-toggle-button"');
    expect(html).toContain('id="auth-submit"');
  });

  it('mounts the auth template into auth-root once', () => {
    const authRoot = { innerHTML: '' };
    const target = {
      getElementById(id) {
        if (id === 'auth-root') return authRoot;
        if (id === 'auth-screen') return null;
        return null;
      }
    };

    installInitialTemplates(target);

    expect(authRoot.innerHTML).toContain('id="auth-screen"');
  });
});

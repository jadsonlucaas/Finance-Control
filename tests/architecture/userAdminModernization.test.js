import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const modernFiles = [
  'src/application/readModels/userAdminReadModel.js',
  'src/application/userAdmin/userAdminPermissions.js',
  'src/ui/admin/userAdminController.js',
  'src/ui/admin/userAdminPresenter.js',
  'src/ui/admin/userAdminActiveUi.js',
  'src/ui/admin/loadUserAdminActiveUi.js'
];

describe('user admin modernization architecture', () => {
  it('mantem UI moderna sem Firebase direto nem regras financeiras', () => {
    for (const file of modernFiles) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(/firebase\/|from ['"]firebase/);
      expect(source, file).not.toMatch(/CalculateINSS|CalculateIRRF|calcularINSS|calcularIRRF/);
      expect(source, file).not.toMatch(/WhatsApp|webhook|telefone|phone|firebase-admin/i);
    }
  });

  it('carrega admin pelo caminho lazy de configuracoes sem import estatico no bootstrap', () => {
    const app = readFileSync('src/app.js', 'utf8');
    const loader = readFileSync('src/ui/settings/loadSettingsActiveUi.js', 'utf8');

    expect(app).not.toMatch(/userAdminActiveUi|loadUserAdminActiveUi/);
    expect(loader).toContain("import('../admin/loadUserAdminActiveUi.js')");
  });
});


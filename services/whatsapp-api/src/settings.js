import { readFileSync } from 'node:fs';

/**
 * Le uma configuracao da variavel NAME ou, se ausente, do arquivo em NAME_FILE.
 * O formato *_FILE permite usar Docker Swarm secrets (/run/secrets/...).
 */
export function readSetting(name, { env = process.env, readFile = (path) => readFileSync(path, 'utf8') } = {}) {
  const direct = env[name];
  if (direct && direct.trim()) return direct.trim();
  const filePath = env[`${name}_FILE`];
  if (filePath && filePath.trim()) {
    let content;
    try {
      content = readFile(filePath.trim());
    } catch {
      throw new Error(`Nao foi possivel ler ${name}_FILE.`);
    }
    if (!content || !String(content).trim()) throw new Error(`${name}_FILE esta vazio.`);
    return String(content).trim();
  }
  return '';
}

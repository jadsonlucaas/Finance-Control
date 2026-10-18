import { classifyFinanceRecordAuditAction, summarizeFinanceRecord } from './audit/financeRecordAudit.js';
import { normalizeFinanceRecord } from './normalizers/financeRecordNormalizer.js';

/**
 * @typedef {Object} FinanceRecord
 * @property {string} [id]
 * @property {'saida'|'entrada'|'pessoa'|'categoria'|'macro'|'controle_horas'|'salario_historico'|'percentage_rule'|string} type
 * @property {string} [person]
 * @property {number} [amount]
 * @property {string} [competence]
 * @property {boolean} [archived]
 * @property {string} [created_at]
 */

/**
 * Repository layer to abstract data operations from the UI.
 * The backing data provider is injected by the application shell.
 */
export class FinanceRepository {
  static dataProvider = null;
  static target = globalThis;

  /**
   * Configura o provider subjacente usado pelo repositorio.
   */
  static setDataProvider(dataProvider) {
    this.dataProvider = dataProvider || null;
  }

  /**
   * Contexto de execucao usado para auditoria e compatibilidade global.
   */
  static setTarget(target = globalThis) {
    this.target = target || globalThis;
  }

  /**
   * Compatibilidade com a fase legada: o antigo dataSdk ja possui o mesmo
   * contrato basico de provider.
   */
  static setSdk(sdk) {
    this.setDataProvider(sdk);
  }

  /**
   * Obtem a instancia do provider subjacente.
   */
  static getDataProvider() {
    if (!this.dataProvider) {
      throw new Error('Data provider is not initialized.');
    }
    return this.dataProvider;
  }

  static getTarget() {
    return this.target || globalThis;
  }

  /**
   * Alias temporario para codigo/testes legados.
   */
  static getSdk() {
    return this.getDataProvider();
  }

  static normalizeRecord(record, options = {}) {
    return normalizeFinanceRecord(record, options);
  }

  static auditWrite(operation, record, result, options = {}) {
    if (!result?.isOk) return;
    const provider = this.getDataProvider();
    if (provider?.auditHandled) return;

    const target = options.target || this.getTarget();
    const action = classifyFinanceRecordAuditAction(operation, record);
    target?.auditSdk?.logLater?.(action, {
      operation,
      source: 'FinanceRepository',
      ...summarizeFinanceRecord(record)
    });
  }

  static createLegacySdkProxy(target = this.getTarget()) {
    const repository = this;
    return {
      __financeRepositoryProxy: true,
      init: (...args) => repository.getDataProvider().init?.(...args) ?? Promise.resolve({ isOk: true }),
      create: async (record, options = {}) => repository.create(record, { ...options, target }),
      createMany: async (records, options = {}) => repository.createMany(records, { ...options, target }),
      update: async (record, options = {}) => repository.update(record, { ...options, target }),
      upsert: async (record, options = {}) => repository.upsert(record, { ...options, target }),
      delete: async (record, options = {}) => repository.delete(record, { ...options, target }),
      list: (...args) => repository.getDataProvider().list?.(...args) ?? [],
      getRawProvider: () => repository.getDataProvider()
    };
  }

  /**
   * Cria um novo registro financeiro
   * @param {FinanceRecord} record
   * @returns {Promise<{isOk: boolean, id?: string, error?: string}>}
   */
  static async create(record, options = {}) {
    const normalizedRecord = this.normalizeRecord(record, options);
    const result = await this.getDataProvider().create(normalizedRecord);
    this.auditWrite('create', { ...normalizedRecord, id: result?.id || normalizedRecord?.id || '' }, result, options);
    return result;
  }

  static async createMany(records = [], options = {}) {
    if (!Array.isArray(records)) return { isOk: false, error: 'Registros devem ser uma lista' };
    const normalizedRecords = records.map((record) => this.normalizeRecord(record, options));
    const provider = this.getDataProvider();
    if (typeof provider.createMany === 'function') {
      const result = await provider.createMany(normalizedRecords);
      if (result?.isOk) {
        normalizedRecords.forEach((record, index) => {
          this.auditWrite('create', { ...record, id: result.ids?.[index] || record.id || '' }, result, options);
        });
      }
      return result;
    }

    return { isOk: false, error: 'CREATE_MANY_NOT_SUPPORTED' };
  }

  /**
   * Atualiza um registro financeiro
   * @param {FinanceRecord} record
   * @returns {Promise<{isOk: boolean, error?: string}>}
   */
  static async update(record, options = {}) {
    const normalizedRecord = this.normalizeRecord(record, options);
    const result = await this.getDataProvider().update(normalizedRecord);
    this.auditWrite('update', normalizedRecord, result, options);
    return result;
  }

  /**
   * Upsert um registro financeiro via ID customizado
   * @param {FinanceRecord} record
   * @returns {Promise<{isOk: boolean, id?: string, error?: string}>}
   */
  static async upsert(record, options = {}) {
    const normalizedRecord = this.normalizeRecord(record, options);
    const result = await this.getDataProvider().upsert(normalizedRecord);
    this.auditWrite('upsert', { ...normalizedRecord, id: result?.id || normalizedRecord?.id || '' }, result, options);
    return result;
  }

  /**
   * Deleta um registro financeiro
   * @param {FinanceRecord} record
   * @returns {Promise<{isOk: boolean, error?: string}>}
   */
  static async delete(record, options = {}) {
    const normalizedRecord = this.normalizeRecord(record, options);
    const result = await this.getDataProvider().delete(normalizedRecord);
    this.auditWrite('delete', normalizedRecord, result, options);
    return result;
  }
}

export default FinanceRepository;

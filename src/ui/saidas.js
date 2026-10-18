export function createSaidasViewModel(records = []) {
  return records.filter((record) => record?.type === 'saida');
}

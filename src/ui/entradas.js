export function createEntradasViewModel(records = []) {
  return records.filter((record) => record?.type === 'entrada');
}

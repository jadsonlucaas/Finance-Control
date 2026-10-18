export function createConfiguracoesViewModel(records = []) {
  return {
    people: records.filter((record) => record?.type === 'pessoa'),
    macros: records.filter((record) => record?.type === 'macro'),
    categories: records.filter((record) => record?.type === 'categoria')
  };
}

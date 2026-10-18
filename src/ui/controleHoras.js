export function createControleHorasViewModel(records = []) {
  return records.filter((record) => record?.type === 'controle_horas');
}

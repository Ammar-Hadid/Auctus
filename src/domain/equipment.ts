export const equipmentTypes = [
  'dumbbell',
  'stack_machine',
  'plate_loaded_machine',
  'cable',
  'other',
] as const;
export type Equipment = (typeof equipmentTypes)[number];
export const equipmentLabels: Record<Equipment, string> = {
  dumbbell: 'Dumbbells',
  stack_machine: 'Stack machine',
  plate_loaded_machine: 'Plate-loaded machine',
  cable: 'Cable machine',
  other: 'Other',
};
export function equipmentLabel(equipment: Equipment | null) {
  return equipment ? equipmentLabels[equipment] : 'Equipment not set';
}

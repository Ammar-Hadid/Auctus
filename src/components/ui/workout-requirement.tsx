export function WorkoutRequirement({ mandatory }: { mandatory: boolean }) {
  return (
    <span className={`workout-requirement ${mandatory ? 'mandatory' : 'optional'}`}>
      {mandatory ? 'Mandatory' : 'Optional'}
    </span>
  );
}

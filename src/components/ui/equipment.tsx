'use client';
import { useId } from 'react';
import { AuctusSelect } from './select';
import {
  equipmentTypes,
  equipmentLabels,
  equipmentLabel,
  type Equipment,
} from '@/domain/equipment';

export function EquipmentField({
  value,
  disabled,
}: {
  value?: Equipment | null;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="equipment-field">
      <label htmlFor={id}>Equipment</label>
      <AuctusSelect
        id={id}
        label="Equipment"
        name="equipment"
        defaultValue={value ?? undefined}
        placeholder="Choose equipment"
        required
        disabled={disabled}
        options={equipmentTypes.map((value) => ({ value, label: equipmentLabels[value] }))}
      />
      <p>
        Stack machines use a weight pin; plate-loaded machines use plates. Cable includes rope
        attachments.
      </p>
    </div>
  );
}
export function EquipmentLabel({ equipment }: { equipment: Equipment | null }) {
  return <span className="equipment-label">{equipmentLabel(equipment)}</span>;
}

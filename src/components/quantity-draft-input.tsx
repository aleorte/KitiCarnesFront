import { Input } from './ui';
import { isAllowedQuantityDraft } from '../utils/quantity-draft';

export function QuantityDraftInput({
  value,
  onChange,
  disabled,
  className,
  id,
  'aria-label': ariaLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  'aria-label'?: string;
}) {
  return (
    <Input
      id={id}
      type="text"
      inputMode="decimal"
      disabled={disabled}
      value={value}
      aria-label={ariaLabel}
      className={className}
      onChange={(event) => {
        const next = event.target.value.replace(',', '.');
        if (!isAllowedQuantityDraft(next)) return;
        onChange(next);
      }}
    />
  );
}

interface ChipProps {
  label: string;
  selected?: boolean;
  onClick?: () => void;
}

export function Chip({ label, selected, onClick }: ChipProps) {
  return (
    <button
      type="button"
      className={selected ? "g-chip g-chip--selected" : "g-chip"}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

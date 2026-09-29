import { AVAILABILITY_OPTIONS } from "@/shared/lib/constants";

type AvailabilityCheckboxGroupProps = {
  defaultSelected?: string[];
  selected?: string[];
  onChange?: (availability: string[]) => void;
  name?: string;
  compact?: boolean;
};

export function AvailabilityCheckboxGroup({
  defaultSelected = [],
  selected,
  onChange,
  name = "availability",
  compact = false
}: AvailabilityCheckboxGroupProps) {
  return (
    <fieldset>
      <legend className="label">General availability</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {AVAILABILITY_OPTIONS.map((option) => {
          const checked = selected ? selected.includes(option) : undefined;

          return (
            <label
              key={option}
              className={
                compact
                  ? "flex items-center gap-2 rounded-lg border border-harbor-ocean/10 bg-white px-2.5 py-1.5 text-xs text-harbor-midnight/75"
                  : "flex items-center gap-2 rounded-lg border border-harbor-ocean/10 bg-white px-3 py-2 text-sm text-harbor-midnight/75"
              }
            >
              <input
                name={name}
                type="checkbox"
                value={option}
                defaultChecked={selected ? undefined : defaultSelected.includes(option)}
                checked={checked}
                onChange={
                  onChange
                    ? (event) => {
                        onChange(
                          event.target.checked
                            ? [...(selected ?? []), option]
                            : (selected ?? []).filter((item) => item !== option)
                        );
                      }
                    : undefined
                }
                className="h-4 w-4 rounded border-harbor-ocean/20 text-harbor-sky"
              />
              {option}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

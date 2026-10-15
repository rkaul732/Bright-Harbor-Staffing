import { PROGRAM_DIVISIONS } from "@/shared/lib/constants";
import type { ProgramName } from "@/shared/types/domain";

export function ProgramSelectOptions({ allowedProgramNames }: { allowedProgramNames?: ProgramName[] }) {
  const allowed = allowedProgramNames ? new Set(allowedProgramNames) : null;

  return PROGRAM_DIVISIONS.map((division) => {
    const options = division.choices.flatMap((choice) => {
      const entries = [choice, ...(choice.children ?? [])];
      return entries.flatMap((entry) => {
        if (entry === choice && choice.children && allowed && !allowed.has(choice.programNames[0])) {
          return [];
        }
        const value = entry.programNames.find((programName) => !allowed || allowed.has(programName));
        if (!value) return [];
        return [{ value, label: choice.children && entry !== choice ? `LEAP · ${entry.label}` : entry.label }];
      });
    });

    if (options.length === 0) return null;

    return (
      <optgroup key={division.name} label={division.name}>
        {options.map((option) => (
          <option key={`${option.label}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </optgroup>
    );
  });
}

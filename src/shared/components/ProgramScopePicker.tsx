"use client";

import { useMemo, useState } from "react";
import { PROGRAMS, PROGRAM_DIVISIONS } from "@/shared/lib/constants";
import { cn } from "@/shared/lib/cn";
import type { ProgramName } from "@/shared/types/domain";

type ProgramScopePickerProps = {
  allowedProgramNames?: ProgramName[];
  defaultSelectedProgramNames?: ProgramName[];
  legend?: string;
  name?: string;
  compact?: boolean;
};

function uniquePrograms(programNames: ProgramName[]) {
  return PROGRAMS.filter((programName) => programNames.includes(programName));
}

export function ProgramScopePicker({
  allowedProgramNames = PROGRAMS,
  defaultSelectedProgramNames = [],
  legend = "Program access",
  name = "program_names",
  compact = false
}: ProgramScopePickerProps) {
  const allowedSet = useMemo(() => new Set(allowedProgramNames), [allowedProgramNames]);
  const divisions = useMemo(
    () =>
      PROGRAM_DIVISIONS.map((division) => ({
        ...division,
        programNames: division.programNames.filter((programName) => allowedSet.has(programName))
      })).filter((division) => division.programNames.length > 0),
    [allowedSet]
  );
  const initialSelected = useMemo(
    () => uniquePrograms(defaultSelectedProgramNames.filter((programName) => allowedSet.has(programName))),
    [allowedSet, defaultSelectedProgramNames]
  );
  const [selectedPrograms, setSelectedPrograms] = useState<ProgramName[]>(initialSelected);

  function isDivisionSelected(programNames: ProgramName[]) {
    return programNames.every((programName) => selectedPrograms.includes(programName));
  }

  function toggleProgram(programName: ProgramName, checked: boolean) {
    setSelectedPrograms((current) => {
      if (checked) return uniquePrograms([...current, programName]);
      return current.filter((item) => item !== programName);
    });
  }

  function toggleDivision(programNames: ProgramName[], checked: boolean) {
    setSelectedPrograms((current) => {
      if (checked) return uniquePrograms([...current, ...programNames]);
      return current.filter((programName) => !programNames.includes(programName));
    });
  }

  return (
    <fieldset>
      <legend className="label">{legend}</legend>
      {selectedPrograms.map((programName) => (
        <input key={programName} type="hidden" name={name} value={programName} />
      ))}

      <div className="mt-2 space-y-2 rounded-lg border border-harbor-ocean/10 bg-white p-2">
        <div className="rounded-md bg-harbor-mist/70 p-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-harbor-ocean">
            Divisions
          </p>
          <div className={cn("mt-2 grid gap-1.5", compact ? "sm:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-3")}>
            {divisions.map((division) => (
              <label
                key={division.name}
                className="flex items-start gap-2 rounded-md px-2 py-1.5 text-xs text-harbor-midnight/75 hover:bg-white"
              >
                <input
                  type="checkbox"
                  checked={isDivisionSelected(division.programNames)}
                  onChange={(event) => toggleDivision(division.programNames, event.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 rounded border-harbor-ocean/20 text-harbor-sky"
                />
                <span>
                  <span className="block font-medium text-harbor-midnight">{division.name}</span>
                  <span className="text-harbor-midnight/48">{division.programNames.length} programs</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className={cn("max-h-56 overflow-auto rounded-md border border-harbor-ocean/10 p-2", compact && "max-h-44")}>
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-harbor-ocean">
            Programs
          </p>
          <div className="mt-2 space-y-2">
            {divisions.map((division) => (
              <details key={division.name} className="group rounded-md border border-harbor-ocean/10 bg-harbor-mist/35" open={!compact}>
                <summary className="cursor-pointer list-none px-2 py-1.5 text-xs font-medium text-harbor-midnight">
                  {division.name}
                </summary>
                <div className="grid gap-1 border-t border-harbor-ocean/10 bg-white p-1.5 sm:grid-cols-2">
                  {division.programNames.map((programName) => (
                    <label
                      key={programName}
                      className="flex items-start gap-2 rounded-md px-2 py-1.5 text-xs text-harbor-midnight/75 hover:bg-harbor-mist"
                    >
                      <input
                        type="checkbox"
                        checked={selectedPrograms.includes(programName)}
                        onChange={(event) => toggleProgram(programName, event.target.checked)}
                        className="mt-0.5 h-3.5 w-3.5 rounded border-harbor-ocean/20 text-harbor-sky"
                      />
                      <span>{programName}</span>
                    </label>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </div>
      </div>
    </fieldset>
  );
}

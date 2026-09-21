"use client";

import { useActionState } from "react";
import { Camera, MapPin, Save } from "lucide-react";
import {
  updateSupervisorProfileAction,
  updateWorkerProfileAction
} from "@/app/actions";
import {
  LOCATIONS,
  PROGRAMS,
  SKILLS,
  getProfileProgramNames
} from "@/shared/lib/constants";
import { ActionFeedback } from "@/shared/components/ActionFeedback";
import { SubmitButton } from "@/shared/components/SubmitButton";
import type { DashboardData } from "@/shared/types/domain";

const initialState = { ok: false, message: "" };

export function WorkerProfileForm({ data }: { data: DashboardData }) {
  const [state, formAction] = useActionState(updateWorkerProfileAction, initialState);
  const profile = data.workerProfiles.find(
    (workerProfile) => workerProfile.user_id === data.currentUser.id
  );
  const selectedPrograms = getProfileProgramNames(profile);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">Phone</span>
          <input
            name="phone"
            defaultValue={data.currentUser.phone ?? ""}
            className="field mt-1.5"
            placeholder="732-555-0100"
          />
        </label>
        <label className="block">
          <span className="label">Preferred contact</span>
          <select name="preferred_contact" className="field mt-1.5">
            <option>Text</option>
            <option>Email</option>
            <option>Phone</option>
          </select>
        </label>
      </div>

      <fieldset>
        <legend className="label">Programs</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {PROGRAMS.map((program) => (
            <label
              key={program}
              className="flex items-center gap-2 rounded-lg border border-harbor-ocean/10 bg-white px-3 py-2 text-sm text-harbor-midnight/75"
            >
              <input
                name="program_names"
                type="checkbox"
                value={program}
                defaultChecked={selectedPrograms.includes(program)}
                className="h-4 w-4 rounded border-harbor-ocean/20 text-harbor-sky"
              />
              {program}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="label">Availability</span>
        <input
          name="availability"
          defaultValue={profile?.availability.join(", ") ?? ""}
          className="field mt-1.5"
          placeholder="Weeknights, weekends, overnights"
        />
      </label>

      <fieldset>
        <legend className="label">Skills</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {SKILLS.map((skill) => (
            <label
              key={skill}
              className="flex items-center gap-2 rounded-lg border border-harbor-ocean/10 bg-white px-3 py-2 text-sm text-harbor-midnight/75"
            >
              <input
                name="requirements"
                type="checkbox"
                value={skill}
                defaultChecked={profile?.skills.includes(skill)}
                className="h-4 w-4 rounded border-harbor-ocean/20 text-harbor-sky"
              />
              {skill}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="label">Profile photo</span>
        <div className="mt-1.5 flex items-center gap-3 rounded-lg border border-harbor-ocean/10 bg-white px-3 py-3">
          <Camera className="h-4 w-4 text-harbor-ocean" aria-hidden="true" />
          <input name="photo" type="file" accept="image/*" className="text-sm" />
        </div>
      </label>

      <SubmitButton>
        <Save className="h-4 w-4" aria-hidden="true" />
        Save employee profile
      </SubmitButton>
      <ActionFeedback state={state} />
    </form>
  );
}

export function SupervisorProfileForm() {
  const [state, formAction] = useActionState(updateSupervisorProfileAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">Program location profile</span>
          <input
            name="front_desk_location_name"
            className="field mt-1.5"
            placeholder="Toms River Staffing"
            required
          />
        </label>
        <label className="block">
          <span className="label">Primary location</span>
          <select name="location_name" className="field mt-1.5" required>
            {LOCATIONS.map((location) => (
              <option key={location} value={location}>
                {location}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="label">Title</span>
        <input
          name="title"
          className="field mt-1.5"
          placeholder="Staffing Coordinator"
          required
        />
      </label>
      <SubmitButton variant="secondary">
        <MapPin className="h-4 w-4" aria-hidden="true" />
        Save location profile
      </SubmitButton>
      <ActionFeedback state={state} />
    </form>
  );
}

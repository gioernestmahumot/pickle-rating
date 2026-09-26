import { REGIONS } from "@/lib/regions";

export function RegionSelect({ name = "region", defaultValue, required = true, allLabel }: { name?: string; defaultValue?: string; required?: boolean; allLabel?: string }) {
  return (
    <select id={name} name={name} className="input" defaultValue={defaultValue ?? ""} required={required}>
      <option value="" disabled={required}>{allLabel ?? "Choose a region"}</option>
      {REGIONS.map((region) => <option key={region.code} value={region.code}>{region.name}</option>)}
    </select>
  );
}

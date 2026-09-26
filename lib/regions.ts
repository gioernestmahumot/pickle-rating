// Philippine administrative regions. Codes must match the check constraints in
// supabase/migrations (tests/db.test.mjs checks every code is accepted).
export const REGIONS = [
  { code: "NCR", name: "National Capital Region (Metro Manila)" },
  { code: "CAR", name: "Cordillera Administrative Region" },
  { code: "R1", name: "Region I – Ilocos Region" },
  { code: "R2", name: "Region II – Cagayan Valley" },
  { code: "R3", name: "Region III – Central Luzon" },
  { code: "R4A", name: "Region IV-A – CALABARZON" },
  { code: "MIMAROPA", name: "MIMAROPA Region" },
  { code: "R5", name: "Region V – Bicol Region" },
  { code: "R6", name: "Region VI – Western Visayas" },
  { code: "NIR", name: "Negros Island Region" },
  { code: "R7", name: "Region VII – Central Visayas" },
  { code: "R8", name: "Region VIII – Eastern Visayas" },
  { code: "R9", name: "Region IX – Zamboanga Peninsula" },
  { code: "R10", name: "Region X – Northern Mindanao" },
  { code: "R11", name: "Region XI – Davao Region" },
  { code: "R12", name: "Region XII – SOCCSKSARGEN" },
  { code: "R13", name: "Region XIII – Caraga" },
  { code: "BARMM", name: "Bangsamoro (BARMM)" },
] as const;

export type RegionCode = (typeof REGIONS)[number]["code"];

const SHORT_NAMES: Record<string, string> = {
  NCR: "Metro Manila", CAR: "Cordillera", R1: "Ilocos", R2: "Cagayan Valley", R3: "Central Luzon",
  R4A: "CALABARZON", MIMAROPA: "MIMAROPA", R5: "Bicol", R6: "Western Visayas", NIR: "Negros Island",
  R7: "Central Visayas", R8: "Eastern Visayas", R9: "Zamboanga Peninsula", R10: "Northern Mindanao",
  R11: "Davao Region", R12: "SOCCSKSARGEN", R13: "Caraga", BARMM: "BARMM",
};

export function isRegionCode(value: unknown): value is RegionCode {
  return typeof value === "string" && REGIONS.some((region) => region.code === value);
}

export function regionName(code: string): string {
  return SHORT_NAMES[code] ?? code;
}

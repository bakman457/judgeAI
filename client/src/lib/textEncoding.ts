const MOJIBAKE_MARKERS = /[ÎÏÂâ]/;
const WINDOWS_1252_BYTES: Record<string, number> = {
  "€": 0x80,
  "‚": 0x82,
  "ƒ": 0x83,
  "„": 0x84,
  "…": 0x85,
  "†": 0x86,
  "‡": 0x87,
  "ˆ": 0x88,
  "‰": 0x89,
  "Š": 0x8a,
  "‹": 0x8b,
  "Œ": 0x8c,
  "Ž": 0x8e,
  "‘": 0x91,
  "’": 0x92,
  "“": 0x93,
  "”": 0x94,
  "•": 0x95,
  "–": 0x96,
  "—": 0x97,
  "˜": 0x98,
  "™": 0x99,
  "š": 0x9a,
  "›": 0x9b,
  "œ": 0x9c,
  "ž": 0x9e,
  "Ÿ": 0x9f,
};

export function repairMojibakeText(value: string) {
  if (!MOJIBAKE_MARKERS.test(value)) return value;
  try {
    const bytes = Array.from(value, char => WINDOWS_1252_BYTES[char] ?? char.charCodeAt(0));
    return decodeURIComponent(
      bytes
        .map(byte => `%${(byte & 0xff).toString(16).padStart(2, "0")}`)
        .join(""),
    );
  } catch {
    return value
      .replace(/â€¦/g, "...")
      .replace(/â€”/g, "-")
      .replace(/â†’/g, "->")
      .replace(/Â·/g, "·");
  }
}

export function repairMojibakeObject<T>(value: T): T {
  if (typeof value === "string") {
    return repairMojibakeText(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map(item => repairMojibakeObject(item)) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, repairMojibakeObject(entry)]),
    ) as T;
  }
  return value;
}

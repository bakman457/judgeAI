import { describe, expect, it } from "vitest";
import { normalizeLocale } from "./LocaleContext";
import { normalizeTheme } from "./ThemeContext";

describe("preference normalization", () => {
  it("defaults locale to English for unsupported values", () => {
    expect(normalizeLocale(null)).toBe("en");
    expect(normalizeLocale(undefined)).toBe("en");
    expect(normalizeLocale("fr")).toBe("en");
  });

  it("preserves supported locale values", () => {
    expect(normalizeLocale("en")).toBe("en");
    expect(normalizeLocale("el")).toBe("el");
  });

  it("defaults theme to the provided fallback when storage is invalid", () => {
    expect(normalizeTheme(null)).toBe("light");
    expect(normalizeTheme("sepia", "dark")).toBe("dark");
  });

  it("preserves supported theme values", () => {
    expect(normalizeTheme("light")).toBe("light");
    expect(normalizeTheme("dark")).toBe("dark");
  });
});

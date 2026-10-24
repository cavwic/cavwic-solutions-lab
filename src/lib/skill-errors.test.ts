import { describe, expect, it } from "vitest";
import { skillErrorMessage } from "./skill-errors";

describe("browser Skill error messages", () => {
  it("localizes known codes and does not expose arbitrary server text", () => {
    expect(skillErrorMessage({ code: "STORAGE_QUOTA" }, "zh", "fallback")).toContain("空间不足");
    expect(skillErrorMessage({ code: "CONTENT_CHANGED" }, "en", "fallback")).toContain("Content changed");
    expect(skillErrorMessage(new Error("untrusted text"), "zh", "fallback")).toBe("fallback");
  });
});

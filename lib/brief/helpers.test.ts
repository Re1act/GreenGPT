import { describe, expect, it } from "vitest";
import {
  billStatusLabel,
  commentTemplate,
  deadlineState,
  isOfficialChannel,
  orgKindLabel,
  staleBillNote,
  unsupportedZipReason,
} from "@/lib/brief/helpers";

describe("deadlineState", () => {
  const today = new Date("2026-10-23T12:00:00Z");

  it("counts days left, including the deadline day itself", () => {
    expect(deadlineState("2026-11-02", "2026-10-20", today)).toBe("Comments due Nov 2, 2026 (10 days left)");
    expect(deadlineState("2026-10-24", "2026-10-20", today)).toBe("Comments due Oct 24, 2026 (1 day left)");
    expect(deadlineState("2026-10-23", "2026-10-20", today)).toBe("Comments due today (Oct 23, 2026)");
  });

  it("says closed after the deadline and never implies an unconfirmed window is open", () => {
    expect(deadlineState("2026-10-01", "2026-09-20", today)).toBe("Comment window closed Oct 1, 2026");
    expect(deadlineState(null, "2026-10-20", today)).toBe("Deadline not confirmed (checked Oct 20, 2026)");
  });
});

describe("commentTemplate", () => {
  it("fills the place and leaves brackets for everything personal", () => {
    const t = commentTemplate("Chandler, AZ 85226", "", "");
    expect(t).toContain("I live in Chandler, AZ 85226.");
    expect(t).toContain("[Docket, case, or bill number]");
    expect(t).toContain("[your name]");
  });

  it("uses a recipient and docket when given", () => {
    const t = commentTemplate("X", "Arizona Corporation Commission", "E-01345A-25-0001");
    expect(t).toContain("To: Arizona Corporation Commission");
    expect(t).toContain("Re: E-01345A-25-0001");
  });
});

describe("labels", () => {
  it("maps enum values to plain English and passes unknowns through", () => {
    expect(billStatusLabel("passed_legislature")).toBe("Passed the legislature");
    expect(billStatusLabel("weird")).toBe("weird");
    expect(orgKindLabel("ratepayer_advocate")).toBe("Utility consumer advocate");
    expect(orgKindLabel("weird")).toBe("Organization");
    expect(isOfficialChannel("utility_commission")).toBe(true);
    expect(isOfficialChannel("community_group")).toBe(false);
  });
});

describe("staleBillNote", () => {
  const today = new Date("2026-10-24T12:00:00Z");

  it("flags open bills with no action in six months", () => {
    expect(staleBillNote("in_committee", "2025-03-04", today)).toBe(
      "No recorded action since Mar 4, 2025. It may have died when the session ended."
    );
  });

  it("stays quiet for recent action, final outcomes, and missing dates", () => {
    expect(staleBillNote("in_committee", "2026-09-01", today)).toBeNull();
    expect(staleBillNote("enacted", "2025-03-04", today)).toBeNull();
    expect(staleBillNote("introduced", null, today)).toBeNull();
  });
});

describe("unsupportedZipReason", () => {
  it("explains territory and military ZIPs", () => {
    for (const zip of ["00802", "96799", "96910", "96950"]) expect(unsupportedZipReason(zip)).toMatch(/territories/);
    for (const zip of ["09012", "34001", "96201"]) expect(unsupportedZipReason(zip)).toMatch(/APO\/FPO/);
  });

  it("lets states, DC, and Puerto Rico through", () => {
    for (const zip of ["85226", "20001", "00601", "00901", "99501", "96813"]) expect(unsupportedZipReason(zip)).toBeNull();
  });
});

import { renderBalanceReport } from "../../../../dev/tools/generate-balance-report";
import { describe, expect, it } from "vitest";

describe("generate balance report", () => {
  it("renders current combat, route, topology, and placement evidence without skeleton placeholders", () => {
    const report = renderBalanceReport();

    expect(report).toContain("Pantry Depths — Balance Report");
    expect(report).toContain("Princess");
    expect(report).toContain("Stage 4");
    expect(report).toContain("Provisional 強制路線 HP 預算");
    expect(report).toContain("Princess defeated");
    expect(report).toContain("40 / 120 HP");
    expect(report).toContain("b5-princess");
    expect(report).not.toContain("待生成");
    expect(report).not.toContain("框架範本");
  });
});

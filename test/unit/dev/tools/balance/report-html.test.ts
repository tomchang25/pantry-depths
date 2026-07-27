import { BALANCE_TEST_SCENARIO } from "../../../../fixtures/balance-scenario";
import { renderBalanceReportHtml } from "../../../../../dev/tools/balance/report-html";
import { createBalanceAnalysis } from "@/harness/balance-analysis";
import { describe, expect, it } from "vitest";

describe("renderBalanceReportHtml", () => {
  it("renders current combat, route, topology, and placement evidence without skeleton placeholders", () => {
    const report = renderBalanceReportHtml(createBalanceAnalysis(BALANCE_TEST_SCENARIO));

    expect(report).toContain("Pantry Depths — Balance Report");
    expect(report).toContain("Purple Slime");
    expect(report).toContain("Stage 4");
    expect(report).toContain("Provisional 強制路線 HP 預算");
    expect(report).toContain("Left through the exit");
    expect(report).toContain("40 / 120 HP");
    expect(report).toContain("t2-hardest");
    expect(report).not.toContain("待生成");
    expect(report).not.toContain("框架範本");
  });

  it("renders the same bytes for the same model", () => {
    const analysis = createBalanceAnalysis(BALANCE_TEST_SCENARIO);

    expect(renderBalanceReportHtml(analysis)).toBe(renderBalanceReportHtml(analysis));
  });

  it("reads route and topology status from the model rather than deriving it", () => {
    const analysis = createBalanceAnalysis(BALANCE_TEST_SCENARIO);
    const report = renderBalanceReportHtml({
      ...analysis,
      route: { ...analysis.route, succeeded: false },
      topology: { ...analysis.topology, passed: false },
    });

    expect(report).toContain('強制路線：<span class="fail">FAIL</span>');
    expect(report).toContain('結構拓撲：<span class="fail">FAIL</span>');
  });
});

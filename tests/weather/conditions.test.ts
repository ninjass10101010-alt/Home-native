// Home-native/tests/weather/conditions.test.ts
import { conditionCode } from "../../src/weather/conditions";

describe("conditionCode (WMO → ConditionCode, web band parity)", () => {
  it("day bands", () => {
    expect(conditionCode(0, true)).toBe("clear");
    expect(conditionCode(1, true)).toBe("clear");
    expect(conditionCode(2, true)).toBe("partly");
    expect(conditionCode(3, true)).toBe("cloudy");
    expect(conditionCode(45, true)).toBe("fog");
    expect(conditionCode(48, true)).toBe("fog");
    expect(conditionCode(51, true)).toBe("rain");
    expect(conditionCode(61, true)).toBe("rain");
    expect(conditionCode(67, true)).toBe("rain");
    expect(conditionCode(80, true)).toBe("rain");
    expect(conditionCode(82, true)).toBe("rain");
    expect(conditionCode(71, true)).toBe("snow");
    expect(conditionCode(77, true)).toBe("snow");
    expect(conditionCode(85, true)).toBe("snow");
    expect(conditionCode(95, true)).toBe("storm");
    expect(conditionCode(99, true)).toBe("storm");
  });
  it("night variants", () => {
    expect(conditionCode(0, false)).toBe("night");
    expect(conditionCode(2, false)).toBe("partly-night");
  });
  it("missing code falls to a neutral cloud — never fabricated art", () => {
    expect(conditionCode(undefined, true)).toBe("cloudy");
  });
});

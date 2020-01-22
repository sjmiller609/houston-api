import { next } from "./index";

describe("next", () => {
  test("returns a default value if parent is empty", () => {
    expect(next({})).toBe("deploy-1");
  });

  test("returns value if parent has it", () => {
    expect(next({ next: "deploy-2" })).toBe("deploy-2");
  });
});

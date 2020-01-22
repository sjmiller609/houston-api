import { hasError } from "./index";
import casual from "casual";

describe("hasError", () => {
  test("returns true for matched error", () => {
    const message = casual.text;
    const e = { result: { errors: [{ code: 500, message }] } };
    const result = hasError(e, 500, message);
    expect(result).toBe(true);
  });

  test("returns false for unmatched error", () => {
    const e = { result: { errors: [{ message: casual.text }] } };
    const result = hasError(e, casual.text);
    expect(result).toBe(false);
  });
});

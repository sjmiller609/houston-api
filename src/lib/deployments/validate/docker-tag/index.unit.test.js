import isValidTaggedDeployment from "./index";

describe("isValidTaggedDeployment", () => {
  test("returns true for a valid tag", () => {
    const ev = {
      action: "push",
      target: { tag: "cli-1", repository: "example-deployment-1234/airflow" }
    };
    const result = isValidTaggedDeployment(ev);
    expect(result).toBe(true);
  });

  test("returns false for an invalid repo", () => {
    let ev = {
      action: "push",
      target: {
        tag: "cli-1",
        repository: "example-deployment-1234/not-airflow"
      }
    };
    let result = isValidTaggedDeployment(ev);
    expect(result).toBe(false);

    ev = {
      action: "push",
      target: { tag: "cli-1", repository: "base-images/airflow" }
    };
    result = isValidTaggedDeployment(ev);
    expect(result).toBe(false);
  });

  test("returns false for an invalid tag", () => {
    const ev = { action: "push", target: { tag: "latest" } };
    const result = isValidTaggedDeployment(ev);
    expect(result).toBe(false);
  });

  test("returns false for an empty tag", () => {
    const ev = { action: "push", target: { tag: "" } };
    const result = isValidTaggedDeployment(ev);
    expect(result).toBe(false);
  });

  test("returns false for an invalid action", () => {
    const ev = { action: "pull", target: { tag: "cli-1" } };
    const result = isValidTaggedDeployment(ev);
    expect(result).toBe(false);
  });
});

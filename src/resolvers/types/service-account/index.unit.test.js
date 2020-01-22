import { apiKey } from "./index";
import casual from "casual";
import moment from "moment";

describe("ServiceAccount", () => {
  test("apiKey returns fully when just created", () => {
    const serviceAccount = {
      apiKey: casual.uuid,
      createdAt: new Date() // Now
    };
    const key = apiKey(serviceAccount);

    const expected = serviceAccount.apiKey; // Test that we return the full key
    expect(key).toEqual(expect.stringMatching(expected));
  });

  test("apiKey returns partially obfuscated if service account was created in past", () => {
    const serviceAccount = {
      apiKey: casual.uuid,
      createdAt: moment("1970-01-01").toDate() // The Past
    };
    const key = apiKey(serviceAccount);

    const expected = /\*{5}$/; // Test we end with some asterisks
    expect(key).toEqual(expect.stringMatching(expected));
  });
});

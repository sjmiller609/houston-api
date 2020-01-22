import router from "./index";
import * as prismaExports from "generated/client";
import * as emailExports from "emails";
import casual from "casual";
import request from "supertest";
import express from "express";

// Create test application.
const app = express().use(router);

describe("POST /alerts", () => {
  test("alerts are properly mapped to an email", async () => {
    // Set up our spies.
    jest.spyOn(prismaExports.prisma, "deployment").mockImplementation(() => {
      return {
        alertEmails() {
          return [casual.email, casual.email];
        }
      };
    });

    const sendEmail = jest.spyOn(emailExports, "sendEmail");

    const res = await request(app)
      .post("/")
      .send({
        receiver: casual.word,
        status: "firing",
        alerts: [
          {
            status: "firing",
            labels: {
              alertname: casual.word,
              component: casual.word,
              workspace: casual.word,
              deployment: casual.word,
              instance: casual.domain,
              job: casual.word,
              tier: casual.word
            },
            annotations: {
              description: casual.description,
              summary: casual.short_description
            },
            startsAt: casual.date("YYYY-MM-DD"),
            endsAt: casual.date("YYYY-MM-DD")
          },
          {
            status: "firing",
            labels: {
              alertname: casual.word,
              component: casual.word,
              workspace: casual.word,
              deployment: casual.word,
              instance: casual.domain,
              job: casual.word,
              tier: casual.word
            },
            annotations: {
              description: casual.description,
              summary: casual.short_description
            },
            startsAt: casual.date("YYYY-MM-DD"),
            endsAt: casual.date("YYYY-MM-DD")
          }
        ]
      });

    expect(sendEmail).toHaveBeenCalledTimes(4);
    expect(res.statusCode).toBe(200);
  });
});

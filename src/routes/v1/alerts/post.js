import { prisma } from "generated/client";
import { sendEmail } from "emails";
import log from "logger";
import { orbit } from "utilities";
import moment from "moment";

/*
 * Handle alert notifications from AlertManager.
 * @param {Object} req The request.
 * @param {Object} res The response.
 */
export default async function(req, res) {
  const { alerts = [] } = req.body;

  await Promise.all(
    alerts.map(async alert => {
      const releaseName = alert.labels.deployment;
      log.info(`Sending email alerts for ${releaseName}`);

      // Get a list of emails to send alerts to.
      const emails = await prisma
        .deployment({ deletedAt: null, releaseName })
        .alertEmails();

      // Bail if we have no emails to send.
      if (!emails) return;

      // Modify the alert to transform / append useful information
      const modifiedAlert = {
        ...alert,
        startsAt: moment(alert.startsAt).format(
          "dddd, MMMM Do YYYY, h:mm:ss a"
        ),
        endsAt: moment(alert.startsAt).format("dddd, MMMM Do YYYY, h:mm:ss a"),
        isFiring: alert.status === "firing"
      };

      // Send all the emails for this deployment.
      await Promise.all(
        emails.map(email =>
          sendEmail(email, "alert", {
            orbitUrl: orbit(),
            alert: modifiedAlert
          })
        )
      );
    })
  );

  res.sendStatus(200);
}

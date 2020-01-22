import log from "logger";
import Emailer from "email-templates";
import handlebars from "handlebars";
import handlebarsLayouts from "handlebars-layouts";
import config from "config";
import path from "path";
import fs from "fs";

// Pull some config out.
const { enabled, reply, preview, smtpUrl } = config.get("email");

// Register handlebars.
handlebarsLayouts.register(handlebars);

// Define template paths.
const templatePath = path.join(__dirname, "templates");
handlebars.registerPartial(
  "layout",
  fs.readFileSync(path.join(templatePath, "layouts/main.hbs"), "utf8")
);
handlebars.registerPartial(
  "layout-text",
  fs.readFileSync(path.join(templatePath, "layouts/text.hbs"), "utf8")
);

// Create a new mailer object.
const mailer = new Emailer({
  views: {
    root: templatePath,
    options: {
      extension: "hbs"
    }
  },
  send: enabled,
  preview,
  transport: smtpUrl ? smtpUrl : { jsonTransport: true }
});

/*
 * Send an email.
 * @param {String} recipient The email address.
 * @param {String} template The name of the template.
 * @param {Promise<Object>} locals The values to template in.
 */
export function sendEmail(recipient, template, locals) {
  const message = {
    from: `"Astronomer" <${reply}>`,
    to: recipient
  };

  log.debug(
    `${enabled ? "Sending" : "Skipping"} ${template} email to ${recipient}`
  );
  return mailer.send({ template, message, locals });
}

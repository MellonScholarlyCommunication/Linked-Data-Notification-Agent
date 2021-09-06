const auth = require("@inrupt/solid-client-authn-node")
const Session = auth.Session;
const InMemoryStorage = auth.InMemoryStorage;

const express = require('express')

const IDENTITY_PROVIDER_INRUPT_PROD = "https://broker.pod.inrupt.com";

module.exports = async function login(idp = IDENTITY_PROVIDER_INRUPT_PROD, appName="solid_notification_agent", port = 3456) {
  console.log(`Logging in to identity provider ${idp} for application ${appName} on port ${port}`)
  return new Promise((resolve, reject) => {
    const app = express();
    const iriBase = `http://localhost:${port}`;
    const storage = new InMemoryStorage();

    const session = new Session({
      insecureStorage: storage,
      secureStorage: storage,
    });

    const server = app.listen(port, async () => {
      console.log(`Listening at: [${iriBase}].`);
      const loginOptions = {
        clientName: appName,
        oidcIssuer: idp,
        redirectUrl: iriBase,
        tokenType: "DPoP",
        handleRedirect: (url) => {
          console.log(`\nPlease visit ${url} in a web browser.\n`);
        },
      };
      let clientInfo;
      console.log(
        `Logging in to Solid Identity Provider  ${idp} to get a refresh token.`
      );
      session.login(loginOptions).catch((e) => {
        reject(
          `Logging in to Solid Identity Provider [${ idp }] failed: ${e.toString()}`
        );
      });
    });

    app.get("/", async (_req, res) => {
      const redirectIri = new URL(_req.url, iriBase).href;
      console.log(
        `Login into the Identity Provider successful, receiving request to redirect IRI [${redirectIri}].`
      );
      await session.handleIncomingRedirect(redirectIri);
      // NB: This is a temporary approach, and we have work planned to properly
      // collect the token. Please note that the next line is not part of the public
      // API, and is therefore likely to break on non-major changes.
      const rawStoredSession = await storage.get(
        `solidClientAuthenticationUser:${session.info.sessionId}`
      );
      if (rawStoredSession === undefined) {
        reject(
          `Cannot find session with ID [${session.info.sessionId}] in storage.`
        );
      }
      server.close();
      
      resolve(session)
    });
  })
}
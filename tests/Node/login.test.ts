import { expect } from 'chai'
import 'mocha'
import { NotificationHandler } from '../../src/index';
import { LoginOptions } from '../../src/Utils/util';
import { readFileSync } from 'fs';



describe('Testing Node login', () => {
  const configPath = "./tests/testconfig.json";
  const config = JSON.parse(readFileSync(configPath, {encoding: 'utf-8'}))
  it("Notification handler instance should allow the client to login using credentials passed in the config file.", async () => {
    let handler = new NotificationHandler(config);
    expect(handler.auth).to.be.undefined;
    expect(await handler.login())
    expect(handler.auth).to.not.be.undefined;
    expect(handler.auth.name).to.equal('cli')
    expect(await handler.auth.logout())
  })

  it("Notification handler instance should allow the client to login using credentials passed to the login function.", async () => {
    let handler = new NotificationHandler({});
    const loginOptions : LoginOptions = {
      "username": "notificationtestpod",
      "password": "notificationtestpod",
      "idp": "https://solidcommunity.net",
    }
    expect(handler.auth).to.be.undefined;
    expect(await handler.login(loginOptions))
    expect(handler.auth).to.not.be.undefined;
    expect(handler.auth.name).to.equal('cli')
    expect(await handler.logout())
  })
})
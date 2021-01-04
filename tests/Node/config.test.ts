import { expect } from 'chai'
import 'mocha'
import { NotificationHandler } from '../../src/index';
import { readFileSync } from 'fs';


describe('Testing config file loading', () => {
  const configPath = "./tests/testconfig.json";
  it("Should load the config file on creation of the Notification handler class and insert the values in the ConfigFileOptions variable.", async () => {

    const config = JSON.parse(readFileSync(configPath, {encoding: 'utf-8'}))

    let handler = new NotificationHandler(config);
    expect(!!handler.auth).to.not.be.null;
    expect(!!handler.auth).to.not.be.undefined;
    expect(handler.config).to.deep.equal({
      "username": "notificationtestpod",
      "password": "notificationtestpod",
      "idp": "https://solidcommunity.net",
      "sender": "default_sender",
      "loginPopup": "https://solidcommunity.net/common/popup.html"
    });
  })
  
})
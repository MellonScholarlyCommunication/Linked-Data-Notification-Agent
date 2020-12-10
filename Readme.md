## Solid notifications
The solution for notifications in a LDP environment.

### Installation
This library can be installed using the following command:
``` npm install solid-notifications ```

If the command line interface is required, it must be installed globally:
``` npm install -g solid-notifications ```
<!-- Deze benaming is nog niet finaal! -->

### Features

#### Sending notifications

#### Retrieving inbox

#### Notification filtering
This feature is planned but has currently not yet been implemented.

#### Automatic notification processing
This feature is planned but has currently not yet been implemented.

### CLI Interface

#### Logging in

### Program Interface

#### Logging in


### Configuration file
This library allows for a configuration file to be passed.

* idp: The identity provider. This is required to login      
* username: The username to login 
* password: 
* sender
  
**Browser-specific settings**
* popup:  The 
- a
- d
- {
  "username": "notificationtestpod",
  "password": "notificationtestpod",
  "idp": "https://solidcommunity.net",
  "sender": "default_sender",
  "loginPopup": "https://solidcommunity.net/common/popup.html"
}
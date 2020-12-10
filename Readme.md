# Solid notifications
The solution for notifications in a LDP environment.

## Installation
This library can be installed using the following command:
``` npm install solid-notifications ```

If the command line interface is required, it must be installed globally:
``` npm install -g solid-notifications ```
<!-- Deze benaming is nog niet finaal! -->

## Usage
### CLI
In case the library is installed globally:
```
solid-notifications [options] <command>
```

The CLI interface can also be used through node:
```
node bin/solid-notifications.js [options] <command>
```

### Javascript
```
const NotificationAgent = require('solid-notifications')
```

## Configuration
A configuration object can be passed to the agent on creation.
The options in this configuration object can be overwritten by overwriting the options in the parameters for specific commands.

### CLI
On the CLI, the configuration file can be passed with a ```-c``` flag
```
solid-notifications -c config.json <command>
```

### Javascript
```
const NotificationAgent = require('solid-notifications')
const config = {...}
const agent = new NotificationAgent(config)
```

### Configuration options
```
{
  auth?: any,         // Only for javascript! A custom auth object can be passed.
  username?: string,  // Solid username. Used for authentication in node.
  password?: string,  // Solid password. Used for authentication in node.
  idp?: string,       // Solid Identity Provider. Used for authentication in node and browser.
  popup?: string,     // The URL of the login popup. Used for authentication in browser.
  sender?: string,    // The default sender added to notifications.
  format?: string,    // The format of all output data. Must be an RDF format.
  verbose?: boolean,  // Write logs to command line.
}
```

## Authentication
Commands requiring the client to retrieve data from the inbox, may require the client to authenticate.
Authentication is done using [solid-auth-cli](https://github.com/jeff-zucker/solid-auth-cli) in Node, and using [solid-auth-client](https://github.com/solid/solid-auth-client) in the browser.
### CLI
The login information can be passed using the configuration file, or using the relevant option flags.
Authentication will automatically be attempted for commands requiring authentication.
### Javascript
The login information can be passed using the configuration file, or in the options of the login function.
```
const NotificationAgent = require('solid-notifications')
const agent = new NotificationAgent(config)

// Node && Browser
const options = { username, password, idp } 
await agent.login(options)

// Browser
// uri is the URI of the popup.
loginPopup(uri)


// Now the user is authenticated, and we can call functions requiring authentication.
// In browser environments, authentication can be easily handled by passing a custom auth object that is already authenticated.
// Else, The authentication control flow should not be awaited, but be handled using a better async approach (e.g. useEffect in React).
```
The used functions in the background are:

login() - 
[node](https://github.com/jeff-zucker/solid-auth-cli#login-idphttpsidpexamplecom-usernameyou-passwordhmm-) -
[browser](https://github.com/solid/solid-auth-client#logging-in)

loginPopup(uri) - 
[browser](https://github.com/solid/solid-auth-client#logging-in)



## Features

### Sending notifications

#### CLI
```
solid-notifications [options] send [send-options] <receiver> <notification>
```
#### Javascript
```
const agent = require('solid-notifications')
const options = {...}
agent.sendNotification(options)
```
#### Options
```
{
  notification?: any,             // A Notification string
  notification_file?: any,        // A Notification file
  from: string[],                 // Senders of the notification
  to: string[],                   // Receivers of the notification
  cc?: string[],                  // CC contacts
  bcc?: string[],                 // BCC contacts
  contentType: string,            // Content Type of the notification. In the case of text/plain, the notification is as the content string of a notification (This does not work in the case of a notification file).
  contentTypeOutput: string,      // Content Type of the posted notification
}
```
The CLI interface handles the passed notification as a file if the ```-f``` flag is passed.
All the option flags can be found here:
```
  solid-notifications.js send --help
```


#### Retrieving inbox
If no url is given, it will default to the inbox of the currently authenticated user.
#### CLI
```
solid-notifications [options] list [list-options] [url]
```
#### Javascript
```
const agent = require('solid-notifications')
const options = {...}
agent.listNotifications(options)
```
#### Options
```
{
  webId?: string,                 // The resource of which the inbox is used.
  format?: string,                // The format in which notifications are emitted
  delete?:boolean,                // Notifications are deleted after listing
  watch?: boolean,                // Watch mode (currently only for CLI)
  filters?: any[],                // SAHCL shape files on which the notifications are evaluated
                                  // Only matching notifications are returned
}
```
All the CLI option flags can be found here:
```
solid-notifications.js list --help
```



#### Processing inbox
If no url is given, it will default to the inbox of the currently authenticated user.
The processing is handled via a passed callback function.
The callback is called for all notifications matching the filters. 
The callback is provided with the quads of the notification.
An example callback function:
```
const f = (quads: RDF.Quads) => { console.log(quads) }
```

#### CLI
This feature is not available for the CLI.

#### Javascript
```
const agent = require('solid-notifications')
const f = () => {}
const options = { callback: f, ...}
agent.processNotifications(options)
```
#### Options
```
{
  callBack: Function              // The callback function
  webId?: string,                 // The resource of which the inbox is used.
  delete?:boolean,                // Notifications are deleted after listing
  watch?: boolean,                // Watch mode
  filters?: any[],                // SAHCL shape files on which the notifications are evaluated
}
```
All the CLI option flags can be found here:
```
solid-notifications.js list --help
```



### Clearing inbox
If no url is given, it will default to the inbox of the currently authenticated user.
#### CLI
```
  solid-notifications [options] clear [clear-options] [url]
```
#### Javascript
```
const agent = require('solid-notifications')
const options = { ...}
agent.clearNotifications(options)
```
#### Options
```
{
  webId?: string,                 // The resource of which the inbox is used.
}
```
All the CLI option flags can be found here:
```
solid-notifications.js clear --help
```



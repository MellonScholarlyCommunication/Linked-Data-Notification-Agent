# Solid notifications
The solution for notifications in a LDP environment.

## Installation
This library can be installed using the following command:
``` npm install @dexagod/ldn-agent ```

If the command line interface is required, it must be installed globally:
``` npm install -g @dexagod/ldn-agent ```
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
const NotificationAgent = require('@dexagod/ldn-agent')
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
const NotificationAgent = require('@dexagod/ldn-agent')
const config = {...}
const agent = new NotificationAgent(config)
```

### Configuration options
```
{
  auth?: any,         // The application should authenticate itself to an identity provider.
  idp?: string,       // The Identity Provider id.
  port?: string,      // The port on which the solid authentication service is hosted locally.
  sender?: string,    // The default sender added to notifications.
  format?: string,    // The format of all output data. Must be an RDF format.
  verbose?: boolean,  // Write logs to command line.
}
```

## Authentication
Commands requiring the client to retrieve data from the inbox, may require the client to authenticate.
In Node and in the browser, a custom fetch must be passed that has all required authentication headers set.
These can be found on the session object of most authentication libraries for Solid.

Authentication on the CLI is done using the new [solid-client-authn](https://github.com/inrupt/solid-client-authn-js) library.
### CLI
The login information can be passed using the configuration file, or using the relevant option flags.
Authentication must be manually turned on through the CLI flags.
### Javascript
The login information can be passed using the configuration file, or in the options of the login function.
```
let session ; // the session object returned by e.g. solid-auth-client
let config ; // The configuration object

const Agent = require('ldn-agent').Agent

let agent = new Agent(config, session.fetch)
```

## Features

### Sending notifications

#### CLI
```
solid-notifications [options] send [send-options] <receiver> <notification>
```
#### Javascript
```
const agent = require('@dexagod/ldn-agent')
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
  solid-notifications send --help
```


#### Fetching inbox
If no url is given, it will default to the inbox of the currently authenticated user.
An iterator is returned containing the notifications present in the inbox.
In the case watch mode is set on the CLI, or the watch function is called in javascript, the inbox will be continuously monitored by the agent using a polling or websocket approach for new notifications. 
In javascript, this will return an asynciterator.

Both iterators return results in the following format:
```
{
  id: string, // the identifier of the notification 
  quads: RDF.Quad[], // the quads of the notification
  filterName: string, // the name of the matched filter
}
```
In case no filters were used, 

#### CLI
```
solid-notifications [options] list [list-options] [url]
```
#### Javascript
```
const agent = require('@dexagod/ldn-agent')
const options = {...}
// One time fetching of all notifications
const iterator = agent.listNotifications(options)
// watching the inbox continuously
const asynciterator = agent.watchNotifications(options)

```
#### Options
```
{
  uri?: string,                 // The resource of which the inbox is used.
  format?: string,                // The format in which notifications are emitted
  delete?:boolean,                // Notifications are deleted after listing
  watch?: boolean,                // Watch mode (currently only for CLI)
  filters?: any[],                // An object implementing the Filter interface. 
}
```
All the CLI option flags can be found here:
```
solid-notifications list --help
```

Filters:

The passed filters are required to implement the Filter interface
```
{
  name: string,
  shape?: string,
  shapeFileURI?: string,
}
```
The returned notifications will return the names of the filters they match.



### Clearing inbox
If no url is given, it will default to the inbox of the currently authenticated user.
#### CLI
```
  solid-notifications [options] clear [clear-options] [url]
```
#### Javascript
```
const agent = require('@dexagod/ldn-agent')
const options = { ...}
agent.clearNotifications(options)
```
#### Options
```
{
  uri?: string,                 // The resource of which the inbox is used.
}
```
All the CLI option flags can be found here:
```
solid-notifications clear --help
```



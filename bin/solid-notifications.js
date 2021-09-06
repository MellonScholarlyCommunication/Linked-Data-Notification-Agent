const { Agent } = require("../dist/index.js")
const program = require('commander');
const { readFileSync } = require("fs");
const { quadsToString } = require("../dist/Utils/util.js");
const getResourceAsString = require("@dexagod/rdf-retrieval").getResourceAsString
const login = require('./solid-login')


function mapFlags (options) {
  // Fetch the config file and merge with the passed options
  if (options.config) {
    const config = fetchConfig(options.config)
    options = {...config, ...options}
  }
  if (options.identityProvider) options.idp = options.identityProvider
  options.cli = true;
  return options
}

program
  .storeOptionsAsProperties(false)
  .passCommandToAction(false)
  .name("solid-notifications")
  .version('0.0.1')
  .option('-c, --config <path>', 'Configuration file path')
  .option('-A, --authenticated', 'Use Solid authentication (opens browser window to login from).')
  .option('-p, --port <string>', 'The port on which the local browser window is opened to login to the Solid data pod')
  .option('-idp, --identity-provider <string>', 'Login identity provider')
  .option('-v, --verbose', 'Verbose')

  // for processing options
  // .option('-w, --watch', 'run the program in watch mode')

  .command('send <receiver> <notification> [mapping...]')
  .option('-f, --file', 'Notification is a path to the notification file.')
  .option('-t, --template', 'Notification is a notification template that needs to be mapped.')
  .option('-s, --sender <string>', 'Sender of the notification.')
  .option('-ict, --input-content-type [type]', 'Content-type of the passed notification (This option is not required when using a tempate).\n\
                                          In the case of a text/plain content type, the base notification is structured as <> <activitystreams:content> <text>. ' , 'text/plain')
  .option('-oct, --output-content-type [type]', 'Content-type of the notification publised to the inbox.\nRDF conversions are handled automatically.', 'application/ld+json')                                          
  .option('--cc [string...]', 'Carbon copy contacts to be added to notification.') // Cannot use -cc -> result does not come through?? BUG IN COMMANDER??
  .option('--bcc [string...]', 'Blind carbon copy contacts to be added to notification.')
  .description('Send a notification to a receiver. The notification can be passed as a string / object, as a file, or as a template with a mapping to complete the template.')
  .action(async (receiver, notification, mapping, flags) => {    

    let session = program.opts().authenticated ? await login(program.opts().idp, null, parseInt(program.opts().port) || 3001) : null
    let fetchFunc = session && session.fetch ? session.fetch : null;
    let config = mapFlags(program.opts());
    const agent = new Agent(fetchFunc, config.verbose)
    notification = flags.file 
      ? getResourceAsString(notification)
      : notification
    const options = {
      from: flags.sender,
      to: [receiver],
      notification,
      isTemplate: flags.template,
      notification_mapping: mapping,
      cc: flags.cc && (Array.isArray(flags.cc) ? flags.cc : [flags.cc]),
      bcc: flags.bcc && (Array.isArray(flags.bcc) ? flags.bcc : [flags.bcc]),
      contentType: flags.inputContentType,
      contentTypeOutput: flags.outputContentType,
    }
    await agent.send(options)
  })

program
  .command('clear [uri]')
  .option('-f, --filter <filter...>', 'Only notifications matching all filters present will be cleared from the inbox.')
  .description('Delete all notifications present in the inbox linked by the uri resource matching the passed filter options. \
  Requires the user to be authenticated to be able to access the uri resource and associated inbox. \
  If no uri parameter is provided, the inbox of the profile associated with the webId will be used.')
  .action(async (uri, flags) => {

    let session = program.opts().authenticated ? await login(program.opts().idp, null, parseInt(program.opts().port) || 3001) : null
    let fetchFunc = session && session.fetch ? session.fetch : null;

    if (!uri) uri = session && session.info && session.info.webId
    let config = mapFlags(program.opts());

    const agent = new Agent(fetchFunc, config.verbose)
    const options = { uri: uri, ...flags }
    await agent.clear(options)
  })

program
  .command('list [uri]')
  .description('List all notifications present in the inbox linked by the uri. In case no URI is given, the webId of the active Solid session is used.')
  .option('-w, --watch', 'Enable watch mode.')
  .option('-f, --filter <filter...>', 'Only list notifications matching the given filters.')
  .option('-F, --format <format>', 'Format of the logged notifications. If no format is given, quads are returned joined by newlines.')
  .option('-D, --delete', 'Delete listed notifications upon retrieval.')
  .option('-n, --notify', 'System notification')
  
  .description('List the notifications in the resource inbox')
  .action(async (uri, flags) => {

    let session = program.opts().authenticated ? await login(program.opts().idp, null, parseInt(program.opts().port) || 3001) : null
    let fetchFunc = session && session.fetch ? session.fetch : null;

    if (!uri) uri = session && session.info && session.info.webId
    let config = mapFlags(program.opts());
    
    const agent = new Agent(fetchFunc, config.verbose)
    const options = { uri: uri, ...flags }

    if (flags.watch) {
      // Watch mode
      const notificationIterator = await agent.watch({...options}) // Iterator< { id: string, quads: RDF.Quad[] } >
      notificationIterator.on('readable', () => {
        let notification;
        while (notification = notificationIterator.read())
          log(notification, options.format)
      });
    } else {
      const notificationIterator = await agent.list({...options}) // Iterator< { id: string, quads: RDF.Quad[] } >
      for (let notification of Array.from(notificationIterator)) {
        log(notification, options.format)
      }  
    }
  })

program.parse(process.argv)


function fetchConfig(configPath) {
  return JSON.parse(readFileSync(configPath))
}

async function log (notification, format) {
  const quads = notification.quads
  let notificationString;
  format = format || "text/turtle"
  notificationString = await quadsToString(quads, format);
  const notificationText = `\nNotification:\n${notificationString}\n`
  // winston.log('info', notificationText) -> refactor this to only show message?
  console.log(notificationText)
  return notificationString
}


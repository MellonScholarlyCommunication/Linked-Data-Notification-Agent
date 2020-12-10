const { NotificationHandler } = require("../dist/index.js")
const program = require('commander');
const { readFileSync } = require("fs");

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
  .option('-u, --username <string>', 'Login username')
  .option('-p, --password <string>', 'Login password')
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
    // program.opts() contains the global flags, that are equal to the constructor options for the notification handler.9
    const nh = new NotificationHandler(mapFlags(program.opts()))
    const options = {
      from: flags.sender,
      to: [receiver],
      notification,
      isFile: flags.file,
      isTemplate: flags.template,
      notification_mapping: mapping,
      cc: flags.cc && (Array.isArray(flags.cc) ? flags.cc : [flags.cc]),
      bcc: flags.bcc && (Array.isArray(flags.bcc) ? flags.bcc : [flags.bcc]),
      contentType: flags.inputContentType,
      contentTypeOutput: flags.outputContentType,
    }
    await nh.sendNotification(options)
  })

program
  .command('clear [uri]')
  .option('-f, --filter <filter...>', 'Only notifications matching all filters present will be cleared from the inbox.')
  .description('Delete all notifications present in the inbox linked by the uri resource matching the passed filter options. \
  Requires the user to be authenticated to be able to access the uri resource and associated inbox. \
  If no uri parameter is provided, the inbox of the profile associated with the webId will be used.')
  .action(async (uri, flags) => {
    const nh = new NotificationHandler(mapFlags(program.opts()))
    await nh.login()
    const options = {
      webId: uri, 
      filters:flags.filter
    }
    await nh.clearNotifications(options)
  })

program
  .command('list [uri]')
  .option('-w, --watch', 'Enable watch mode.')
  .option('-f, --filter <filter...>', 'Only list notifications matching the given filters.')
  .option('-F, --format <format>', 'Format of the logged notifications. If no format is given, quads are returned joined by newlines.')
  .option('-D, --delete', 'Delete listed notifications upon retrieval.')
  
  .description('Send a notification to the inbox of the selected resource')
  .action(async (uri, flags) => {
    const nh = new NotificationHandler(mapFlags(program.opts()))
    await nh.login()
    const options = {
      webId: uri, 
      format: flags.format, 
      delete: flags.delete, 
      watch: flags.watch,
      filters: flags.filter
    }
    await nh.listNotifications(options)
  })

program.parse(process.argv)


function fetchConfig(configPath) {
  return JSON.parse(readFileSync(configPath))
}
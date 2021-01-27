import { Configuration } from './../Utils/util';
import { NotificationMetadata, streamToQuads, quadsToString } from '../Utils/util';
import * as RDF from 'rdf-js';
import * as df from '@rdfjs/data-model';
import ns from '../NameSpaces';
import SolidError from '../Utils/SolidError';
import rdfParser from 'rdf-parse';
import { loadResourceText } from '../Utils/FileUtils';
const streamifyString = require('streamify-string');

const BASEIRI = "urn:Notification"

export default async function generateNotification(auth: any, config: Configuration, notificationData: NotificationMetadata) : Promise<string> {  
  // Extract and parse the notification body
  let notificationQuads = await parseNotificationBody(auth, notificationData); 

  const sender = notificationData.from || config.sender
  const senders = Array.isArray(sender) ? sender : [sender]

  // Add the from, to, cc and bcc fields 
  for (const id of senders || []) {
    if (id) notificationQuads.push(df.quad(df.namedNode(BASEIRI), df.namedNode(ns.dct('creator')), df.namedNode(id)))
  }
  for (const id of notificationData.to || []) {
    if (id) notificationQuads.push(df.quad(df.namedNode(BASEIRI), df.namedNode(ns.as('to')), df.namedNode(id)))
  }
  for (const id of notificationData.cc || []) {
    if (id) notificationQuads.push(df.quad(df.namedNode(BASEIRI), df.namedNode(ns.as('cc')), df.namedNode(id)))
  }
  for (const id of notificationData.bcc || []) {
    if (id) notificationQuads.push(df.quad(df.namedNode(BASEIRI), df.namedNode(ns.as('bcc')), df.namedNode(id)))
  }

  const contentType = notificationData.contentTypeOutput
  try {
    return quadsToString(notificationQuads, contentType)
  } catch (e) {
    throw new SolidError(`Error serializing notification body\n${e.message}`, 'Serialization')
  }
} 

async function parseNotificationBody(auth: any, notificationData: NotificationMetadata) : Promise<Array<any>> {
  let notificationString: string;

  // Try parsing the notification parameter, retrieving the notification file, or retrieving and completing the passed template.
  try {
    if (notificationData.notification) {
      notificationString = notificationData.notification;
    } else if (notificationData.notification_file) {
      notificationString = await loadResourceText(auth, notificationData.notification_file)
    } else if (notificationData.notification_template && notificationData.notification_mapping) {
      throw new Error('Templates have not yet been implemented in this version.')
    } else {
      throw new SolidError('No valid notification was provided. Please use --help to find the available methods to pass a notification to the program.');
    }
    
    // Convert the notification into RDF quads. In the case of a plain text notification, wrap it as an activitystream2.0 content.
    if (notificationData.contentType === "text/plain") {
      return new Promise((resolve, reject) => { resolve(buildNotificationWithText(notificationString)) })
    } else {
      const textStream = streamifyString(notificationString);
      const parsedStream = rdfParser.parse(textStream, {contentType: notificationData.contentType, baseIRI: BASEIRI})
      return streamToQuads(parsedStream);
    }
  } catch (e) {
    throw new SolidError(`Could not parse the notification.\n${e}`, e.name || "Notification parsing")
  }
}

function buildNotificationWithText(text: string) : Array<any> {
  return ([
    df.quad(df.namedNode(BASEIRI), df.namedNode(ns.as('content')), df.literal(text, df.namedNode(ns.xsd('string'))))
  ])
}
  


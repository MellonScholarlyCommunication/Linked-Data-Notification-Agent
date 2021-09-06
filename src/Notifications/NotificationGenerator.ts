import { NotificationData, streamToQuads, quadsToString } from '../Utils/util';
import * as RDF from 'rdf-js';
import * as df from '@rdfjs/data-model';
import ns from '../NameSpaces';
import CustomError from '../Utils/CustomError';
import rdfParser from 'rdf-parse';
import { loadResourceText } from '../Utils/FileUtils';
const streamifyString = require('streamify-string');

const DEFAULTCONTENTTYPE = 'text/turtle'

export default async function generateNotification(fetch: any, data: NotificationData) : Promise<string> {  
  // Extract and parse the notification body
  let notificationQuads = await parseNotificationBody(fetch, data); 

  const sender = data.from
  const senders = sender ? (Array.isArray(sender) ? sender : [sender]) : []

  // Add the from, to, cc and bcc fields 
  for (const id of senders || []) {
    if (id) notificationQuads.push(df.quad(df.namedNode(''), df.namedNode(ns.dct('creator')), df.namedNode(id)))
  }
  for (const id of data.to || []) {
    if (id) notificationQuads.push(df.quad(df.namedNode(''), df.namedNode(ns.as('to')), df.namedNode(id)))
  }
  for (const id of data.cc || []) {
    if (id) notificationQuads.push(df.quad(df.namedNode(''), df.namedNode(ns.as('cc')), df.namedNode(id)))
  }
  for (const id of data.bcc || []) {
    if (id) notificationQuads.push(df.quad(df.namedNode(''), df.namedNode(ns.as('bcc')), df.namedNode(id)))
  }

  const contentType = data.contentType
  try {
    return quadsToString(notificationQuads, contentType)
  } catch (e: any) {
    throw new CustomError(`Error serializing notification body\n${e.message}`, 'Serialization')
  }
} 

async function parseNotificationBody(fetch: any, data: NotificationData) : Promise<Array<any>> {
  // Try parsing the notificparseNotificationBodyation parameter, retrieving the notification file, or retrieving and completing the passed template.
  try {
    let notificationString : string;
    if (data.filePath) {
      notificationString = await loadResourceText(fetch, data.filePath)
    } else if (data.body) {
      notificationString = data.body
    } else {
      throw new CustomError('No notification body or file was passed.');
    }
    
    // Convert the notification into RDF quads. In the case of a plain text notification, wrap it as an activitystream2.0 content.
    if (data.inputContentType === "text/plain") {
      return new Promise((resolve, reject) => { resolve(buildNotificationWithText(notificationString)) })
    } else {
      const textStream = streamifyString(notificationString);
      const parsedStream = rdfParser.parse(textStream, {contentType: data.contentType || DEFAULTCONTENTTYPE})
      return streamToQuads(parsedStream);
    }
  } catch (e: any) {
    throw new CustomError(`Could not parse the notification.\n${e}`, e.name || "Notification parsing")
  }
}

function buildNotificationWithText(text: string) : Array<any> {
  return ([
    df.quad(df.namedNode(''), df.namedNode(ns.rdf('type')), df.namedNode(ns.as('Note'))),
    df.quad(df.namedNode(''), df.namedNode(ns.as('content')), df.literal(text, df.namedNode(ns.xsd('string')))),
  ])
}
  


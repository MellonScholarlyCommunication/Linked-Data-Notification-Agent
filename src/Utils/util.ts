
import CustomError from './CustomError';
import ns from '../NameSpaces';
import * as RDF from 'rdf-js';
import rdfSerializer from 'rdf-serialize';
import { SystemNotificationHander } from '../SystemNotifications/SystemNotificationhandler';

const streamifyArray = require('streamify-array');
const stringifyStream = require('stream-to-string');

export interface Notification {
  "@context": any,
  "@type"?: string;
  subject?: any,
  object: any,
  target?: any,
}

export interface NotificationData {
  context?: any;
  body: string,
  filePath: string,
  from: string[],
  to: string[],
  cc?: string[],
  bcc?: string[],
  inputContentType: string,
  contentType: string,
}

export interface ListingOptions {
  uri?: string, 
  inbox?: string, 
  delete?: boolean, 
  notify?: boolean,
  ignore?: string[],
  filters: Filter[],
}

export interface Filter {
  name: string,
  shape?: string,
  shapeFileURI?: string,
}

export interface InboxNotification {id: string; quads: RDF.Quad[]; last_modified?: Date, validated_for?: Filter[]}

export const streamToQuads = (stream : RDF.Stream) : Promise<RDF.Quad[]> => {
  return new Promise((resolve, reject) => { 
    const quads : RDF.Quad[] = []
    stream
    .on('data', (quad) => {quads.push(quad)})
    .on('error', (error) => reject(new CustomError(`Error parsing notification body.\n${error.message}`, "Notification parsing")))
    .on('end', () => resolve(quads));
  })
}

export const quadsToString = (quads: RDF.Quad[], contentType?: string) : string => {
  contentType = contentType || 'application/ld+json'
  const notificationQuadStream = streamifyArray(quads);
  const notificationTextStream = rdfSerializer.serialize(notificationQuadStream, { contentType: contentType });
  return stringifyStream(notificationTextStream);
}



/**
 * Converts a WhatWG streams to Node streams if required.
 * Returns the input in case the stream already is a Node stream.
 * @param {ReadableStream} body
 * @returns {NodeJS.ReadableStream}
 */
export function toReadableStream(body: ReadableStream | null): NodeJS.ReadableStream {
  return require('is-stream')(body) ? body : require('web-streams-node').toNodeReadable(body);
}


/**
 * Send system notifications for both node and browser
 * @param quads The notification quads
 * @param formattingFunction A formatting function to format the quads into a notification
 */
export async function notifySystem(quads: RDF.Quad[], filters?: Filter[], date?: Date) {
  const f = async function (quads: RDF.Quad[]) {
    let sender = null;
    let contents = null;

    for (let quad of quads) {
      if (quad.predicate.value === ns.dct('creator')) {
        sender = quad.object.value;
      }
      if (quad.predicate.value === ns.as('content')) {
        contents = quad.object.value;
      } 
    }
    
    if (!contents) {
      contents = await quadsToString(quads, 'text/turtle');
    }date
    if (date) {
      contents = `Received: ${date}\n` + contents
    }
    if (filters && filters.length) {
      contents = `Filter: ${filters.map(f => f.name).join(', ')}\n` + contents
    }
    if (sender) {
      contents = `Sender: ${sender}\n` + contents
    }
    return contents
  }
  
  const message = await f(quads)

  new SystemNotificationHander().notify({
    title: 'Solid notification',
    message,
  });
}
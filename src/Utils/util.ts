
import SolidError from './SolidError';
import ns from '../NameSpaces';
import * as RDF from 'rdf-js';
import rdfSerializer from 'rdf-serialize';
import { SystemNotificationHander } from '../SystemNotifications/SystemNotificationhandler';

const streamifyArray = require('streamify-array');
const streamifyString = require('streamify-string');
const stringifyStream = require('stream-to-string');

export interface LoginOptions {
  username?: string;
  password?: string;
  idp?: string;
}

export interface NotificationHandlerOptions {
  config?: string,
  username?: string,
  password?: string,
  idp?: string,
  cli?: boolean,
  verbose?: boolean,
  format?: string,
  watch?: boolean,
  auth?: any
}

export interface ConfigFileOptions {
  username?: string,
  password?: string,
  idp?: string,
  sender?: string,
  popup?: string,
  verbose?: boolean,
  notify?: boolean,
  format?: string,
}

export interface Configuration {
  config?: string,
  username?: string,
  password?: string,
  idp?: string,
  sender?: string,
  popup?: string,
  cli?: boolean,
  verbose?: boolean,
  notify?: boolean,
  format?: string,
  watch?: boolean,
  auth?: any,
}

export interface Notification {
  "@context": any,
  "@type"?: string;
  subject?: any,
  object: any,
  target?: any,
}

export interface NotificationMetadata {
  context?: any;
  from: string[],
  to: string[],
  cc?: string[],
  bcc?: string[],
  contentType: string,
  contentTypeOutput: string,
  notification?: any,
  notification_template?: any,
  notification_mapping?: any,
  notification_file?: any,

}


export interface InboxNotification {id: string; quads:RDF.Quad[]}

export const streamToQuads = (stream : RDF.Stream) : Promise<RDF.Quad[]> => {
  return new Promise((resolve, reject) => { 
    const quads : RDF.Quad[] = []
    stream
    .on('data', (quad) => {quads.push(quad)})
    .on('error', (error) => reject(new SolidError(`Error parsing notification body.\n${error.message}`, "Notification parsing")))
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
export async function notifySystem(quads: RDF.Quad[], formattingFunction?: Function) {
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
    }
    if (sender) {
      contents = `Sender: ${sender}\n` + contents
    }
    return contents
  }
  
  const message = formattingFunction ? await formattingFunction(quads) : await f(quads)

  new SystemNotificationHander().notify({
    title: 'Solid notification',
    message,
  });
}
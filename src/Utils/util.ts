import { readFileSync } from "fs";
import SolidError from './SolidError';
import ns from '../NameSpaces';
import * as jsonld from 'jsonld'
import { Stream } from "stream";
import * as RDF from 'rdf-js';
import rdfSerializer from 'rdf-serialize';

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


export const parseFile = (filePath: string): any => {
}

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
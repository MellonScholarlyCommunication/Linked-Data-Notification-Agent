import CustomError from './CustomError';
import ns from '../NameSpaces';
import * as N3 from 'n3';
import rdfParser from 'rdf-parse';
import { storeStream } from 'rdf-store-stream';
import { createFetchError } from './CustomError';
import { isBrowser } from 'browser-or-node';
import { fstat, readFileSync } from 'fs';
import * as RDF from 'rdf-js';
import { streamToQuads, toReadableStream } from './util';
import { rejects } from 'assert';
import winston from 'winston';
const streamifyString = require('streamify-string');
const ctParser = require('content-type')

const INBOX_LINK_REL = ns.ldp('inbox')

export async function loadResourceText(fetch: any, path: string) : Promise<string> {
  let remoteURL = true;
  try{ new URL(path) }
  catch (e) {remoteURL = false}


  if (remoteURL) {
    const response = await getFile(fetch, path, "Loading resource")
    return await response.text();
  } else {
    if (isBrowser) {
      throw new Error('Local file paths in a browser environment are not yet supported')
    } else {
      return (await readFileSync(path, {encoding: 'utf-8'}))
    }
  }
}

export async function getFile(fetch: any, uri: string, operationName?: string) {
  winston.log('verbose', 'getting ' + uri)
  const headers =  { Link: "<meta.rdf>;rel=" + INBOX_LINK_REL }
  const response = await fetch(uri, {
    method: 'GET',
    headers,
  },
  operationName)
  if (!response) {
    throw new CustomError(`An error happened during the ${'GET'} operation on resource: ${uri}`, operationName)
  } else if (response.status !== 200) {
    throw createFetchError(response.status, uri, operationName)
  }
  return response;
}

export async function postFile(fetch: any, uri: string, body: string, contentType: string, operationName?: string) {
  winston.log('verbose', 'posting ' + uri + ' with body: ' + (contentType === 'application/ld+json' ? JSON.stringify(JSON.parse(body)) : body))
  const headers =  { 'Content-Type': contentType }
  const response = await fetch(uri, {
    method: 'POST',
    headers,
    body,
  },
  operationName)
  if (!response) {
    throw new CustomError(`An error happened during the ${"Post"} operation on resource: ${uri}`, operationName)
  } else if (response.status !== 201 || response.status === 202) {
    throw createFetchError(response.status, uri, operationName)
  }
  return response;
}

export async function deleteFile(fetch: any, uri: string, operationName?: string) {
  winston.log('verbose', 'deleting ' + uri)
  const response = await fetch(uri, {
    method: 'DELETE',
  },
  operationName)
  if (!response) {
    throw new CustomError(`An error happened during the ${'DELETE'} operation on resource: ${uri}`, operationName)
  } else if (response.status !== 200) {
    throw createFetchError(response.status, uri, operationName)
  }
  return response;
}

export async function parseResponseToStore(id: string, response: any): Promise<N3.Store> {
  const content_type = parseContentType(response.headers)
  // TODO:: TRY TO GUESS CONTENT TYPE / LOOK AT FILE EXTENSION?
  const responseText = await response.text()
  const textStream = await streamifyString(responseText);
  try {
    return new Promise((resolve, reject) => {
      const store = new N3.Store()
      rdfParser.parse(textStream, { contentType: content_type, baseIRI: id  })
      .on('data', (quad) => { store.addQuad(quad)} )
      .on('error', (error) => reject(error))
      .on('end', () => resolve(store))
    })
  } catch (e: any) {
    throw new CustomError(`Error parsing resource at ${response.url} \n ${e.message}`, 'ParseError')
  }
}

export async function parseResponseToQuads(response: any): Promise<RDF.Quad[]> {
  const content_type = parseContentType(response.headers)
  // TODO:: TRY TO GUESS CONTENT TYPE / LOOK AT FILE EXTENSION?
  try {
    return new Promise((resolve, reject) => {
      const quads : RDF.Quad[] = []
      const inputStream = toReadableStream(response.body)
      rdfParser.parse(inputStream, { contentType: content_type })
      .on('data', (quad) => quads.push(quad))
      .on('error', (error) => reject(error))
      .on('end', () => resolve(quads))
    })
  } catch (e: any) {
    throw new CustomError(`Error parsing resource at ${response.url} \n ${e.message}`, 'ParseError')
  }
}

export async function parseResponseToRDFStream(response: any) {
  const content_type = parseContentType(response.headers)
  // TODO:: TRY TO GUESS CONTENT TYPE / LOOK AT FILE EXTENSION?
  const inputStream = toReadableStream(response.body)
  return rdfParser.parse(inputStream, { contentType: content_type })
}
 
 
export async function getQuadArrayFromFile(fetch: any, id: string){
  const response = await getFile(fetch, id);
  return parseResponseToQuads(response);
}

export async function getStoreFromFile(fetch: any, id: string) {
  const response = await getFile(fetch, id);
  return parseResponseToStore(id, response);
}

export function parseContentType(headers: any) {
  const contentTypeHeaderValue = headers.get('content-type')
  const parsedContentTypeHeader = ctParser.parse(contentTypeHeaderValue)
  if (!parsedContentTypeHeader || !parsedContentTypeHeader.type) throw new CustomError('Cannot parse server response. Server response did not contain a content-type header.')
  return parsedContentTypeHeader.type
}
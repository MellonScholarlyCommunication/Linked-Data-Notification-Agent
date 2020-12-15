import SolidError from './SolidError';
import ns from '../NameSpaces';
import * as N3 from 'n3';
import rdfParser from 'rdf-parse';
import { storeStream } from 'rdf-store-stream';
import { createFetchError } from './SolidError';
import { isBrowser } from 'browser-or-node';
import { fstat, readFileSync } from 'fs';
import { Level, log } from './Logger';getFile
import * as RDF from 'rdf-js';
import { streamToQuads, toReadableStream } from './util';
import { rejects } from 'assert';
const streamifyString = require('streamify-string');

const INBOX_LINK_REL = ns.ldp('inbox')
// TODO: ADD AUTHORIZATION HEADERS BASED ON SENDER AND CURRENT AUTH
// Authorization: "Bearer "

export async function loadResourceText(auth: any, path: string) : Promise<string> {
  let remoteURL = true;
  try{ new URL(path) }
  catch (e) {remoteURL = false}


  if (remoteURL) {
    const response = await getFile(auth, path, "Loading resource")
    return await response.text();
  } else {
    if (isBrowser) {
      throw new Error('Local file paths in a browser environment are not yet supported')
    } else {
      return (await readFileSync(path, {encoding: 'utf-8'}))
    }
  }
}

export async function getFile(auth: any, uri: string, operationName?: string) {
  log(Level.Log, 'getting ' + uri)
  const headers =  { Link: "<meta.rdf>;rel=" + INBOX_LINK_REL }
  const response = await fetch(auth, uri, {
    method: 'GET',
    headers,
  },
  operationName)
  if (!response) {
    throw new SolidError(`An error happened during the ${'GET'} operation on resource: ${uri}`, operationName)
  } else if (response.status !== 200) {
    throw createFetchError(response.status, operationName)
  }
  return response;
}

export async function postFile(auth: any, uri: string, body: string, contentType: string, operationName?: string) {
  log(Level.Log, 'posting ' + uri + 'with' + body)
  const headers =  { 'Content-Type': contentType }
  const response = await fetch(auth, uri, {
    method: 'POST',
    headers,
    body,
  },
  operationName)
  if (!response) {
    throw new SolidError(`An error happened during the ${"Post"} operation on resource: ${uri}`, operationName)
  } else if (response.status !== 201 || response.status === 202) {
    throw createFetchError(response.status, operationName)
  }
  return response;
}

export async function deleteFile(auth: any, uri: string, operationName?: string) {
  log(Level.Log, 'deleting ' + uri)
  const response = await fetch(auth, uri, {
    method: 'DELETE',
  },
  operationName)
  if (!response) {
    throw new SolidError(`An error happened during the ${'DELETE'} operation on resource: ${uri}`, operationName)
  } else if (response.status !== 200) {
    throw createFetchError(response.status, operationName)
  }
  return response;
}

async function fetch(auth: any, uri: string, options: any, operationName?: string) {
  if (!auth) throw new SolidError('Please make sure the user is authenticated.', 'User not authenticated')
  try {
    return await auth.fetch(uri, options);
  } catch(e) {
    throw new SolidError(e.message, "Fetch error")
  }
}

export async function parseResponseToStore(id: string, response: any): Promise<N3.Store> {
  const content_type = response.headers.get('content-type')
  if (!content_type) throw new SolidError('Cannot parse server response. Server response did not contain a content-type header.')
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
  } catch(e) {
    throw new SolidError(`Error parsing resource at ${response.url} \n ${e.message}`, 'ParseError')
  }
}

export async function parseResponseToQuads(response: any): Promise<RDF.Quad[]> {
  const content_type = response.headers.get('content-type')
  if (!content_type) throw new SolidError('Cannot parse server response. Server response did not contain a content-type header.')
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
  } catch(e) {
    throw new SolidError(`Error parsing resource at ${response.url} \n ${e.message}`, 'ParseError')
  }
}
 
export async function getQuadArrayFromFile(auth: any, id: string){
  const response = await getFile(auth, id);
  return parseResponseToQuads(response);
}

export async function getStoreFromFile(auth: any, id: string) {
  const response = await getFile(auth, id);
  return parseResponseToStore(id, response);
}
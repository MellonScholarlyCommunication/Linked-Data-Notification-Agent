import { getFile, parseContentType } from '../Utils/FileUtils';
import { createReadStream, readFileSync } from 'fs';
import { isBrowser } from 'browser-or-node';
import rdfParser from 'rdf-parse';
import * as RDF from 'rdf-js';
import CustomError from "../Utils/CustomError";
const factory = require('rdf-ext')

export async function getResourceAsText(fetch: any, path: string) {
  if (isRemote(path)) {
    return await getRemoteResourceAsText(fetch, path);
  } else {
    if (!isBrowser) {
      return await getLocalResourceAsText(path)
    }
    throw new CustomError('Local file paths in a browser environment are not yet supported')
  }
}

export async function getResourceAsTextStream(fetch: any, path: string) {
  if (isRemote(path)) {
    return await getRemoteResourceAsTextStream(fetch, path);
  } else {
    if (!isBrowser) {
      return await getLocalResourceAsTextStream(path)
    }
    throw new CustomError('Local file paths in a browser environment are not yet supported')
  }
}

export async function getResourceAsRDFStream(fetch: any, path: string, content_type?: string) {
  if (isRemote(path)) {
    return await getRemoteResourceAsRDFStream(fetch, path);
  } else {
    if (!isBrowser) {
      return await getLocalResourceAsRDFStream(path, content_type)
    }
    throw new CustomError('Local file paths in a browser environment are not yet supported')
  }
}
export async function getResourceAsQuadArray(fetch: any, path: string, content_type?: string) {
  if (isRemote(path)) {
    return await getRemoteResourceAsQuadArray(fetch, path);
  } else {
    if (!isBrowser) {
      return await getLocalResourceAsQuadArray(path, content_type)
    }
    throw new CustomError('Local file paths in a browser environment are not yet supported')
  }
}


function isRemote(path: string) {
  let remoteURL = true;
  try{ new URL(path) }
  catch (e) {remoteURL = false}
  return remoteURL
}

// Functions to fetch different formats of a local resourcevs ReadableStream
const getLocalResourceAsText = async (path: string) => { return readFileSync(path, {encoding: 'utf-8'}) }

const getLocalResourceAsTextStream = async (path: string) => { return createReadStream(path) }

const getLocalResourceAsRDFStream = async (path: string, content_type?: string) => { 
  const textStream = await getLocalResourceAsTextStream(path);
  return rdfParser.parse(textStream, { path: path, contentType: content_type , baseIRI: path});
}

const getLocalResourceAsQuadArray = async (path: string, content_type?: string) => { 
  const rdfStream = await getLocalResourceAsRDFStream(path, content_type)
  return RDFStreamToQuads(rdfStream)
}

// Functions to fetch different formats of a local resource
const getRemoteResourceAsText = async (fetch: any, uri: string) : Promise<string> => { 
  const response = await getFile(fetch, uri) 
  return response.text();
}

const getRemoteResourceAsTextStream = async (fetch: any, uri: string) : Promise<ReadableStream> => { 
  const response = await getFile(fetch, uri) 
  return response.body;
 }
const getRemoteResourceAsRDFStream = async (fetch: any, uri: string) => { 
  const response = await getFile(fetch, uri) 
  const textStream = response.body;
  const content_type = parseContentType(response.headers)
  if (!content_type) throw new CustomError('Cannot parse server response. Server response did not contain a content-type header.')
  return rdfParser.parse(textStream, { path: uri, contentType: content_type , baseIRI: uri});
}
const getRemoteResourceAsQuadArray = async (fetch: any, uri: string) => { 
  const rdfStream = await getRemoteResourceAsRDFStream(fetch, uri)
  return RDFStreamToQuads(rdfStream)
}





export const RDFStreamToQuads = (stream : RDF.Stream) : Promise<RDF.Quad[]> => {
  return new Promise((resolve, reject) => { 
    const quads : RDF.Quad[] = []
    stream
    .on('data', (quad) => {quads.push(quad)})
    .on('error', (error) => reject(new CustomError(`Error parsing notification body.\n${error.message}`, "Notification parsing")))
    .on('end', () => resolve(quads));
  })
}

export const getResourceAsDataset = async (fetch: any, path: string, content_type?: string) => {
  const quadStream = await getResourceAsRDFStream(fetch, path, content_type)
  return await getDataset(quadStream)

}

export const getDataset = async (quadStream: RDF.Stream) => {  
  return await factory.dataset().import(quadStream)
}
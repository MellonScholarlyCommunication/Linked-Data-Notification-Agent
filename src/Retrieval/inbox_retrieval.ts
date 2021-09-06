import { getFile, parseResponseToRDFStream } from '../Utils/FileUtils';
import ns from '../NameSpaces';
import CustomError from '../Utils/CustomError';
import { getResourceAsQuadArray, getResourceAsRDFStream } from './retrieval';
import * as RDF from 'rdf-js';
import * as winston from 'winston';

const INBOX_LINK_REL = ns.ldp('inbox')

export interface NotificationInfo {id: string; last_modified?: Date}
export interface NotificationContent {id: string; last_modified?: Date, quads: RDF.Quad[]}


/**
 * Function that retrieves the ids of all notifications in the inbox of the passed inbox uri or the inbox advertised by the passed uri.
 * @param fetch {any} (authenticated) fetch function
 * @param options {uri?: string, inbox?: string} the inbox uri or a resource uri that has an inbox advertised
 * @returns Promise<Map<string, {id: string, last_modified`?: Date}>> notification ids and last modified dates
 */
export async function getNotificationsInfo(fetch: any, options: {uri?: string, inbox?: string}) {
  let inbox;
  if (options.inbox) inbox = options.inbox
  else if (options.uri) inbox = await discoverInbox(fetch, options.uri);
  if (!inbox) throw new CustomError("Please pass a valid URI or inbox.", "Inbox retrieval")
  return await getInboxNotificationInfo(fetch, inbox);
}

export async function getNotificationContents (fetch: any, info: NotificationInfo): Promise<NotificationContent>{  
  let quads = await getResourceAsQuadArray(fetch, info.id)
  if (!quads) {
    winston.log("warn", "Could not process resource at id: " + info.id)
  }
  return {...info, quads: quads}
}

/**
 * Fetch all resources contained in the inbox LDP Container according to the LDN specification.
 * Notification ids are discovered by matching on the ldp:contains predicate
 * @param fetch {any} (authenticated) fetch function
 * @param inbox {string} uri of the inbox
 * @returns Array<string> notificationIds
 */
async function getInboxNotificationInfo(fetch: any, inbox: string) : Promise<Array<NotificationInfo>> {
  const quadStream = await getResourceAsRDFStream(fetch, inbox)
  return new Promise((resolve, reject) => {
    const notificationIds : Array<string> = []
    const timeMapping = new Map();
    quadStream
      .on('data', (quad:RDF.Quad) => { 
        // Find all notifications through the ldp:contains predicate
        if (quad.predicate.value === ns.ldp("contains") )
          notificationIds.push(quad.object.value)

        // Store potential dct:modified information for sorting purposes
        else if (quad.predicate.value === ns.dct("modified")) 
          timeMapping.set(quad.subject.value, quad.object.value);
      })
      .on('error', (error) => reject(error))
      .on('end', () => {
        let notificationInfo = new Array<NotificationInfo>();
        for (let id of notificationIds)
        {
          let dateString = timeMapping.get(id);
          let date = dateString && new Date(dateString)
          notificationInfo.push(date ? {id, last_modified: date}: {id})
        }
        resolve(notificationInfo)
      })
    }
  )
}


/**
 * Resolves to the LDN Inbox URI for a given resource.
 * @see https://www.w3.org/TR/ldn/#discovery
 * @param uri {string} Resource uri
 * @param webClient {SolidWebClient}
 * @param [resource] {SolidResponse} Optional resource (passed in if you already
 *   have requested the resource and have it handy). Saves making a GET request.
 * @throws {Error} Rejects with an error if the resource has no inbox uri.
 * @return {Promise<string>} Resolves to the inbox uri for the given resource
 */
 export async function discoverInbox (fetch: any, uri: string): Promise<string | null> {
  let response = await getFile(fetch, uri, 'Inbox retrieval')
  if (!response) throw new CustomError(`Could not retrieve inbox of ${uri}.`, 'Inbox retrieval');

  // Check response headers for an inbox link
  const inboxLinkRel = response.headers[INBOX_LINK_REL];
  if (inboxLinkRel) return inboxLinkRel;

  const rdfStream = await parseResponseToRDFStream(response)

  return new Promise((resolve, reject) => {
    rdfStream
        .on('data', (quad) => { 
          if (quad.predicate.value === ns.ldp('inbox')) {
            rdfStream.destroy();
            resolve(quad.object.value);
          }
        })
        .on('error', (error) => reject(error))
        .on('end', () => resolve(null))
  })
}

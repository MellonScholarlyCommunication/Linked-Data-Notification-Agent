import { getFile, getStoreFromFile, parseResponseToStore } from '../Utils/FileUtils';
import * as N3 from 'n3';
import ns from '../NameSpaces';
import SolidError from '../Utils/SolidError';

const INBOX_LINK_REL = ns.ldp('inbox')



export async function getInbox(auth: any, webId?: string) {
  if (!webId) {
    const session = await auth.currentSession();
    webId = session?.webId  
  }
  if (!webId) throw new SolidError("No inbox URI. Please maske sure a uri is passed or you are authenticated.", "Inbox retrieval")
  const inbox = await discoverInbox(auth, webId);
  if (!inbox) throw new SolidError(`Could not find an inbox for resource ${webId}.`, "Inbox retrieval")
  
  const store = await getStoreFromFile(auth, inbox)
  const notifications = await getNotificationIdsFromStore(store, inbox)
  return {
    id: inbox,
    notifications
  }
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
export async function discoverInbox (auth: any, uri: string): Promise<string> {
  let response = await getFile(auth, uri, 'Inbox retrieval')
  if (!response) throw new SolidError(`Could not retrieve inbox of ${uri}.`, 'Inbox retrieval');

  // Check response headers for an inbox link
  const inboxLinkRel = response.headers[INBOX_LINK_REL];
  if (inboxLinkRel) return inboxLinkRel;
  
  const store = await parseResponseToStore(uri, response)
  
  // Retrieve inbox match from RDF store
  const inboxMatches = store.getQuads(uri, ns.ldp('inbox'), null, null)
  for (let match of inboxMatches) {
    if (match.object.termType === "NamedNode")
      return match.object.id
  }
  // No perfect match was found
  throw new SolidError(`Could not retrieve inbox of ${uri}.`, 'Inbox retrieval');
}


async function getNotificationIdsFromStore(store: N3.Store, inbox: string) {
  const containsQuads = await store.getQuads(inbox, ns.ldp('contains'), null, null)
  return containsQuads.map( (quad : N3.Quad) => quad.object.id)
}

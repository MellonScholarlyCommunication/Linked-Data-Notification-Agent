import ns from './NameSpaces';
import { isBrowser, isNode } from "browser-or-node";
import SolidError from './Utils/SolidError';
import { LoginOptions, NotificationMetadata, NotificationHandlerOptions, Configuration, streamToQuads, quadsToString } from './Utils/util';
import { getFile, postFile, deleteFile, getQuadArrayFromFile, parseResponseToStore, getStoreFromFile, parseResponseToQuads } from './Utils/FileUtils';
import * as RDF from 'rdf-js'
import generateNotification from './Notifications/NotificationGenerator';
import { UpdateTracker } from './AutoUpdates/UpdateTracker';
import { setLogOptions, log, Level } from './Utils/Logger';
import * as N3 from 'n3';
import { validate } from './Utils/Validation';
import { loadDataset } from './Retrieval/retrieval'
const streamifyArray = require('streamify-array');

const INBOX_LINK_REL = ns.ldp('inbox')


export class NotificationHandler {
  config: Configuration;
  auth?: any;

  constructor(config: NotificationHandlerOptions) {
    this.config = config;

    // Set the Logger options based on the passed configuration
    setLogOptions(!!this.config?.cli, !!this.config?.verbose)
    
    // Set the auth based on the environment
    this.auth = this.config.auth || isBrowser
    ? require('solid-auth-client')
    : require('solid-auth-cli')

    // Log the config
    log(Level.Log, 'config: ' + JSON.stringify(this.config, null, 2))
  }

  /**
   * Send a notification
   * @param url 
   * @param notification 
   */
  public async sendNotification (notificationData: NotificationMetadata) {
    
    this.checkNotificationData(notificationData);
    
    // Create the notification from the given notification string / file / template and mappings
    const notification = await generateNotification(this.auth, this.config, notificationData);

    const results : any = {}
    const inboxMapping: {id: string, inbox: string}[] = []
    for (const receiverlist of [notificationData.to, notificationData.cc, notificationData.bcc]) {
      if (receiverlist){
        for (let receiver of receiverlist){
          try {
            let inbox = await this.discoverInbox(receiver)
            if (!inbox) throw new SolidError(`The inbox of ${receiver} could not be retrieved.\n`, 'Inbox discovery')
            else inboxMapping.push({ id: receiver, inbox: inbox })
          } catch (e) {
            results[receiver] = new SolidError(`The inbox of ${receiver} could not be retrieved.\n${e.message}`, e.name || 'Inbox discovery error')
          }
        }
      }      
    }
    
    for (let mapping of inboxMapping) {
      const inbox = mapping.inbox
      const receiver = mapping.id
      try {
        const response = await postFile(this.auth, inbox, notification, notificationData.contentTypeOutput, 'Notification posting')
        results[receiver] = response;
      } catch (e) {
        results[receiver] = new SolidError(`Error posting notification to inbox of ${receiver}.\n${e.message}`, e.name || 'Notification posting')
      }

    }
    log(Level.Log, 'Notification sent succesfully')
    return results;
  }


  public async clearNotifications(params: {webId?: string, notificationIds?: string[], filters?: any[]}) {
    const webId = await this.getWebId(params);
    const notificationIds = params.notificationIds?.length ? params.notificationIds : (await this.getInbox(webId))?.notifications
    const failedDeletions = [];
    for (let notificationId of notificationIds) {
      try {
        await deleteFile(this.auth, notificationId)
        log(Level.Log, 'Deleted notification: ' + notificationId)
      } catch (e) {
        failedDeletions.push({id: notificationId, error: e})
        log(Level.Error, 'Failed to delete notification: ' + notificationId)
      }
    }
    log(Level.CLI, 'Finished clearing inbox')
    if (failedDeletions.length) {
      throw new SolidError(`Failed to remove notifications: ${failedDeletions.map(e => e.id).join(', ')}`)
    }
  }

  /**
   * 
   * @param webId 
   * @param format 
   * @param filter 
   */
  public async listNotifications(params?: {webId?: string, format?: string, delete?:boolean, watch?: boolean, filters?: any[],  notificationIds?: [],}) {
    const f = async (quads : RDF.Quad[]) => {
      const format = params?.format || this.config.format || 'text/turtle' // TODO:: maybe have a better way of formatting
      let notificationString;
      notificationString = await quadsToString(quads, format);
      const notificationText = `\nNotification:\n${notificationString}\n`
      log(Level.CLI, notificationText)
      return notificationString
    }
    return this.processNotifications({callBack: f, ...params})
  }

  public async processNotifications(params: {webId?: string, callBack: Function, format?: string, watch?: boolean, notificationIds?: [], filters?: any[]}) {
    if (params.watch) {
      return await this._processWatchNotifications(params);
    } else {
      return await this._processNotifications(params);
    }
  }

  private async _processNotifications(params: {webId?: string, callBack: Function, delete?: boolean, watch?: boolean, notificationIds?: [], filters?: any[]}) {
    const webId = await this.getWebId(params);
    // Check if notifications are specified to be processed. If not, process over all notifications in the inbox.
    const notificationIds = params.notificationIds?.length ? params.notificationIds : (await this.getInbox(webId))?.notifications
    const notifications : any[] = []
    for (let id of notificationIds) {
      const notificationQuads = await this.getNotification(id)
      // Evaluate the callback over the notification quads, and return the results
      let validated = true;
      const notificationQuadStream = await streamifyArray(notificationQuads);
      for (let shapeFile of params.filters || []) {
        const shapeQuadStream = await loadDataset({ path: shapeFile, contentType: 'text/turtle'})  // TODO:: Dynamic content typing for shapes
        if(!validate(notificationQuadStream, shapeQuadStream)) {
          validated = false;
          break;
        }
      }
      if(validated) {
        const result = await params.callBack(notificationQuads)
        notifications.push(result)
        if (params.delete) deleteFile(this.auth, id);
      }
    }
    if (params.delete) this.clearNotifications({notificationIds})
    return await Promise.all(notifications)
  }

  private async _processWatchNotifications(params: {webId?: string, callBack: Function, delete?: boolean, watch?: boolean, notificationIds?: [], filters?: any[]}) {
    const webId = await this.getWebId(params);
    const inbox = await this.discoverInbox(webId)
    
    let processedIds : string[] = []

    // Create the tracker
    const tracker = new UpdateTracker(this.auth)
    tracker.on('update', async (e) => {
      // Inbox is updated
      const inboxStore = await getStoreFromFile(this.auth, inbox);
      const notificationIds = inboxStore.getQuads(inbox, ns.ldp('contains'), null, null).map(quad => quad.object.id)
      // Get the new notification(s)
      const newNotificationsIds = notificationIds.filter(id => processedIds.indexOf(id) === -1)
      
      for (let notificationId of newNotificationsIds) {
        const quads = await getQuadArrayFromFile(this.auth, notificationId)
        params.callBack(quads);
      }
      if (params.delete) this.clearNotifications({notificationIds: newNotificationsIds})
      processedIds = processedIds.concat(newNotificationsIds)
    })
    
    // Subscribe the tracker
    tracker.subscribe(inbox);
  }
  

  /**
   * Check if passed parameters allow to create a notification, to catch errors early in the lifecycle
   * @param notificationData 
   */
  private checkNotificationData(notificationData: NotificationMetadata) {
    if (notificationData.to.length === 0) {
      throw new SolidError('No receiver provided. Provide at least one receiver for the notification')
    } else if (!(notificationData.notification || notificationData.notification_file || (notificationData.notification_template && notificationData.notification_mapping))) {
      throw new SolidError('No notification provided. Provide either a notification object, a notification file, or a notification template file and mapping.')
    }
  }

  /**
   * This function discoveres the inbox associated with the webId, and returns the id of the inbox, as well as the notifications present.
   * @param webId webId of the item to get the inbox from
   */
  private async getInbox(webId?: string, ...filters: any[]) {
    if (!webId) {
      const session = await this.auth.currentSession();
      webId = session?.webId  
    }
    if (!webId) throw new SolidError("No inbox URI. Please maske sure a uri is passed or you are authenticated.", "Inbox retrieval")
    const inbox = await this.discoverInbox(webId);
    if (!inbox) throw new SolidError(`Could not find an inbox for resource ${webId}.`, "Inbox retrieval")
    
    const store = await getStoreFromFile(this.auth, inbox)
    const notifications = await this.getNotificationIdsFromStore(store, inbox)
    return {
      id: inbox,
      notifications
    }
  }

  private async getNotificationIdsFromStore(store: N3.Store, inbox: string) {
    const containsQuads = await store.getQuads(inbox, ns.ldp('contains'), null, null)
    return containsQuads.map( (quad : N3.Quad) => quad.object.id)
  }

  private async getNotification(notificationId: string) : Promise<RDF.Quad[]> {
    return getQuadArrayFromFile(this.auth, notificationId)
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
  private async discoverInbox (uri: string): Promise<string> {
    let response = await getFile(this.auth, uri, 'Inbox retrieval')
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

  private async getWebId(params: any) : Promise<string> {
    let webId = params.webId
    if (!webId) {
      const session = await this.auth?.currentSession()
      webId = session?.webId;
    }
    if (!webId) { throw new SolidError('Please authenticate yourself.')}
    return webId
  }





  // Forwarded from login of auth, this concern should maybe be separated to somewhere else, or require an auth to be passed that has been authenticated already?;
  public async login(loginOpts?: LoginOptions) {
    const uname = loginOpts?.username || this.config.username
    const passwd = loginOpts?.password || this.config.password
    const idp = loginOpts?.idp || this.config.idp

    // If user is already logged in return
    if (await this.auth?.currentSession()) return;
    
    // Try to set a new authentication agent if none has been set
    if (isBrowser) {
      // TODO:: This is probably inadequate?
      const idp = this.config.idp || this.config.idp
      if (!idp) throw new SolidError('No identity provider passed to login via browser. \nPlease pass an identity provider in the config file or or in the parameter of the login function.', 'LoginError')
      try { await this.auth?.login(idp)}
      catch (e) { throw new SolidError(`Could not login to solid. \n${e.message}`)}
    } else if (isNode) {
      const credentials = {
        idp: idp,
        username: uname,
        password: passwd
      }
      if (!credentials.idp || !credentials.username || !credentials.password) {
        throw new SolidError(
          'Identity provider, username and password are required to login to Solid if no session is found. \n\
           Please pass these parameters via the config file, or in the parameter of the login function.', 
          'LoginError'
        )
      }
      try { await this.auth?.login(credentials) }
      catch (e) { throw new SolidError(`Could not login to solid. \n${e.message}`)}
    } else {
      throw new SolidError('This application is only designed to work in Node or in the Browser.')
    }
  }

  // Forwarded from login of auth, this concern should maybe be separated to somewhere else, or require an auth to be passed that has been authenticated already?;
  public async loginPopup(popupURI: string) {
    if (!isBrowser) { throw new SolidError('Login via popup can only be used in browser environments', 'LoginError') }
    
    // If user is already logged in return
    if (await this.auth?.currentSession()) return;
    
    // Try to show popup
    const popupLocation = popupURI || this.config.popup
    if (popupLocation) {
      try { this.auth.popupLogin(popupLocation) } 
      catch (e) { throw new SolidError(`Could not login with popup. \n${e.message}`) }
    } else {
      throw new SolidError('No login popup uri. Please pass a popup uri via the config file or or in the parameter of the loginPopup function.', 'LoginError')
    }
  }

  public async logout () {
    this.auth?.logout();
  }
}
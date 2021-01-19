import ns from './NameSpaces';
import { isBrowser, isNode } from "browser-or-node";
import SolidError from './Utils/SolidError';
import { LoginOptions, NotificationMetadata, NotificationHandlerOptions, Configuration, streamToQuads, quadsToString, InboxNotification, notifySystem } from './Utils/util';
import { getFile, postFile, deleteFile, getQuadArrayFromFile, parseResponseToStore, getStoreFromFile, parseResponseToQuads } from './Utils/FileUtils';
import * as RDF from 'rdf-js'
import generateNotification from './Notifications/NotificationGenerator';
import { validate } from './Validation/Validation';
import { getResourceAsRDFStream, getDataset, getResourceAsDataset } from './Retrieval/retrieval';
import * as winston from 'winston'
import {AsyncIterator} from 'asynciterator'
import { InboxRetrievalAsyncIterator } from './InboxIterators/InboxRetrievalAsyncIterator';
import { discoverInbox, getInbox } from './Retrieval/inbox_retrieval';
import getInboxIterator from './InboxIterators/InboxRetrievalIterator';

const streamifyArray = require('streamify-array');



export class NotificationHandler {
  config: Configuration;
  auth?: any;

  constructor(config: NotificationHandlerOptions) {
    this.config = config;

    let level = "info";
    // Set the Logger options based on the passed configuration
    if (this.config?.verbose) {
      level = "verbose"
    } else if (this.config?.cli) {
      level = "info"
    } else {
      level = "warn"
    }

    winston.add(new winston.transports.Console({level: level}))
    
    // Set the auth based on the environment
    this.auth = this.config.auth || isBrowser
    ? require('solid-auth-client')
    : require('solid-auth-cli')

    // Log the config
    winston.log('verbose', 'config: ' + JSON.stringify(this.config, null, 2))
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
            let inbox = await discoverInbox(this.auth, receiver)
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
        winston.log('verbose', 'Notification sent succesfully to inbox ' + inbox)
      } catch (e) {
        results[receiver] = new SolidError(`Error posting notification to inbox of ${receiver}.\n${e.message}`, e.name || 'Notification posting')
      }

    }
    winston.log('verbose', 'All notifications sent')
    return results;
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


  public async clearNotifications(params: {webId?: string, notificationIds?: string[], filters?: any[]}) {
    const webId = await this.getWebId(params);
    const notificationIds = params.notificationIds?.length ? params.notificationIds : (await getInbox(this.auth, webId))?.notifications
    const failedDeletions = [];
    for (let notificationId of notificationIds) {
      try {
        await deleteFile(this.auth, notificationId)
        winston.log('verbose', 'Deleted notification: ' + notificationId)
      } catch (e) {
        failedDeletions.push({id: notificationId, error: e})
        winston.log('error', 'Failed to delete notification: ' + notificationId)
      }
    }
    winston.log('verbose', 'Finished clearing inbox')
    if (failedDeletions.length) {
      throw new SolidError(`Failed to remove notifications: ${failedDeletions.map(e => e.id).join(', ')}`)
    }
  }

  public async fetchNotifications(params: {webId?: string, callBack: Function, systemNotificationFormat?: Function, notificationIds?: [], filters?: any[], notify?: boolean}) {
    const webId = await this.getWebId(params);
    // Setting webId if none present to logged in user webId;
    params.webId = webId  
    const inbox = await discoverInbox(this.auth, webId);
    return getInboxIterator(this.auth, this, inbox, params)
  }

  public async watchNotifications(params: {webId?: string, callBack: Function, systemNotificationFormat?: Function, notificationIds?: [], filters?: any[], notify?: boolean}) {
    const webId = await this.getWebId(params);
    params.webId = webId  
    const inbox = await discoverInbox(this.auth, webId);
    console.log('WATCHING')
    return new InboxRetrievalAsyncIterator(this.auth, inbox, params)
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


  private async getWebId(params: any) : Promise<string> {
    let webId = params.webId
    if (!webId) {
      const session = await this.auth?.currentSession()
      webId = session?.webId;
    }
    if (!webId) { throw new SolidError('Please authenticate yourself.')}
    return webId
  }


  public async logout () {
    this.auth?.logout();
  }
}
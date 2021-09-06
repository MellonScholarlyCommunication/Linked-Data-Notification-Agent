
import { isBrowser } from "browser-or-node";
import CustomError from './Utils/CustomError';
import { NotificationData, Filter, ListingOptions } from './Utils/util';
import { postFile, deleteFile} from './Utils/FileUtils';
import generateNotification from './Notifications/NotificationGenerator';
import * as winston from 'winston'
import { discoverInbox, getNotificationsInfo } from "./Retrieval/inbox_retrieval";
import * as nodefetch from "node-fetch"
import { InboxRetrievalAsyncIterator, getInboxIterator } from './InboxIterators/InboxRetrievalIterator';

export class Agent {
  fetch?: any;

  constructor(fetchFunction?: any, verbose = false) {

    // Fill in with default node / browser fetch function if none passed
    this.fetch = fetchFunction || ( isBrowser ? fetch : nodefetch );

    // Setup logging
    let level;
    if (verbose) {
      level = "verbose"
    } else {
      level = "warn"
    }
    winston.add(new winston.transports.Console({level: level}))
    
    // Log the config
    winston.log('verbose', 'Initialized Notification Agent')
  }

  /**
   * Fetch all notifications from the provided inbox or the inbox advertised by the provided uri.
   * @options options 
   * @returns 
   */
  public async list(options: ListingOptions) {
    return getInboxIterator(this.fetch, options) 
  }

  public async watch(options: ListingOptions) {
    // Discover inbox and error handling
    let inbox: string;
    if (options.inbox)
      inbox = options.inbox
    else {
      const uri = options.uri;
      if (!uri) throw new CustomError("Please provide an inbox or uri with advertised inbox.")
      
      const discoveredInbox = await discoverInbox(this.fetch, uri);
      if (!discoveredInbox) throw new CustomError(`Could not retrieve inbox of ${uri}.`, 'Inbox retrieval');
      inbox = discoveredInbox;
    }
    return new InboxRetrievalAsyncIterator(this.fetch, { ...options, inbox })
  }

  /**
   * Send a notification
   * @param url 
   * @param notification 
   */
  public async send (data: NotificationData) {
    
    this.checkNotificationData(data);
    
    // Create the notification from the given notification string / file / template and mappings
    const notification = await generateNotification(this.fetch, data);
    const results : any = {}
    const inboxMapping: {id: string, inbox: string}[] = []
    for (const receiverlist of [data.to, data.cc, data.bcc]) {
      if (receiverlist){
        for (let receiver of receiverlist){
          try {
            let inbox = await discoverInbox(this.fetch, receiver)
            if (!inbox) throw new CustomError(`The inbox of ${receiver} could not be retrieved.\n`, 'Inbox discovery')
            else inboxMapping.push({ id: receiver, inbox: inbox })
          } catch (e: any) {
            throw new CustomError(`The inbox of ${receiver} could not be retrieved.\n${e.message}`, e.name || 'Inbox discovery error')
          }
        }
      }      
    }
    
    for (let mapping of inboxMapping) {
      const inbox = mapping.inbox
      const receiver = mapping.id
      try {
        const response = await postFile(this.fetch, inbox, notification, data.contentType, 'Notification posting')
        results[receiver] = response;
        console.log('RESPONSE', response)
        winston.log('verbose', 'Notification sent successfully to inbox ' + inbox)
      } catch (e: any) {
        winston.log('warn', `Error posting notification to inbox of ${receiver}.\n${e.message}`)
        results[receiver] = new CustomError(`Error posting notification to inbox of ${receiver}.\n${e.message}`, e.name || 'Notification posting')
      }
    }
    winston.log('verbose', 'All notifications sent')
    return results;
  }

  /**
   * Check if passed parameters allow the creation and sending of the requested notification. This catches errors early.
   * @param notificationData 
   */
  private checkNotificationData(data: NotificationData) {
    if (data.to.length === 0) {
      throw new CustomError('No receiver provided. Provide at least one receiver for the notification')
    } else if (!(data.body || data.filePath)) {
      throw new CustomError('No notification provided. Provide either a notification string or a notification file')
    }
  }


  public async clear(options: {uri?: string, notificationIds?: string[], filters?: Filter[]}) {
    if (!options.uri) throw new CustomError("Please provide a valid inbox or URI with advertised inbox to clear notifications from.")
    const notificationIds = options.notificationIds?.length ? options.notificationIds : Array.from( ((await getNotificationsInfo(this.fetch, options)).keys()) )
    const failedDeletions = [];
    for (let notificationId of notificationIds) {
      try {
        await deleteFile(this.fetch, notificationId)
        winston.log('verbose', 'Deleted notification: ' + notificationId)
      } catch (e: any) {
        failedDeletions.push({id: notificationId, error: e})
        winston.log('error', 'Failed to delete notification: ' + notificationId)
      }
    }
    winston.log('verbose', 'Finished clearing inbox')
    if (failedDeletions.length) {
      throw new CustomError(`Failed to remove notifications: ${failedDeletions.map(e => e.id).join(', ')}`)
    }
  }


}
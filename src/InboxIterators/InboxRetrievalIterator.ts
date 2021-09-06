
import { deleteFile } from "../Utils/FileUtils";
import { InboxNotification, notifySystem, Filter, ListingOptions } from '../Utils/util';
import winston from "winston";
import { getNotificationContents, getNotificationsInfo, NotificationInfo } from '../Retrieval/inbox_retrieval';
import { validateFilters } from "../Validation/Validation";
import { AsyncIterator } from "asynciterator";
import { UpdateTracker } from '../AutoUpdates/UpdateTracker';
import CustomError from '../Utils/CustomError';



export class InboxRetrievalAsyncIterator extends AsyncIterator<InboxNotification> {

  public values: InboxNotification[];
  private options: ListingOptions;
  private fetch: any;
  private inbox: string;
  
  constructor(fetch: any, options: ListingOptions) {
    super();
    this.options = options;

    this.fetch = fetch;
    this.values = new Array();
    if (!options.inbox) throw new CustomError("No inbox was found");
    this.inbox = options.inbox

    this.trackFolder();
  }
  
  read(): InboxNotification | null{
    if (this.closed) return null;
    return this.values.shift() || null;  
  }

  private async trackFolder() {
    let processedIds : string[] = this.options.ignore || []

    // Create the tracker
    const tracker = new UpdateTracker(this.fetch)
    tracker.on('update', async (e) => {
      if (!this.options.inbox) throw new CustomError("No valid uri or inbox provided.");

      const notificationsInfo = await getNotificationsInfo(fetch, this.options)
  
      for (let info of notificationsInfo) {
        let contents = await processNotification(fetch, info, this.options)
        if (contents) {
          processedIds.push(contents.id)
          this.values.push( contents );
        }
      }
      
      this.emit('readable')
    })
    // Subscribe the tracker
    tracker.subscribe(this.inbox);
  }
}

export async function getInboxIterator(fetch: any, options: ListingOptions) : Promise<Iterator<InboxNotification>>{

    // Retrieve notification Ids
    const notificationsInfo = await getNotificationsInfo(fetch, options)
    const notifications : Array<InboxNotification> = []

    for (let info of notificationsInfo) {
      let contents = await processNotification(fetch, info, options)
      if (contents) notifications.push(contents)
    }
    return makeIterator<InboxNotification>(notifications)
}

function makeIterator<T>(array: Array<T>) {
  return array[Symbol.iterator]();
}

async function processNotification(fetch: any, info: NotificationInfo, options: ListingOptions, ignore?: string[]) : Promise<InboxNotification | null> {
  if (options.ignore && options.ignore.indexOf(info.id) !== -1) return null;
  if (ignore && ignore.indexOf(info.id) !== -1) return null;

  let notifContents = await getNotificationContents(fetch, info)
  let validatedFilters : Filter[] = [];
  if (options.filters && options.filters.length !== 0) {
    validatedFilters = await validateFilters(notifContents.quads.slice(), options.filters || [])
    if (!validatedFilters || validatedFilters.length === 0)
      return null;
  }

  // Handle flags
  if (options.notify) {
    notifySystem(notifContents.quads, validatedFilters, notifContents.last_modified)
  }
  if (options.delete) {
    try {
      await deleteFile(fetch, notifContents.id)
      winston.log('verbose', 'Deleted notification: ' + notifContents.id)
    } catch (e) {
      winston.log('error', 'Failed to delete notification: ' + notifContents.id)
    }
  }
  
  return ( {id: notifContents.id, last_modified: notifContents.last_modified, quads: notifContents.quads, validated_for: validatedFilters} ); 
}
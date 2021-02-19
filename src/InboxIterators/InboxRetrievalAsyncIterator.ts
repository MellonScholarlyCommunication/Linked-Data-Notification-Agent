import { AsyncIterator } from "asynciterator";
import * as RDF from 'rdf-js';
import { UpdateTracker } from '../AutoUpdates/UpdateTracker';
import { deleteFile, getQuadArrayFromFile, getStoreFromFile } from "../Utils/FileUtils";
import ns from '../NameSpaces';
import winston from "winston";
import { getResourceAsDataset, getDataset } from '../Retrieval/retrieval';
import { validate } from "../Validation/Validation";
import { notifySystem, Filter, DEFAULTFILTERNAME, InboxNotification } from '../Utils/util';


const streamifyArray = require('streamify-array');

export class InboxRetrievalAsyncIterator extends AsyncIterator<InboxNotification> {

  public values: InboxNotification[];
  private params: {webId?: string, inbox: string, systemNotificationFormat?: Function, watch?: boolean, delete?: boolean, notificationIds?: [], filters?: Filter[], notify?: boolean};
  private auth: any;
  
  constructor(auth: any, params: {webId?: string, inbox: string, systemNotificationFormat?: Function, watch?: boolean, delete?: boolean, notificationIds?: [], filters?: Filter[], notify?: boolean}) {
    super();
    this.params = params;

    this.auth = auth;
    this.values = new Array();

    this.trackFolder();
  }
  
  read(): InboxNotification | null{
    if (this.closed) return null;
    return this.values.shift() || null;  
  }

  private async trackFolder() {
    let processedIds : string[] = []

    // Create the tracker
    const tracker = new UpdateTracker(this.auth)
    tracker.on('update', async (e) => {
      // Inbox is updated
      const inboxStore = await getStoreFromFile(this.auth, this.params.inbox);
      const contentIds = inboxStore.getQuads(this.params.inbox, ns.ldp('contains'), null, null).map(quad => quad.object.id)

      // Get the new notification(s)
      const newContentIds = contentIds.filter(id => processedIds.indexOf(id) === -1)


      for (let notificationId of newContentIds) {
        const quads = await getQuadArrayFromFile(this.auth, notificationId)
        const modifieds = inboxStore.getQuads(notificationId, ns.dct('modified'), null, null)
        const date = modifieds && modifieds.length !== 0 
                                ? new Date(modifieds[0].object.value)
                                : undefined
        if (!this.params.filters || this.params.filters.length === 0) {
          this.validatedNotification(notificationId, quads, DEFAULTFILTERNAME, date)   
        } else {
          for (let filter of this.params.filters) {
            if (!filter.name) throw new Error('No name parameter set for used filter.')
            if (filter.shape) throw new Error('Shapes are currently not yet supported.')
            if (!filter.shapeFileURI) throw new Error('No shapeFileURI parameter set for filter.')
  
            // These have to be done every time, as the stream is consumed. (Is the dataset consumed? TODO:: check)
            const shapeDataset = await getResourceAsDataset(this.auth, filter.shapeFileURI)
            const notificationQuadStream = await streamifyArray(quads.slice()); // Slicing is required, as else the array is consumed when running in the browser (but not when running in node?)
            const notificationDataset = await getDataset(notificationQuadStream)
    
            if(!await validate(notificationDataset, shapeDataset)) {
              // The notification matches the given filter
              this.validatedNotification(notificationId, quads, filter.name, date)   
            }
          }
        }
      }
      processedIds = processedIds.concat(newContentIds)
      this.emit('readable')
    })
    // Subscribe the tracker
    tracker.subscribe(this.params.inbox);
  }

  private async validatedNotification(notificationId: string, quads: RDF.Quad[], filterName: string, date?: Date) {
    this.values.push( {id: notificationId, quads: quads.slice(), filterName: filterName, date: date} );
      // Handle flags
      if (this.params.notify) {
        notifySystem(quads, this.params.systemNotificationFormat, filterName, date)
      }
      if (this.params.delete) {
        try {
          await deleteFile(this.auth, notificationId)
          winston.log('verbose', 'Deleted notification: ' + notificationId)
        } catch (e) {
          winston.log('error', 'Failed to delete notification: ' + notificationId)
        }
      }
  }

}

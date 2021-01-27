import { AsyncIterator } from "asynciterator";
import * as RDF from 'rdf-js';
import { UpdateTracker } from '../AutoUpdates/UpdateTracker';
import { deleteFile, getQuadArrayFromFile, getStoreFromFile } from "../Utils/FileUtils";
import ns from '../NameSpaces';
import winston from "winston";
import { getResourceAsDataset, getDataset } from '../Retrieval/retrieval';
import { validate } from "../Validation/Validation";
import { notifySystem } from "../Utils/util";


const streamifyArray = require('streamify-array');

// specify return type
interface InboxNotification {id: string; quads:RDF.Quad[]}

export class InboxRetrievalAsyncIterator extends AsyncIterator<InboxNotification> {

  public values: InboxNotification[];
  private params: {webId?: string, inbox: string, systemNotificationFormat?: Function, watch?: boolean, delete?: boolean, notificationIds?: [], filters?: any[], notify?: boolean};
  private auth: any;
  
  constructor(auth: any, params: {webId?: string, inbox: string, systemNotificationFormat?: Function, watch?: boolean, delete?: boolean, notificationIds?: [], filters?: any[], notify?: boolean}) {
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

        const notificationQuadStream = await streamifyArray(quads.slice()); // Slicing is required, as else the array is consumed when running in the browser (but not when running in node?)
        const notificationDataset = await getDataset(notificationQuadStream)

          
        let validated = true;
        for (let shapeFile of this.params.filters || []) {
          const shapeDataset = await getResourceAsDataset(this.auth, shapeFile)
          if(!await validate(notificationDataset, shapeDataset)) {
            validated = false;
          }
        }

        if(validated) {
          this.values.push( {id: notificationId, quads: quads.slice()} );

          // Handle flags
          if (this.params.notify) {
            notifySystem(quads, this.params.systemNotificationFormat)
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

      processedIds = processedIds.concat(newContentIds)
      this.emit('readable')
    })
    // Subscribe the tracker
    tracker.subscribe(this.params.inbox);
  }

}

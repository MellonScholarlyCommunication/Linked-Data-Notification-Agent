import { AsyncIterator } from "asynciterator";
import * as RDF from 'rdf-js';
import { UpdateTracker } from '../AutoUpdates/UpdateTracker';
import { deleteFile, getQuadArrayFromFile, getStoreFromFile } from "../Utils/FileUtils";
import ns from '../NameSpaces';
import winston from "winston";

// specify return type
interface InboxNotification {id: string; quads:RDF.Quad[]}

export class InboxRetrievalAsyncIterator extends AsyncIterator<InboxNotification> {

  public values: InboxNotification[];

  deleteProcessed?: boolean;
  uri: string;
  auth: any;
  constructor(auth: any, inbox: string, params: {webId?: string, callBack: Function, systemNotificationFormat?: Function, watch?: boolean, delete?: boolean, notificationIds?: [], filters?: any[], notify?: boolean}) {
    super();
    this.uri = inbox;
    this.deleteProcessed = params.delete;
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
      const inboxStore = await getStoreFromFile(this.auth, this.uri);
      const contentIds = inboxStore.getQuads(this.uri, ns.ldp('contains'), null, null).map(quad => quad.object.id)
      // Get the new notification(s)
      const newContentIds = contentIds.filter(id => processedIds.indexOf(id) === -1)

      for (let contentId of newContentIds) {
        const quads = await getQuadArrayFromFile(this.auth, contentId)
        this.values.push( { id: contentId, quads } );
        if (this.deleteProcessed) {
          try {
            await deleteFile(this.auth, contentId)
            winston.log('verbose', 'Deleted: ' + contentId)
          } catch (e) {
            winston.log('error', 'Failed to delete: ' + contentId)
          }
        }
      }
      processedIds = processedIds.concat(newContentIds)
      this.emit('readable')
    })
    // Subscribe the tracker
    tracker.subscribe(this.uri);
  }

}

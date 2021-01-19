import { getInbox } from "../Retrieval/inbox_retrieval";
import { getQuadArrayFromFile } from "../Utils/FileUtils";
import { getDataset, getResourceAsDataset } from '../Retrieval/retrieval';
import { validate } from "../Validation/Validation";
import { NotificationHandler } from '../NotificationHandler';
import { InboxNotification } from '../Utils/util';

const streamifyArray = require('streamify-array');

export default async function getInboxIterator(auth: any, handler: NotificationHandler, inbox: string, params: {webId?: string, callBack: Function, systemNotificationFormat?: Function, watch?: boolean, delete?: boolean, notificationIds?: [], filters?: any[], notify?: boolean}) : Promise<Iterator<InboxNotification>>{
    // Check if notifications are specified to be processed. If not, process over all notifications in the inbox.
    const notificationIds = (await getInbox(auth, params.webId))?.notifications
    const notifications : any[] = []
    for (let id of notificationIds) {
      const notificationQuads = await getQuadArrayFromFile(auth, id)
      // TODO:: THIS STREAM IS CONSUMED, optimise to only require streaming once?
      const notificationQuadStream = await streamifyArray(notificationQuads.slice()); // Slicing is required, as else the array is consumed when running in the browser (but not when running in node?)
      const notificationDataset = await getDataset(notificationQuadStream)
      // Evaluate the callback over the notification quads, and return the results
      let validated = true;
      for (let shapeFile of params.filters || []) {
        const shapeDataset = await getResourceAsDataset(auth, shapeFile)
        if(!await validate(notificationDataset, shapeDataset)) {
          validated = false;
        }
      }
      if(validated) {
        const inboxNotification = {id, quads: notificationQuads};
        notifications.push(inboxNotification);
      }
    }
    const iterator = makeIterator<InboxNotification>(notifications.slice())
    return makeIterator<InboxNotification>(notifications)
}



function makeIterator<T>(array: Array<T>) {
  return array[Symbol.iterator]();
}
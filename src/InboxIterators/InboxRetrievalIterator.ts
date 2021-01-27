import { fetchInboxNotifications } from "../Retrieval/inbox_retrieval";
import { deleteFile, getQuadArrayFromFile } from "../Utils/FileUtils";
import { getDataset, getResourceAsDataset } from '../Retrieval/retrieval';
import { validate } from "../Validation/Validation";
import { InboxNotification, notifySystem } from '../Utils/util';
import winston from "winston";

const streamifyArray = require('streamify-array');

export default async function getInboxIterator(auth: any, params: {webId?: string, inbox: string, systemNotificationFormat?: Function, watch?: boolean, delete?: boolean, notificationIds?: [], filters?: any[], notify?: boolean}) : Promise<Iterator<InboxNotification>>{
    // Check if notifications are specified to be processed. If not, process over all notifications in the inbox.
    const notificationIds = (await fetchInboxNotifications(auth, params.inbox))?.notifications
    const notifications : any[] = []
    for (let id of notificationIds) {
      const notificationQuads = await getQuadArrayFromFile(auth, id)
      // TODO:: THIS STREAM IS CONSUMED, optimise to only require streaming once?
      const notificationQuadStream = await streamifyArray(notificationQuads.slice()); // Slicing is required, as else the array is consumed when running in the browser (but not when running in node?)
      const notificationDataset = await getDataset(notificationQuadStream)
      
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
        
        // Handle flags
        if (params.notify) {
          notifySystem(inboxNotification.quads, params.systemNotificationFormat)
        }
        if (params.delete) {
          try {
            await deleteFile(auth, inboxNotification.id)
            winston.log('verbose', 'Deleted notification: ' + inboxNotification.id)
          } catch (e) {
            winston.log('error', 'Failed to delete notification: ' + inboxNotification.id)
          }
        }
      }
    }
    return makeIterator<InboxNotification>(notifications)
}



function makeIterator<T>(array: Array<T>) {
  return array[Symbol.iterator]();
}
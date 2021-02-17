import { fetchInboxNotifications } from "../Retrieval/inbox_retrieval";
import { deleteFile, getQuadArrayFromFile } from "../Utils/FileUtils";
import { getDataset, getResourceAsDataset } from '../Retrieval/retrieval';
import { validate } from "../Validation/Validation";
import { InboxNotification, notifySystem, DEFAULTFILTERNAME, Filter } from '../Utils/util';
import winston from "winston";

const streamifyArray = require('streamify-array');

export default async function getInboxIterator(auth: any, params: {webId?: string, inbox: string, systemNotificationFormat?: Function, watch?: boolean, delete?: boolean, notificationIds?: [], filters?: Filter[], notify?: boolean}) : Promise<Iterator<InboxNotification>>{
    // Check if notifications are specified to be processed. If not, process over all notifications in the inbox.
    const notificationIds = (await fetchInboxNotifications(auth, params.inbox))?.notifications
    const notifications : any[] = []
    for (let id of notificationIds) {
      const quads = await getQuadArrayFromFile(auth, id)

      if (!params.filters || params.filters.length === 0) {
        const inboxNotification : InboxNotification = {id, quads, filterName: DEFAULTFILTERNAME};
        notifications.push(inboxNotification);
      } else {
        for (let filter of params.filters || []) {
          if (!filter.name) throw new Error('No name parameter set for used filter.')
          if (filter.shape) throw new Error('Shapes are currently not yet supported.')
          if (!filter.shapeFileURI) throw new Error('No shapeFileURI parameter set for filter.')

          // These have to be done every time, as the stream is consumed. (Is the dataset consumed? TODO:: check)
          const shapeDataset = await getResourceAsDataset(auth, filter.shapeFileURI)
          const quadStream = await streamifyArray(quads.slice()); // Slicing is required, as else the array is consumed when running in the browser (but not when running in node?)
          const notificationDataset = await getDataset(quadStream)

          if(!await validate(notificationDataset, shapeDataset)) {
            // The notification matches the given filter
            
            const inboxNotification : InboxNotification = {id, quads, filterName: filter.name};
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
      }
    }
    return makeIterator<InboxNotification>(notifications)
}

function makeIterator<T>(array: Array<T>) {
  return array[Symbol.iterator]();
}
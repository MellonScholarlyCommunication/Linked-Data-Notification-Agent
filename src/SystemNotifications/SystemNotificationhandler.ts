import { isBrowser } from "browser-or-node";

export class SystemNotificationHander {
  notifier: any;

  constructor() {
    this.notifier = isBrowser 
    ? new BrowserNotifier()
    : require('node-notifier')
  }


  async notify(args: {title?: string, message: string}) {
    return await this.notifier.notify(args)
  }
}


class BrowserNotifier {
  async notify(args: {title: string, message: string}) {
    return new Promise((resolve, reject) => {
      if (!window) { 
        reject("Could not find window object in browser environment"); 
      }
      // Check if the user agreed to get notified
      if (window.Notification && Notification.permission === "granted") {
        var n = new Notification(args.title, {body: args.message});
        resolve(n)
      }
      // The user hasn't told if he wants to be notified or not, and has not yet been explicitly denied
      // Note: because of Chrome, we are not sure the permission property is set, therefore it's unsafe to check for the "default" value.
      else if (window.Notification && Notification.permission !== "denied") {
        Notification.requestPermission(function (status) {
          // If the user said okay
          if (status === "granted") {
            var n = new Notification(args.title, {body: args.message});
            resolve(n)
          } else {
            reject("User has not accepted notifications for this site.")
          }
        });
      }
      else {
        reject("User has not accepted notifications for this site.")
      }
    })
  }
  // Possible fallback on alert mechanism if notifications are not available.
  // However this is not very user-friendly
}

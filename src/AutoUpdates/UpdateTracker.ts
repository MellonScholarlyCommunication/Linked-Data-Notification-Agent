// Based on:
// https://github.com/solid/react-components/blob/edc5f9295fbaf2ff88212303e8f6aa5ac7ee0164/src/UpdateTracker.js

import ns from "../NameSpaces";
import {
  EventEmitter
} from "events";
import {
  Store
} from 'n3';
import {
  PollingTracker
} from './PollingTracker';
import {
  WebSocketTracker
} from './WebSocketTracker';
import winston from "winston";
import { Level } from "../Utils/Logger";

// Wildcard for tracking all resources

export class UpdateTracker extends EventEmitter {
  private auth: any;
  private trackers = new Map < string, PollingTracker | WebSocketTracker > ();
  private reconnectionAttempts = 0;
  private reconnectionDelay = 1000;

  constructor(auth: any) {
    super()
    this.auth = auth;
  }  

  async track(url: string) {
    const tracker = await createTracker(this.auth, url)
    tracker.on('update', () => {
      const update = {
        timestamp: new Date(),
        url
      };
      this.emit('update', update)
    });
    tracker.on('close', () => {
      this.trackers.delete(url) // Delete old tracker
      this.reconnect(url);      // Create new tracker
    })
    this.trackers.set(url, tracker)
    tracker.watch();
    return tracker;
  }

  // Todo :: graceful transition from websocket to polling
  async reconnect(url: string) {
    // Try setting up a new socket
    if (this.reconnectionAttempts < 6) {
      // Wait a given backoff period before reconnecting
      await new Promise(done => (setTimeout(done, this.reconnectionDelay)));
      // Try reconnecting, and back off exponentially
      await this.track(url)
    }
  }

  /**
   * Subscribes to changes in the given resources
   * @param urls 
   */
  async subscribe(...urls: string[]) {
    for (let url of urls) {
      // Create a new subscription to the resource if none existed
      url = url.replace(/#.*/, '');
      // If we are not yet subscribed to this resource
      if (!(url in this.trackers.keys())) {
        this.track(url);
      }
    }
  }

  /** Unsubscribes to changes in the given resources */
  async unsubscribe(...urls: string[]) {
    for (let url of urls) {
      url = url.replace(/#.*/, '');
      const tracker = this.trackers.get(url)
      if (tracker) {
        tracker.stop();
        this.trackers.delete(url)
      }

    }
  }
}

async function getWebSocketUrl(auth: any, url: string) {
  const response = await auth.fetch(url);
  const webSocketUrl = response.headers.get('Updates-Via');
  if (!webSocketUrl)
    winston.log('verbose', `No WebSocket found for ${url}`)
  return webSocketUrl;
}


async function createTracker(auth: any, url: string): Promise < PollingTracker | WebSocketTracker > {
  const webSocketURL = await getWebSocketUrl(auth, url);
  if (webSocketURL) {
    return new WebSocketTracker(auth, url, webSocketURL)
  } else {
    return new PollingTracker(auth, url)
  }
}

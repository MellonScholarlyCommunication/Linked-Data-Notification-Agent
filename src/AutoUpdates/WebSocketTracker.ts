import { EventEmitter } from 'events';
const WebSocket = require('ws');

export class WebSocketTracker extends EventEmitter{
  auth: any;
  url: string;
  socketURI: string;
  webSocket: WebSocket | undefined;
  constructor(auth: any, url: string, socketURI: string) {
    super();
    this.auth = auth;
    this.url = url;
    this.socketURI = socketURI;
  }

  public stop() {
    if(this.webSocket) {
      this.webSocket.close();
    }
  }

  private createWebSocket() : Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url)
      ws.onopen = () => { resolve(ws) }
      ws.onerror = () => { reject() }
    })
  }
  public async watch(): Promise<void> {
    // emit an update, as there may be notifications already present
    const tracker = this;
    tracker.emit("update")

    const ws = await this.createWebSocket()
    ws.onmessage = function (e) {
      // Verify the message is an update notification
      const match = /^pub +(.+)/.exec(e.data);
      if (!match)
        return;
        
      // Notify the subscribers
      tracker.emit("update")

    }
    this.webSocket = ws;
    ws.send(`sub ${this.url}`)
  }
  
}

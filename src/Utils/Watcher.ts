import { getFile, parseResponseToStore } from "./FileUtils";
import * as df from '@rdfjs/data-model';
import ns from "../NameSpaces";
import { EventEmitter } from "events";
import { emit } from "process";
import { log, Level } from './Logger';

export class Watcher extends EventEmitter {
  fetch: any;
  interval: number;
  constructor(fetch:any, interval=2000) {
    super();
    this.fetch = fetch;
    this.interval = interval;
  }

  watch(id: string) {
    this.usePolling(id)
  }

  private usePolling(id: string) {
    let previousTimeStamp : Date;
    let previousResponseBody : string;
  
    setInterval(async () => { 
      // HEAD request to get the timestamp of the previous change.
      const response = await getFile(this.fetch, id) 
      if (response.headers['Last-Modified']) {
        if (previousTimeStamp) {
          try {
            if (previousTimeStamp > new Date(response.headers['Last-Modified'])) {
              // Not modified
            } else {
              // Modified
              this.emit('data', {id, data: response})
            }
          } catch (_ignore) {
            // dont do anything, fallback on file
            if (! await this.compareResponse(response, previousResponseBody)){
              // Modified
              this.emit('data', {id, data: response})
            } else {
              // Response not modified since last retrieval.
            }
          }
        } else {
          // First request so emit.
              this.emit('data', {id, data: response})
        }
      } else {
        if (!await this.compareResponse(response, previousResponseBody)){
          // Modified
          this.emit('data', {id, data: response})
        } else {
          // Response not modified since last retrieval.
        }
      }
      previousResponseBody = response;
      previousTimeStamp = new Date();
    }, this.interval)
  }

  private useWebSocket(id: string) {

  }

  // Ceckif file is updated by comparing string contents
  private async compareResponse(response: any, previousResponse: any) {
    if (!previousResponse || !response) return false
    if (await response.text() !== await previousResponse.text()) {
      return false
    } 
    return true
  }
}
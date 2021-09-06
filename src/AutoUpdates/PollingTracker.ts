import { getQuadArrayFromFile } from '../Utils/FileUtils';
import ns from '../NameSpaces';
import { EventEmitter } from 'events';

export class PollingTracker extends EventEmitter {
  fetch: any;
  url: string;
  timeOut: number;
  interval : any = null;

  processedIds : string[] = []
  
  constructor(fetch: any, url: string, timeOut = 5000) {
    super();
    this.fetch = fetch;
    this.url = url;
    this.timeOut = timeOut;
  }

  public stop() {
    if(this.interval) {
      clearInterval(this.interval)
    }
  }

  public async watch() : Promise<void> {
    this.interval = setInterval(async () => {
      this.evaluate();
    }, this.timeOut);
  }

  private async evaluate () {
    const quads = await getQuadArrayFromFile(this.fetch, this.url);
    let updated = false;
    for (let quad of quads) {
      // Currently only checking contains as this is for notifications
      if (quad.predicate.value === ns.ldp('contains')) {
        if (this.processedIds.indexOf(quad.object.value) === -1) {
          this.processedIds.push(quad.object.value)
          updated = true;
        }
      }
    }
    if(updated) {
      this.emit('update')
    }
  }
}

export class Logger {
  private static _instance: Logger;
  public verbose = false;
  public cli = false;
  private constructor() {}

  public static get Instance()
  {
      // Do you need arguments? Make it a regular static method instead.
      return this._instance || (this._instance = new this());
  }
}

export function log (level: Level, message: string) : void {
  const logger = Logger.Instance;
  if (level === Level.CLI) {
    if(logger.cli || logger.verbose){
      console.log(message)
    }
  } else if (level === Level.Log) {
    if(logger.verbose){
      console.log(message)
    }
  } else if (level === Level.Warn){
    console.warn(message)
  } else if (level === Level.Error) {
    console.error(message)
  }
}

export function setLogOptions (cli?: boolean, verbose?: boolean) {
  const logger = Logger.Instance;
  if (cli) logger.cli = true;
  if (verbose) logger.verbose = true;
}

  
export enum Level {
  CLI,
  Log,
  Warn,
  Error,
}

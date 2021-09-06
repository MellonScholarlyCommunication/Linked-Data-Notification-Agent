// This class is used from @inrupt/solid-react-components
export default class CustomError extends Error {
  message: string;
  statusText: string;
  name: string;
  type: string;
  code: number;
  status: number;
  constructor(message: string, name?: string, code?: number) {
    super(message);
    this.message = message;
    this.statusText = message;
    this.name = name || 'CustomError';
    this.type = this.name;
    this.code = code || 0;
    this.status = code || 0;
  }
}

export const createFetchError = (code: number, uri: string, name?: string) => {
  switch (code) {
    case 400:
      return new CustomError(`Bad request sent by client`, name, code)
    case 401:
      return new CustomError(`Client is unauthorized to access resource at ${uri}`, name, code)
    case 403:
      return new CustomError(`Client is forbidden from accessing resource  at ${uri}`, name, code)
    case 404:
      return new CustomError(`Resource was not found`, name, code)
  
    default:
      if (code >= 200 && code < 300) {
        return new CustomError(`Expected resource to return code 200, but received code ${code}`, name, code)
      } else if (code >= 300 && code < 400) {
        return new CustomError(`Resource has been redirected`, name, code)
      } else if (code >= 400 && code < 500) {
        return new CustomError(`Error with client request`, name, code)
      } else if (code >= 500 && code < 600) {
        return new CustomError(`Internal server error. ${code}`, name, code)
      }
      break;
  }

}
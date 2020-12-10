// This class is used from @inrupt/solid-react-components
export default class SolidError extends Error {
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
    this.name = name || 'SolidError';
    this.type = this.name;
    this.code = code || 0;
    this.status = code || 0;
  }
}

export const createFetchError = (code: number, name?: string) => {
  switch (code) {
    case 400:
      return new SolidError(`Bad request sent by client`, name, code)
    case 401:
      return new SolidError(`Client is unauthorized to access this resource`, name, code)
    case 403:
      return new SolidError(`Client is forbidden from accessing this resource`, name, code)
    case 404:
      return new SolidError(`Resource was not found`, name, code)
  
    default:
      if (code >= 200 && code < 300) {
        return new SolidError(`Expected resource to return code 200, but received code ${code}`, name, code)
      } else if (code >= 300 && code < 400) {
        return new SolidError(`Resource has been redirected`, name, code)
      } else if (code >= 400 && code < 500) {
        return new SolidError(`Error with client request`, name, code)
      } else if (code >= 500 && code < 600) {
        return new SolidError(`Internal server error. ${code}`, name, code)
      }
      break;
  }

}
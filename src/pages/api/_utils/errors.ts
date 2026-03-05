export class ConnectionPoolException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConnectionPoolException';
  }
}

export class QueryTimeoutException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QueryTimeoutException';
  }
}

export class SQLException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SQLException';
  }
}

export class ServiceUnavailableException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServiceUnavailableException';
  }
}

declare module "npm:imapflow" {
  export class ImapFlow {
    constructor(opts: any)
    connect(): Promise<void>
    logout(): Promise<void>
    [key: string]: any
  }
}

declare module "npm:mailparser" {
  export function simpleParser(source: any): Promise<any>
  export type Attachment = any
}

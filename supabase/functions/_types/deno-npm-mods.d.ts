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

declare module "https://esm.sh/@aws-sdk/client-sesv2@3.400.0" {
  export class SESv2Client {
    constructor(opts: any)
    send(command: any): Promise<any>
  }
  export class CreateEmailIdentityCommand {
    constructor(opts: any)
  }
}

declare module "npm:@aws-sdk/client-ses" {
  export class SESClient {
    constructor(opts: any)
    send(command: any): Promise<any>
  }
  export class VerifyDomainDkimCommand {
    constructor(opts: any)
  }
}

declare module "https://esm.sh/@supabase/supabase-js@2" {
  export function createClient(url: string, key: string, opts?: any): any
  export type SupabaseClient = any
}

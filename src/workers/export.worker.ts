 
import JSZip from 'jszip';
type InitMessage = { type: 'INIT' }
type AddFileMessage = { type: 'ADD_FILE'; payload: { name: string; content: string | ArrayBuffer | Uint8Array | Blob } }
type GenerateMessage = { type: 'GENERATE' }
type IncomingMessage = InitMessage | AddFileMessage | GenerateMessage
type InitSuccess = { type: 'INIT_SUCCESS' }
type AddFileSuccess = { type: 'ADD_FILE_SUCCESS'; payload: { name: string } }
type Generating = { type: 'GENERATING' }
type Progress = { type: 'PROGRESS'; payload: { percent: number; currentFile?: string } }
type Complete = { type: 'COMPLETE'; payload: { blob: Blob } }
type ErrorMsg = { type: 'ERROR'; payload: { message: string } }
type OutgoingMessage = InitSuccess | AddFileSuccess | Generating | Progress | Complete | ErrorMsg

let zip: JSZip | null = null;

self.onmessage = async (event: MessageEvent<IncomingMessage>) => {
  const msg = event.data;

  try {
    switch (msg.type) {
      case 'INIT':
        zip = new JSZip();
        self.postMessage({ type: 'INIT_SUCCESS' } as OutgoingMessage);
        break;

      case 'ADD_FILE':
        {
          if (!zip) throw new Error('Zip not initialized');
          const { name, content } = (msg as AddFileMessage).payload;
          zip.file(name, content);
          self.postMessage({ type: 'ADD_FILE_SUCCESS', payload: { name } } as OutgoingMessage);
        }
        break;

      case 'GENERATE':
        {
          if (!zip) throw new Error('Zip not initialized');
          self.postMessage({ type: 'GENERATING' } as OutgoingMessage);
          
          const blob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
          }, (metadata) => {
              self.postMessage({ 
                  type: 'PROGRESS', 
                  payload: { percent: metadata.percent, currentFile: metadata.currentFile } 
              } as OutgoingMessage);
          });
          
          self.postMessage({ type: 'COMPLETE', payload: { blob } } as OutgoingMessage);
          zip = null; // Cleanup
        }
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    self.postMessage({ type: 'ERROR', payload: { message } } as OutgoingMessage);
  }
};

export {};

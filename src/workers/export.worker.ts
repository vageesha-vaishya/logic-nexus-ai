/* eslint-disable no-restricted-globals */
import JSZip from 'jszip';

// Define the worker context
const ctx: Worker = self as any;

let zip: JSZip | null = null;

ctx.onmessage = async (event: MessageEvent) => {
  const { type, payload } = event.data;

  try {
    switch (type) {
      case 'INIT':
        zip = new JSZip();
        ctx.postMessage({ type: 'INIT_SUCCESS' });
        break;

      case 'ADD_FILE':
        {
          if (!zip) throw new Error('Zip not initialized');
          const { name, content } = payload;
          zip.file(name, content);
          ctx.postMessage({ type: 'ADD_FILE_SUCCESS', payload: { name } });
        }
        break;

      case 'GENERATE':
        {
          if (!zip) throw new Error('Zip not initialized');
          ctx.postMessage({ type: 'GENERATING' });
          
          const blob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
          }, (metadata) => {
              ctx.postMessage({ 
                  type: 'PROGRESS', 
                  payload: { percent: metadata.percent, currentFile: metadata.currentFile } 
              });
          });
          
          ctx.postMessage({ type: 'COMPLETE', payload: { blob } });
          zip = null; // Cleanup
        }
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error: any) {
    ctx.postMessage({ type: 'ERROR', payload: { message: error.message } });
  }
};

export {};

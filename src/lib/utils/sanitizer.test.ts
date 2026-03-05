import { describe, it, expect } from 'vitest';
import { sanitizePayload } from './sanitizer';

describe('sanitizePayload', () => {
  it('should return simple objects unchanged', () => {
    const input = { a: 1, b: 'string', c: true, d: null };
    const output = sanitizePayload(input);
    expect(output).toEqual(input);
  });

  it('should handle nested objects and arrays', () => {
    const input = {
      a: {
        b: [1, 2, { c: 3 }]
      }
    };
    const output = sanitizePayload(input);
    expect(output).toEqual(input);
  });

  it('should remove circular references', () => {
    const obj: any = { name: 'circular' };
    obj.self = obj;
    
    const output = sanitizePayload(obj);
    expect(output.name).toBe('circular');
    expect(output.self).toBeUndefined();
  });

  it('should remove deeply nested circular references', () => {
    const obj: any = { name: 'root', child: { name: 'child' } };
    obj.child.parent = obj;
    
    const output = sanitizePayload(obj);
    expect(output.name).toBe('root');
    expect(output.child.name).toBe('child');
    expect(output.child.parent).toBeUndefined();
  });

  it('should remove objects identified as React internals via _reactInternals', () => {
    const input = {
      data: 'valid',
      _reactInternals: { fiber: true }
    };
    // The sanitizer detects _reactInternals and discards the WHOLE object as a React internal instance
    const output = sanitizePayload(input);
    expect(output).toBeUndefined();
  });

  it('should remove objects identified as React Elements via $$typeof', () => {
    const input = {
      data: 'valid',
      $$typeof: Symbol.for('react.element')
    };
    // The sanitizer detects $$typeof and discards the WHOLE object
    const output = sanitizePayload(input);
    expect(output).toBeUndefined();
  });

  it('should remove properties starting with _ from valid objects', () => {
    const input = {
      valid: 'data',
      _private: 'secret',
      __internal: 'very secret'
    };
    const output = sanitizePayload(input);
    expect(output).toEqual({ valid: 'data' });
  });

  it('should remove DOM nodes', () => {
    // Mock a DOM node
    const domNode = {
      nodeType: 1,
      nodeName: 'DIV',
      textContent: 'content'
    };
    
    const input = {
      data: 'valid',
      element: domNode
    };
    
    const output = sanitizePayload(input);
    expect(output).toEqual({ data: 'valid' });
  });

  it('should remove event handler functions (starting with on)', () => {
    const input = {
      data: 'valid',
      onClick: () => console.log('clicked'),
      onChange: function() {}
    };
    
    const output = sanitizePayload(input);
    expect(output).toEqual({ data: 'valid' });
  });

  it('should keep other functions if they are not event handlers (though JSON.stringify would remove them usually, our sanitizer might keep them unless filtered, but for RPC payload we usually want data only. The current implementation keeps non-on functions? Let us check implementation behavior)', () => {
    // The current implementation implementation:
    // for (const key in obj) {
    //   if (key.startsWith('_') || key.startsWith('__') || (key.startsWith('on') && typeof obj[key] === 'function')) continue;
    //   ...
    // }
    // It doesn't explicitly filter other functions. 
    // However, usually we want to verify what happens.
    
    const input = {
      data: 'valid',
      calculate: () => 123
    };
    
    const output = sanitizePayload(input);
    // Based on code, it should keep 'calculate'
    expect(output.data).toBe('valid');
    expect(typeof output.calculate).toBe('function');
  });
  
  it('should handle arrays with circular references', () => {
    const obj: any = { name: 'item' };
    const arr = [obj, obj];
    // The sanitizer uses a WeakSet to track seen objects.
    // If the SAME object instance appears twice, the second one might be filtered out if we are not careful.
    // Let's check the implementation logic:
    // if (seen.has(obj)) return undefined;
    // seen.add(obj);
    
    // If I have [A, A], the second A will be undefined.
    // This is actually desired for breaking infinite loops, but for arrays of references to the same object (DAG), it might be aggressive.
    // However, for JSON serialization for RPC, we usually want a tree, not a DAG where shared references are preserved as shared.
    // If the backend expects distinct objects, this is fine. 
    // If the backend expects [A, A] (two identical objects), the sanitizer might strip the second one.
    // Let's test current behavior.
    
    const output = sanitizePayload(arr);
    // Expectation: [ { name: 'item' } ] because the second one is seen.
    expect(output).toHaveLength(1);
    expect(output[0]).toEqual({ name: 'item' });
  });

  it('should handle complex mixed structure mimicking the crash scenario', () => {
    // Mimic the structure that likely caused the crash
    const circular: any = { name: 'circular' };
    circular.self = circular;
    
    const domNode = {
      nodeType: 1,
      nodeName: 'INPUT',
      value: 'test'
    };
    
    const reactFiber = {
      _reactInternals: {},
      stateNode: domNode
    };
    
    const payload = {
      quoteId: '123',
      cargo: {
        items: [
          {
            id: 'c1',
            ref: circular // Circular reference
          }
        ],
        inputRef: domNode, // DOM node
        component: reactFiber // React internal
      }
    };
    
    const output = sanitizePayload(payload);
    
    expect(output.quoteId).toBe('123');
    expect(output.cargo.items[0].id).toBe('c1');
    expect(output.cargo.items[0].ref.name).toBe('circular');
    expect(output.cargo.items[0].ref.self).toBeUndefined();
    expect(output.cargo.inputRef).toBeUndefined();
    expect(output.cargo.component).toBeUndefined();
  });
});

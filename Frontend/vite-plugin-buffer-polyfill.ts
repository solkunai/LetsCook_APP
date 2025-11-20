import type { Plugin } from 'vite';

export function bufferPolyfillPlugin(): Plugin {
  return {
    name: 'buffer-polyfill',
    enforce: 'pre',
    transformIndexHtml(html) {
      // Inject a comprehensive Buffer polyfill that loads BEFORE modules
      const bufferPolyfill = `
    <script>
      // CRITICAL: Buffer polyfill - executes synchronously before any modules
      (function() {
        'use strict';
        
        // Set up global references
        if (typeof window !== 'undefined') {
          window.global = window.global || window;
          window.globalThis = window.globalThis || window;
        }
        
        // Create a proper Buffer implementation using Uint8Array
        function BufferPolyfill(arg, encodingOrOffset, length) {
          if (!(this instanceof BufferPolyfill)) {
            return new BufferPolyfill(arg, encodingOrOffset, length);
          }
          
          let data;
          if (typeof arg === 'number') {
            data = new Uint8Array(arg);
            if (encodingOrOffset !== undefined && typeof encodingOrOffset === 'number') {
              data.fill(encodingOrOffset);
            }
          } else if (arg instanceof Uint8Array) {
            data = new Uint8Array(arg);
          } else if (Array.isArray(arg)) {
            data = new Uint8Array(arg);
          } else if (typeof arg === 'string') {
            const encoding = encodingOrOffset || 'utf8';
            if (encoding === 'utf8' || encoding === 'utf-8') {
              const encoder = new TextEncoder();
              data = encoder.encode(arg);
            } else {
              // Simple hex/base64 handling
              data = new Uint8Array(arg.length);
              for (let i = 0; i < arg.length; i++) {
                data[i] = arg.charCodeAt(i);
              }
            }
          } else {
            data = new Uint8Array(0);
          }
          
          // Copy properties to this
          for (let i = 0; i < data.length; i++) {
            this[i] = data[i];
          }
          this.length = data.length;
          this._data = data;
          return this;
        }
        
        // Add static methods
        BufferPolyfill.from = function(value, encodingOrOffset, length) {
          if (value instanceof Uint8Array) {
            const buf = new BufferPolyfill();
            buf._data = new Uint8Array(value);
            buf.length = value.length;
            for (let i = 0; i < value.length; i++) {
              buf[i] = value[i];
            }
            return buf;
          }
          if (typeof value === 'string') {
            const encoder = new TextEncoder();
            const data = encoder.encode(value);
            const buf = new BufferPolyfill();
            buf._data = data;
            buf.length = data.length;
            for (let i = 0; i < data.length; i++) {
              buf[i] = data[i];
            }
            return buf;
          }
          if (Array.isArray(value)) {
            return BufferPolyfill.from(new Uint8Array(value));
          }
          return new BufferPolyfill(value, encodingOrOffset, length);
        };
        
        BufferPolyfill.alloc = function(size, fill, encoding) {
          const buf = new BufferPolyfill(size);
          if (fill !== undefined) {
            if (typeof fill === 'number') {
              for (let i = 0; i < size; i++) {
                buf[i] = fill;
                buf._data[i] = fill;
              }
            } else if (typeof fill === 'string') {
              const encoder = new TextEncoder();
              const fillBytes = encoder.encode(fill);
              for (let i = 0; i < size; i++) {
                buf[i] = fillBytes[i % fillBytes.length];
                buf._data[i] = fillBytes[i % fillBytes.length];
              }
            }
          }
          return buf;
        };
        
        BufferPolyfill.isBuffer = function(obj) {
          return obj instanceof BufferPolyfill || 
                 (obj && typeof obj === 'object' && obj.constructor === BufferPolyfill) ||
                 (obj instanceof Uint8Array);
        };
        
        BufferPolyfill.concat = function(list, totalLength) {
          if (!Array.isArray(list)) return BufferPolyfill.alloc(0);
          const total = totalLength || list.reduce((sum, buf) => sum + (buf?.length || 0), 0);
          const result = BufferPolyfill.alloc(total);
          let offset = 0;
          for (const buf of list) {
            if (buf && buf.length) {
              const data = buf._data || buf;
              for (let i = 0; i < data.length && offset < total; i++) {
                result[offset] = data[i];
                result._data[offset] = data[i];
                offset++;
              }
            }
          }
          return result;
        };
        
        // Instance methods
        BufferPolyfill.prototype.toBuffer = function() { return this; };
        BufferPolyfill.prototype.toString = function(encoding) {
          encoding = encoding || 'utf8';
          if (encoding === 'utf8' || encoding === 'utf-8') {
            const decoder = new TextDecoder();
            return decoder.decode(this._data || new Uint8Array(this));
          }
          return Array.from(this._data || this).map(b => String.fromCharCode(b)).join('');
        };
        
        // Set globally
        if (typeof window !== 'undefined') {
          window.Buffer = BufferPolyfill;
          window.global.Buffer = BufferPolyfill;
          window.globalThis.Buffer = BufferPolyfill;
          if (typeof self !== 'undefined') {
            self.Buffer = BufferPolyfill;
          }
        }
        
        // Also set on global scope
        if (typeof global !== 'undefined') {
          global.Buffer = BufferPolyfill;
        }
      })();
    </script>`;
      
      // Insert before the first script tag
      const scriptMatch = html.match(/<script[^>]*>/);
      if (scriptMatch) {
        return html.replace(scriptMatch[0], bufferPolyfill + '\n    ' + scriptMatch[0]);
      }
      // Fallback: insert before body closing tag
      return html.replace('</body>', bufferPolyfill + '\n  </body>');
    },
  };
}


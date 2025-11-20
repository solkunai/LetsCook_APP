import type { Plugin } from 'vite';

export function bufferPolyfillPlugin(): Plugin {
  return {
    name: 'buffer-polyfill',
    transformIndexHtml(html) {
      // Inject Buffer polyfill using CDN - loads synchronously before modules
      const bufferScript = `
    <!-- Buffer polyfill - must load before any modules -->
    <script src="https://cdn.jsdelivr.net/npm/buffer@6.0.3/index.min.js"></script>
    <script>
      // Set Buffer globally after CDN loads
      (function() {
        if (typeof window !== 'undefined') {
          window.global = window.global || window;
          window.globalThis = window.globalThis || window;
          
          // Buffer should be available from CDN, but ensure it's global
          if (typeof Buffer !== 'undefined') {
            window.Buffer = Buffer;
            window.global.Buffer = Buffer;
            window.globalThis.Buffer = Buffer;
            if (typeof self !== 'undefined') {
              self.Buffer = Buffer;
            }
          }
        }
      })();
    </script>`;
      
      // Insert right before the module script
      return html.replace(
        /(<script type="module" src="\/src\/main\.tsx"><\/script>)/,
        bufferScript + '\n    $1'
      );
    },
  };
}


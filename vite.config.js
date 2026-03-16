import { defineConfig } from 'vite';
import monkey, { cdn } from 'vite-plugin-monkey';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    monkey({
      entry: 'src/modules/main.js',
      userscript: {
        name: 'Instagram Follower Analyzer',
        namespace: 'https://github.com/UNKchr/ig-analyzer',
        version: '3.4.4', 
        description: 'Analyze Instagram followers and following lists with Anti-Ban retry logic, Progress Bar, CSV Export, and Advanced Metrics.',
        author: 'UNKchr',
        match: ['https://www.instagram.com/*'],
        updateURL: 'https://raw.githubusercontent.com/UNKchr/ig-analyzer/main/dist/instagram-follower-analyzer.user.js',
        downloadURL: 'https://raw.githubusercontent.com/UNKchr/ig-analyzer/main/dist/instagram-follower-analyzer.user.js',
        license: 'MIT',
        icon: 'https://www.google.com/s2/favicons?sz=64&domain=instagram.com',
        // TamperGuide library loaded as external dependency
        require: [
          'https://cdn.jsdelivr.net/gh/UNKchr/tamperguide@df759188874072c079c718c0f2cfdf4e5fa51246/tamperguide/tamperGuide.js',
        ],
        grant: [
          'GM_getValue',
          'GM_setValue',
          'GM_deleteValue',
          'GM_registerMenuCommand',
        ],
      },
      build: {
        // TamperGuide is loaded via @require and accessed via window.tamperGuide
        externalGlobals: {},
        
        fileName: 'instagram-follower-analyzer.user.js',
      },
    }),
  ],
  build: {
    rollupOptions: {
      input: 'src/modules/main.js',
    }
  }
});
import { defineConfig } from 'vite';
import monkey, { cdn } from 'vite-plugin-monkey';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    monkey({
      entry: 'src/modules/main.js',
      userscript: {
        name: {
          '': 'Instagram Follower Analyzer',
          es: 'Analizador de seguidores de Instagram',
          'es-419': 'Analizador de seguidores de Instagram',
          pt: 'Analisador de seguidores do Instagram',
          'pt-BR': 'Analisador de seguidores do Instagram',
          'pt-PT': 'Analisador de seguidores do Instagram',
        },
        namespace: 'https://github.com/UNKchr/ig-analyzer',
        version: '3.8.2', 
        description: {
          '': 'Analyze Instagram followers and following lists, detect non-followers, story anomalies, and export your data securely.',
          es: 'Analiza seguidores y seguidos de Instagram, detecta quién no te sigue de vuelta, anomalías en historias y exporta datos.',
          'es-419': 'Analiza seguidores y seguidos de Instagram, detecta quién no te sigue de vuelta, anomalías en historias y exporta datos.',
          pt: 'Analise seguidores e quem não te segue de volta no Instagram, detecte anomalias em stories e exporte dados.',
          'pt-BR': 'Analise seguidores e quem não te segue de volta no Instagram, detecte anomalias em stories e exporte dados.',
          'pt-PT': 'Analisa seguidores e quem não te segue de volta no Instagram, deteta anomalias em stories e exporte dados.',
        },
        author: 'UNKchr',
        match: ['https://www.instagram.com/*'],
        updateURL: 'https://raw.githubusercontent.com/UNKchr/ig-analyzer/main/dist/instagram-follower-analyzer.user.js',
        downloadURL: 'https://raw.githubusercontent.com/UNKchr/ig-analyzer/main/dist/instagram-follower-analyzer.user.js',
        license: 'MIT',
        icon: 'https://www.google.com/s2/favicons?sz=64&domain=instagram.com',
        // TamperGuide library loaded as external dependency
        require: [
          'https://cdn.jsdelivr.net/gh/UNKchr/tamperguide@e7907fd8af1af0bc3af0abdcdc756d38818c217c/tamperguide/tamperGuide.js',
        ],
        grant: [
          'GM_addStyle',
          'GM_deleteValue',
          'GM_getValue',
          'GM_listValues',
          'GM_setValue',
          'GM_registerMenuCommand',
          'unsafeWindow',
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
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
          en: 'Instagram Follower Analyzer',
          es: 'Analizador de seguidores de Instagram',
          'es-419': 'Analizador de seguidores de Instagram',
          pt: 'Analisador de seguidores do Instagram',
          'pt-BR': 'Analisador de seguidores do Instagram',
          'pt-PT': 'Analisador de seguidores do Instagram',
        },
        namespace: 'https://github.com/UNKchr/ig-analyzer',
        version: '3.12.1', 
        description: {
          '': 'Analyze Instagram followers and following lists, detect non-followers, story anomalies, and export your data securely.',
          en: 'Analyze Instagram followers and following lists, detect non-followers, story anomalies, and export your data securely.',
          es: 'Analiza seguidores y seguidos de Instagram, detecta quién no te sigue de vuelta, anomalías en historias y exporta datos.',
          'es-419': 'Analiza seguidores y seguidos de Instagram, detecta quién no te sigue de vuelta, anomalías en historias y exporta datos.',
          pt: 'Analise seguidores e quem não te segue de volta no Instagram, detecte anomalias em stories e exporte dados.',
          'pt-BR': 'Analise seguidores e quem não te segue de volta no Instagram, detecte anomalias em stories e exporte dados.',
          'pt-PT': 'Analisa seguidores e quem não te segue de volta no Instagram, deteta anomalias em stories e exporte dados.',
        },
        author: 'UNKchr',
        match: ['https://www.instagram.com/*'],
        noframes: true,
        updateURL: 'https://raw.githubusercontent.com/UNKchr/ig-analyzer/main/dist/instagram-follower-analyzer.user.js',
        downloadURL: 'https://raw.githubusercontent.com/UNKchr/ig-analyzer/main/dist/instagram-follower-analyzer.user.js',
        license: 'Custom',
        icon: 'https://www.google.com/s2/favicons?sz=64&domain=instagram.com',
        // TamperGuide library loaded as external dependency
        require: [
          'https://cdn.jsdelivr.net/gh/UNKchr/tamperguide@b92f576df4ee0baea5d113c6ad93ac2bf478c2cc/tamperguide/tamperGuide.js',
        ],
        grant: [
          'GM_addStyle',
          'GM_deleteValue',
          'GM_download',
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
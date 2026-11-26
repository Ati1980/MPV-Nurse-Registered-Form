import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const firebaseConfigPath = path.resolve(__dirname, 'firebase-applet-config.json');
  let localFirebaseConfig: Record<string, string> = {};
  if (fs.existsSync(firebaseConfigPath)) {
    try {
      localFirebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf-8'));
    } catch {
      localFirebaseConfig = {};
    }
  }

  const firebaseConfig = {
    projectId: env.VITE_FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || localFirebaseConfig.projectId || '',
    appId: env.VITE_FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID || localFirebaseConfig.appId || '',
    apiKey: env.VITE_FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || localFirebaseConfig.apiKey || '',
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN || localFirebaseConfig.authDomain || '',
    firestoreDatabaseId:
      env.VITE_FIREBASE_DATABASE_ID ||
      process.env.VITE_FIREBASE_DATABASE_ID ||
      localFirebaseConfig.firestoreDatabaseId ||
      '',
    storageBucket:
      env.VITE_FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET || localFirebaseConfig.storageBucket || '',
    messagingSenderId:
      env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
      process.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
      localFirebaseConfig.messagingSenderId ||
      '',
    measurementId:
      env.VITE_FIREBASE_MEASUREMENT_ID || process.env.VITE_FIREBASE_MEASUREMENT_ID || localFirebaseConfig.measurementId || '',
  };

  return {
    define: {
      __FIREBASE_CONFIG__: JSON.stringify(firebaseConfig),
    },
    plugins: [
      react(),
      tailwindcss(),
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const srcAssets = path.resolve(__dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

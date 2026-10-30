// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-05-10',

  devtools: { enabled: false },

  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    '@vueuse/nuxt',
  ],

  components: [
    {
      path: '~/components',
      pathPrefix: false,
    },
  ],

  css: ['~/assets/css/main.css'],

  tailwindcss: {
    cssPath: '~/assets/css/main.css',
    configPath: 'tailwind.config.ts',
  },

  runtimeConfig: {
    authSecret: process.env.NUXT_AUTH_SECRET || 'dev-secret-change-in-production',
    googleSheetId: process.env.GOOGLE_SHEET_ID || '124p_ZVSTqLTkIs9o04-7BsJjDH6SLFFabArHW9UQ7FI',
    googleDriveArchiveFolderId: process.env.GOOGLE_DRIVE_ARCHIVE_FOLDER_ID || '17Y406tMwu0c-mHcl4WlmwbSY8Cg8K9I3',
    googleServiceAccountKey: process.env.GOOGLE_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_CREDENTIALS || '',
    googleClientEmail: process.env.GOOGLE_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
    googlePrivateKey: process.env.GOOGLE_PRIVATE_KEY || '',
    public: {
      appUrl: process.env.NUXT_PUBLIC_APP_URL || 'http://localhost:3000',
      googleMapsApiKey: process.env.NUXT_PUBLIC_GOOGLE_MAPS_KEY || process.env.NUXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
      supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL || '',
      supabaseKey: process.env.NUXT_PUBLIC_SUPABASE_KEY || '',
    },
  },

  app: {
    head: {
      title: 'SM Flow • Silicon Marketing',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'SM Flow - Silicon Marketing Order Management System' },
        { name: 'theme-color', content: '#ffffff' },
      ],
      link: [
        { rel: 'icon', type: 'image/png', href: '/favicon.png' },
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap' },
      ],
    },
  },

  typescript: {
    strict: true,
  },

  nitro: {
    experimental: {
      asyncContext: true,
    },
    hidePoweredBy: true,
  },

  vite: {
    server: {
      allowedHosts: true,
      watch: {
        usePolling: false,
        ignored: ['**/node_modules/**', '**/.git/**', '**/.nuxt/**', '**/.output/**'],
      },
    },
    optimizeDeps: {
      include: [
        'lucide-vue-next',
        '@vueuse/core',
        'gsap',
        'canvas-confetti',
        '@supabase/supabase-js',
        'date-fns',
      ],
    },
  },
})

/// <reference types="vite/client" />
/// <reference path="./types/neutralino.d.ts" />

// Декларація для імпорту .vue у JS+JSDoc-проєкті (потрібно tsc --checkJs).
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

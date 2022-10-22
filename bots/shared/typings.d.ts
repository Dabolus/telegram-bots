declare module '*.yaml' {
  const content: any;
  export default content;
}

declare const fetch: typeof import('undici').fetch;

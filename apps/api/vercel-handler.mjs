import { createApiHandler } from './gateway.mjs';

// Vercel invokes this Node handler with the same request/response stream used
// by the local HTTP server. The Gemini key is read only at request time from
// server-side environment variables.
export default createApiHandler();

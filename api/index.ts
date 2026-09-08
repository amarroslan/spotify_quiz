// Vercel's Node runtime accepts an Express-compatible request handler.
// The implementation lives in backend/src/app.js so local and hosted paths share one API.
// @ts-nocheck
import app from '../backend/src/app.js';

export default app;

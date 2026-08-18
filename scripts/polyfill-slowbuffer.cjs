/**
 * Polyfill for Node.js 22+ which removed SlowBuffer.
 * Required by legacy CJS packages: buffer-equal-constant-time → jwa → jsonwebtoken.
 * This file is preloaded via --require before tsx starts server.ts.
 */
'use strict';
const buf = require('buffer');
if (buf && !buf.SlowBuffer) {
  buf.SlowBuffer = buf.Buffer;
}

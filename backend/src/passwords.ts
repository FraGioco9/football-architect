import setupWasm from 'argon2id/lib/setup.js';
import simdModule from 'argon2id/dist/simd.wasm';
import nonSimdModule from 'argon2id/dist/no-simd.wasm';

import {createPasswordService} from './password-core.ts';
const wasmHash = setupWasm(
  (imports: WebAssembly.Imports) => WebAssembly.instantiate(simdModule, imports).then(instance => ({instance, module:simdModule})),
  (imports: WebAssembly.Imports) => WebAssembly.instantiate(nonSimdModule, imports).then(instance => ({instance, module:nonSimdModule})),
);

export const {hashPassword,verifyPassword}=createPasswordService(wasmHash);

declare module 'argon2id/lib/setup.js' {
  type Input = {password: Uint8Array; salt: Uint8Array; passes: number; parallelism: number;
    memorySize: number; hashLength: number};
  type Hash = (options: Input) => Uint8Array;
  export default function setupWasm(
    simd: (imports: WebAssembly.Imports) => Promise<WebAssembly.WebAssemblyInstantiatedSource>,
    noSimd: (imports: WebAssembly.Imports) => Promise<WebAssembly.WebAssemblyInstantiatedSource>,
  ): Promise<Hash>;
}
declare module '*.wasm' {
  const compiled: WebAssembly.Module;
  export default compiled;
}

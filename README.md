# @formio/vm

A lightweight JavaScript sandboxing library supporting two VM backends:

- `QuickJSVM`: a WebAssembly-based sandbox using QuickJS-emscripten, the [QuickJS Javascript engine](https://bellard.org/quickjs/) compiled to WebAssembly for use in Node.js or modern browsers
- `IsolateVM`: a sandbox using [isolated-vm](https://github.com/laverdet/isolated-vm), which leverages V8's `Isolate` interface for use in Node.js

## Installation

```bash
npm install @formio/vm
yarn add @formio/vm
```

Please note that in addition to isolated-vm's [installation requirements](https://github.com/laverdet/isolated-vm?tab=readme-ov-file#requirements), if you're using Node.js >= v20 with `IsolateVM` you'll need to pass the `--no-node-snapshot` option.

## API Reference

### Shared Options

- `timeoutMs?: number`: a timeout in milliseconds. The evaluate function will throw an error when a script exceeds this timeout. Defaults to 1000 milliseconds.
- `memoryLimitMb?: number`: the memory limit in MB. The evaluate function will throw an error when a script exceeds this memory limit. Defaults to 128 MB.
- `env?: string`: a shared evaluation environment. Normal calls to evaluate functions will not share state, but the `env` will be precompiled into the context. See below for details.

### IsolateVM

#### Methods

- `evaluate(code: string, globals?: Record<string, TransferableValue>, timeout = VMOptions.timeoutMs): Promise<any>`: assign the globals object (if present) by key to the global scope and asynchronously evaluate the code. The last expression is returned as the result.
- `evaluateSync(code: string, globals?: Record<string, TransferableValue>, timeout = VMOptions.timeoutMs): any`: assign the globals object (if present) by key to the global scope and evaluate the code. The last expression is returned as the result.
- `dispose(): void`: free references and dispose of the underlyling v8 isolate.

### QuickJSVM

#### Methods

- `init(): Promise<void>`: initialize the underlying WebAssembly module. Required to use an instance of QuickJSVM.
- `evaluate(code: string, globals?: Record<string, TransferableValue>, timeout = VMOptions.timeoutMs): any`: assign the globals object (if present) by key to the global scope and _synchronously_ evaluate the code. The last expression is returned as the result.
- `dispose(): void` - free references to the underlyling WASM module so it can be garbage collected.

## Usage

### QuickJSVM

```ts
import { QuickJSVM } from '@formio/vm';

const vm = new QuickJSVM();
await vm.init();

const result = vm.evaluate('const a = "Hello"; `${a}, world!`'); // returns "Hello, world!"
```

### IsolateVM

```ts
import { IsolateVM } from '@formio/vm';

const vm = new IsolateVM();

const result = vm.evaluateSync('const a = "Hello"; `${a}, world!`'); // returns "Hello, world!"
// or...
const result = await vm.evaluate('const a = "Hello"; `${a}, world!`'); // returns "Hello, world!"
```

### Envs

VM evaluation contexts do not share state.

```ts
const isolateVM = new IsolateVM();
const result1 = isolateVM.evaluateSync('const a = 1; a + 1;'); // 2
const result2 = isolateVM.evaluateSync('a + 1'); // throws an error, 'a is not defined'

const quickJSVM = new QuickJSVM();
const result1 = quickJSVM.evaluate('const a = 1; a + 1;'); // 2
const result2 = quickJSVM.evaluate('a + 1'); // throws an error, "'a' is not defined"
```

However, each VM takes an `env` option which precompiles a script environment into its evaluation contexts. These environments are not mutable across evaluation contexts. **DO NOT INCLUDE UNTRUSTED CODE IN A VM'S ENVIRONMENT.**

```ts
const isolateVM = new IsolateVM({ env: 'const obj = { a: 1, b: 1 };' });
const result1 = isolateVM.evaluateSync('obj.a = obj.a + 1; delete obj.b; obj;'); // { a: 2 }
const result2 = isolateVM.evaluateSync('obj;'); // { a: 1, b: 1 }

const quickJSVM = new QuickJSVM({ env: 'const obj = { a: 1, b: 1 };' });
const result1 = quickJSVM.evaluateSync('obj.a = obj.a + 1; delete obj.b; obj;'); // { a: 2 }
const result2 = quickJSVM.evaluateSync('obj;'); // { a: 1, b: 1 }
```

You may consider adding (a modicum of) type safety by extending the VM class with a self-contained environment and corresponding methods.

```ts
class AdderVM extends IsolateVM {
  constructor() {
    super({ env: 'function add(a, b) { return a + b; }' });
  }

  safeAdd(a: number, b: number) {
    return this.evaluateSync('add(a, b)', { a, b });
  }
}

const vm = new AdderVM();
const result = vm.safeAdd(1, 2); // 3
```

### Security Notes

- Values need to be serialized in order to be "transferred" into a VM's evaluation context. Note that although IsolateVM uses the [structured clone algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm) to transfer objects with complex parameters (e.g. Date, Map), QuickJSVM for the moment accepts only JSON parseable values (i.e. primitives).
- Generally speaking it's best to just transfer JSON parsebale values. DO NOT leak VM references (e.g. ivm.Reference, ivm.ExternalCopy, QuickJSHandle) into an evaluation context or environment that will interact with untrusted code.

import {
  getQuickJS,
  QuickJSContext,
  QuickJSHandle,
  QuickJSWASMModule,
  shouldInterruptAfterDeadline,
} from 'quickjs-emscripten';
import { TransferableValue, VMOptions } from './types';

export class QuickJSVM {
  private module: QuickJSWASMModule | null;
  private timeout: number;
  private memoryLimit: number;
  private env: string;

  constructor(options: VMOptions = {}) {
    this.module = null;
    this.timeout = options.timeoutMs || 1000; // Default timeout in ms
    this.memoryLimit = 1024 * 1024 * (options.memoryLimitMb ?? 128); // Default memory limit in megabytes
    this.env = options.env ?? '';
  }

  async init() {
    this.module = await getQuickJS();
  }

  transfer(vm: QuickJSContext, value: TransferableValue): QuickJSHandle | undefined {
    // Skip unsupported types
    if (
      typeof value === 'undefined' ||
      typeof value === 'function' ||
      typeof value === 'symbol' ||
      typeof value === 'bigint'
    ) {
      return;
    }

    if (typeof value === 'string') {
      return vm.newString(value);
    } else if (typeof value === 'number') {
      return vm.newNumber(value);
    } else if (typeof value === 'boolean') {
      return value ? vm.true : vm.false;
    } else if (Array.isArray(value)) {
      const arrayHandle = vm.newArray();
      value.forEach((item, index) => {
        if (arrayHandle) {
          const resultHandle = this.transfer(vm, item);
          if (resultHandle) {
            vm?.setProp(arrayHandle, String(index), resultHandle);
            resultHandle.dispose();
          }
        }
      });
      return arrayHandle;
    } else if (typeof value === 'object') {
      if (value === null) {
        return vm.null;
      } else {
        const objHandle = vm.newObject();
        for (const nestedKey in value) {
          const resultHandle = this.transfer(vm, value[nestedKey]);
          if (resultHandle) {
            vm.setProp(objHandle, nestedKey, resultHandle);
            resultHandle.dispose();
          }
        }
        return objHandle;
      }
    }
  }

  evaluate(code: string, globals?: Record<string, TransferableValue>, timeout = this.timeout) {
    if (!this.module) {
      throw new Error('Cannot evaluate, VM not initialized');
    }
    const runtime = this.module.newRuntime({
      memoryLimitBytes: this.memoryLimit,
      interruptHandler: shouldInterruptAfterDeadline(Date.now() + timeout),
    });
    const vm = runtime.newContext();
    const logHandle = vm.newFunction('log', (...args) => {
      const nativeArgs = args.map(vm.dump);
      console.log('QuickJSVM:', ...nativeArgs);
    });
    const consoleHandle = vm.newObject();
    vm.setProp(consoleHandle, 'log', logHandle);
    vm.setProp(vm.global, 'console', consoleHandle);
    consoleHandle.dispose();
    logHandle.dispose();
    if (this.env.length > 0) {
      const compileResult = vm.evalCode(this.env);
      try {
        vm.unwrapResult(compileResult);
        compileResult.dispose();
      } catch (e) {
        console.error('Error evaluating env:', e);
        throw e;
      }
    }
    if (globals) {
      Object.entries(globals).forEach(([key, value]) => {
        if (value === undefined) {
          return;
        }
        const handle = this.transfer(vm, value);
        if (handle) {
          vm.setProp(vm.global, key, handle);
          handle.dispose();
        }
      });
    }
    const resultHandle = vm.evalCode(code);
    const result = vm.dump(vm.unwrapResult(resultHandle));
    resultHandle.dispose();
    vm.dispose();
    runtime.dispose();
    return result;
  }

  dispose() {
    if (this.module) {
      this.module = null;
    }
  }
}

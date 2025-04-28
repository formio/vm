import ivm from 'isolated-vm';
import debug from 'debug';
import { TransferableValue, VMOptions } from './types';

const log = debug('formio:vm');

export class IsolateVM {
  private isolate: ivm.Isolate | null;
  private script: ivm.Script | null = null;
  private memoryLimit: number;
  private timeout: number;

  constructor(options: VMOptions = {}) {
    this.memoryLimit = options.memoryLimitMb || 128; // Default memory limit in MB
    this.timeout = options.timeoutMs || 1000; // Default timeout in ms
    this.isolate = new ivm.Isolate({ memoryLimit: this.memoryLimit });

    this.script = options.env ? this.isolate.compileScriptSync(options.env) : null;
  }

  async evaluate(
    code: string,
    globals?: Record<string, TransferableValue>,
    options: Omit<VMOptions, 'memoryLimitMb'> = {
      timeoutMs: this.timeout,
    },
  ) {
    if (!this.isolate) {
      throw new Error('Cannot evaluate, IsolateVM isolate has been disposed or is not initialized');
    }
    const context = await this.isolate.createContext();
    const globalRef = context.global;
    // Set up a reference to the global object
    await globalRef.set('global', globalRef.derefInto());
    // Create a console.log function that ties into debug
    const consoleObj = {
      log: new ivm.Callback((...args: unknown[]) => {
        log('IsolateVM:', ...args);
      }),
    };
    await globalRef.set('console', consoleObj, { copy: true });
    await this.script?.run(context);
    if (options.env) {
      await context.eval(options.env, { timeout: options.timeoutMs || this.timeout });
    }
    if (globals) {
      // Transfer globals to ivm context
      for (const key of Object.keys(globals)) {
        try {
          await context.global.set(key, globals[key], { copy: true });
        } catch (e) {
          console.error(`Error setting global ${key}:`, e);
        }
      }
    }
    // Evaluate code
    const result = await context.eval(code, {
      copy: true,
      timeout: options.timeoutMs || this.timeout,
    });
    context.release();
    return result;
  }

  evaluateSync(
    code: string,
    globals?: Record<string, TransferableValue>,
    options: Omit<VMOptions, 'memoryLimitMb'> = {
      timeoutMs: this.timeout,
    },
  ) {
    if (!this.isolate) {
      throw new Error('Cannot evaluate, IsolateVM isolate has been disposed or is not initialized');
    }
    const context = this.isolate.createContextSync();
    const globalRef = context.global;
    // Set up a reference to the global object
    globalRef.setSync('global', globalRef.derefInto());
    // Create a console.log function
    const consoleObj = {
      log: new ivm.Callback((...args: unknown[]) => {
        log('IsolateVM:', ...args);
      }),
    };
    globalRef.setSync('console', consoleObj, { copy: true });
    this.script?.runSync(context);
    if (options.env) {
      context.evalSync(options.env, { timeout: options.timeoutMs || this.timeout });
    }
    if (globals) {
      // Transfer globals to ivm context
      for (const key of Object.keys(globals)) {
        try {
          context.global.setSync(key, globals[key], { copy: true });
        } catch (e) {
          console.error(`Error setting global ${key}:`, e);
        }
      }
    }
    // Evaluate code
    const result = context.evalSync(code, {
      copy: true,
      timeout: options.timeoutMs || this.timeout,
    });
    context.release();
    return result;
  }

  dispose() {
    if (this.isolate) {
      this.isolate.dispose();
      this.isolate = null;
    }
  }
}

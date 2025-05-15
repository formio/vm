import ivm from 'isolated-vm';
import debug from 'debug';
import { TransferableValue, VMOptions, EvaluateOptions } from './types';

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
    options: EvaluateOptions = {
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
    if (globals) {
      // Transfer globals to ivm context
      for (const key of Object.keys(globals)) {
        try {
          await context.global.set(key, globals[key], { copy: true });
        } catch (e) {
          log(`Error setting global ${key}:`, e);
        }
      }
    }
    if (options.modifyEnv) {
      try {
        await context.eval(options.modifyEnv, { timeout: options.timeoutMs || this.timeout });
      } catch (e) {
        log('Error modifying env:', e);
      }
    }
    // Evaluate code
    try {
      const result = await context.eval(code, {
        copy: true,
        timeout: options.timeoutMs || this.timeout,
      });
      return result;
    } finally {
      context.release();
    }
  }

  evaluateSync(
    code: string,
    globals?: Record<string, TransferableValue>,
    options: EvaluateOptions = {
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
    if (globals) {
      // Transfer globals to ivm context
      for (const key of Object.keys(globals)) {
        try {
          context.global.setSync(key, globals[key], { copy: true });
        } catch (e) {
          log(`Error setting global ${key}:`, e);
        }
      }
    }
    if (options.modifyEnv) {
      try {
        context.evalSync(options.modifyEnv, { timeout: options.timeoutMs || this.timeout });
      } catch (e) {
        log('Error modifying env:', e);
      }
    }
    try {
      // Evaluate code
      const result = context.evalSync(code, {
        copy: true,
        timeout: options.timeoutMs || this.timeout,
      });
      return result;
    } finally {
      context.release();
    }
  }

  dispose() {
    if (this.isolate) {
      this.isolate.dispose();
      this.isolate = null;
    }
  }
}

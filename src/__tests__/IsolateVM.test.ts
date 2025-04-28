import { expect } from 'chai';

import { IsolateVM } from '../IsolateVM';

describe('IsolateVM', function () {
  it('should initialize and evaluate code', async function () {
    const isolateVM = new IsolateVM();
    const result = await isolateVM.evaluate('1 + 1');
    expect(result).to.equal(2);
    isolateVM.dispose();
  });

  it('should evaluate code with globals', async function () {
    const isolateVM = new IsolateVM();
    const result = await isolateVM.evaluate('a + b', { a: 1, b: 2 });
    expect(result).to.equal(3);
    isolateVM.dispose();
  });

  it('should evaluate code with an env', async function () {
    const isolateVM = new IsolateVM({ env: 'let a = 1; let b = 2;' });
    const result = await isolateVM.evaluate('a + b');
    expect(result).to.equal(3);
    isolateVM.dispose();
  });

  it('should throw an error when evaluation exceeds the timeout', async function () {
    const isolateVM = new IsolateVM();
    try {
      await isolateVM.evaluate('while (true) {}', {}, { timeoutMs: 300 });
    } catch (e: any) {
      expect(e.message).to.include('execution timed out');
    }
    isolateVM.dispose();
  });

  it('two evaluation contexts should not share state', async function () {
    const isolateVM = new IsolateVM();
    const result = await isolateVM.evaluate('let a = 1; a + 1');
    expect(result).to.equal(2);
    try {
      await isolateVM.evaluate('a + 1');
    } catch (e) {
      expect((e as Error).message).to.include('a is not defined');
    }
  });

  it('two evaluation contexts should share an env', async function () {
    const isolateVM = new IsolateVM({ env: 'let a = 1; let b = 2;' });
    const result = await isolateVM.evaluate('a + b');
    expect(result).to.equal(3);
    const result2 = await isolateVM.evaluate('a + b');
    expect(result2).to.equal(3);
    isolateVM.dispose();
  });

  it('evaluation contexts should not be mutable across different evaluation contexts', async function () {
    const isolateVM = new IsolateVM({ env: 'const obj = { a: 1, b: 2 };' });
    const result = await isolateVM.evaluate('obj.a = obj.a + 1; delete obj.b; obj;');
    expect(result).to.deep.equal({ a: 2 });
    const result2 = await isolateVM.evaluate('obj');
    expect(result2).to.deep.equal({ a: 1, b: 2 });
    isolateVM.dispose();
  });

  it('should not persist mutations to JavaScript intrinsic objects', async function () {
    const isolateVM = new IsolateVM();
    const result = await isolateVM.evaluate(
      'const originalPush = Array.prototype.push; Array.prototype.push = function() { return originalPush.call(this, "hacked") }; const arr = [1, 2]; arr.push(3); arr;',
    );
    expect(result).to.deep.equal([1, 2, 'hacked']);
    const result2 = await isolateVM.evaluate('const arr = [1, 2]; arr.push(3); arr;');
    expect(result2).to.deep.equal([1, 2, 3]);
  });

  it('should throw an error when the VM is disposed', async function () {
    const isolateVM = new IsolateVM();
    isolateVM.dispose();
    try {
      await isolateVM.evaluate('1 + 1');
    } catch (e) {
      expect((e as Error).message).to.include(
        'Cannot evaluate, IsolateVM isolate has been disposed or is not initialized',
      );
    }
  });
});

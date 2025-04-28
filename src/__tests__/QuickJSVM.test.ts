import { expect } from 'chai';

import { QuickJSVM } from '../QuickJSVM';

describe('QuickJSVM', function () {
  it('should initialize and evaluate code', async function () {
    const quickJSVM = new QuickJSVM();
    await quickJSVM.init();
    const result = quickJSVM.evaluate('1 + 1');
    expect(result).to.equal(2);
    quickJSVM.dispose();
  });

  it('should evaluate code with globals', async function () {
    const quickJSVM = new QuickJSVM();
    await quickJSVM.init();
    const result = await quickJSVM.evaluate('a + b', { a: 1, b: 2 });
    expect(result).to.equal(3);
    quickJSVM.dispose();
  });

  it('should evaluate code with an env', async function () {
    const quickJSVM = new QuickJSVM({ env: 'let a = 1; let b = 2;' });
    await quickJSVM.init();
    const result = quickJSVM.evaluate('a + b');
    expect(result).to.equal(3);
    quickJSVM.dispose();
  });

  it('should throw an error when evaluation exceeds the timeout', async function () {
    const quickJSVM = new QuickJSVM();
    await quickJSVM.init();
    try {
      quickJSVM.evaluate('while (true) {}', {}, { timeoutMs: 300 });
    } catch (e: any) {
      expect(e.message).to.include('interrupted');
    }
    quickJSVM.dispose();
  });

  it('two evaluation contexts should not share state', async function () {
    const quickJSVM = new QuickJSVM();
    await quickJSVM.init();
    const result = await quickJSVM.evaluate('let a = 1; a + 1');
    expect(result).to.equal(2);
    try {
      quickJSVM.evaluate('a + 1');
    } catch (e) {
      expect((e as Error).message).to.include("'a' is not defined");
    }
  });

  it('two evaluation contexts should share an env', async function () {
    const quickJSVM = new QuickJSVM({ env: 'let a = 1; let b = 2;' });
    await quickJSVM.init();
    const result = quickJSVM.evaluate('a + b');
    expect(result).to.equal(3);
    const result2 = quickJSVM.evaluate('a + b');
    expect(result2).to.equal(3);
    quickJSVM.dispose();
  });

  it('evaluation contexts should not be mutable across different evaluation contexts', async function () {
    const quickJSVM = new QuickJSVM({ env: 'const obj = { a: 1, b: 2 };' });
    await quickJSVM.init();
    const result = quickJSVM.evaluate('obj.a = obj.a + 1; delete obj.b; obj;');
    expect(result).to.deep.equal({ a: 2 });
    const result2 = quickJSVM.evaluate('obj');
    expect(result2).to.deep.equal({ a: 1, b: 2 });
    quickJSVM.dispose();
  });

  it('envs can be passed as runtime options', async function () {
    const quickJSVM = new QuickJSVM();
    await quickJSVM.init();
    const result = quickJSVM.evaluate(
      'obj.a = obj.a + 1; delete obj.b; obj;',
      {},
      { env: 'const obj = { a: 1, b: 2 };' },
    );
    expect(result).to.deep.equal({ a: 2 });
    const result2 = quickJSVM.evaluate('obj', {}, { env: 'const obj = { a: 1, b: 2 };' });
    expect(result2).to.deep.equal({ a: 1, b: 2 });
    quickJSVM.dispose();
  });

  it('envs that are passed as runtime options should not persist between evaluation contexts', async function () {
    const quickJSVM = new QuickJSVM();
    await quickJSVM.init();
    const result = quickJSVM.evaluate(
      'obj.a = obj.a + 1; delete obj.b; obj;',
      {},
      { env: 'const obj = { a: 1, b: 2 };' },
    );
    expect(result).to.deep.equal({ a: 2 });
    try {
      quickJSVM.evaluate('obj');
    } catch (e: any) {
      expect(e.message).to.deep.contain("'obj' is not defined");
    } finally {
      quickJSVM.dispose();
    }
  });

  it('should not persist mutations to JavaScript intrinsic objects', async function () {
    const quickJSVM = new QuickJSVM();
    await quickJSVM.init();
    const result = quickJSVM.evaluate(
      'const originalPush = Array.prototype.push; Array.prototype.push = function() { return originalPush.call(this, "hacked") }; const arr = [1, 2]; arr.push(3); arr;',
    );
    expect(result).to.deep.equal([1, 2, 'hacked']);
    const result2 = await quickJSVM.evaluate('const arr = [1, 2]; arr.push(3); arr;');
    expect(result2).to.deep.equal([1, 2, 3]);
    quickJSVM.dispose();
  });

  it('should throw an error when the VM is not initialized', async function () {
    const quickJSVM = new QuickJSVM();
    await quickJSVM.init();
    quickJSVM.dispose();
    try {
      await quickJSVM.evaluate('1 + 1');
    } catch (e) {
      expect((e as Error).message).to.include('Cannot evaluate, VM not initialized');
    }
  });
});

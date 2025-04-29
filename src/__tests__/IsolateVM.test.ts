import './setup.test.js';
import { expect } from 'chai';
import { IsolateVM } from '../IsolateVM.js';

describe('IsolateVM', function () {
  describe('evaluate', function () {
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
      await expect(
        isolateVM.evaluate('while (true) {}', {}, { timeoutMs: 300 }),
      ).to.be.rejectedWith('Script execution timed out.');
      isolateVM.dispose();
    });

    it('two evaluation contexts should not share state', async function () {
      const isolateVM = new IsolateVM();
      const result = await isolateVM.evaluate('let a = 1; a + 1');
      expect(result).to.equal(2);
      await expect(isolateVM.evaluate('a + 1')).to.be.rejectedWith('a is not defined');
      isolateVM.dispose();
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

    it('globals can be modified with untrusted code', async function () {
      const isolateVM = new IsolateVM();
      const result = await isolateVM.evaluate(
        'obj.a = obj.a + 1; delete obj.b; obj;',
        { obj: { a: 1, b: 2 } },
        { modifyEnv: 'obj.a += 1; obj.b += 1;' },
      );
      expect(result).to.deep.equal({ a: 3 });
      isolateVM.dispose();
    });

    it('globals that are modified via runtime options should not persist between evaluation contexts', async function () {
      const isolateVM = new IsolateVM();
      const result = await isolateVM.evaluate(
        'obj',
        { obj: { a: 1, b: 2 } },
        { modifyEnv: 'obj.a += 1; obj.b += 1;' },
      );
      expect(result).to.deep.equal({ a: 2, b: 3 });
      const result2 = await isolateVM.evaluate('obj', { obj: { a: 1, b: 2 } });
      expect(result2).to.deep.equal({ a: 1, b: 2 });
      await expect(isolateVM.evaluate('obj')).to.be.rejectedWith('obj is not defined');
      isolateVM.dispose();
    });

    it('globals should not contain non-transferable entities and any object containing one will not be transfered', async function () {
      const isolateVM = new IsolateVM();
      await expect(
        // @ts-expect-error - Our TransferableValue type covers us at compile time, but we want to make sure runtime behavior is consistent
        isolateVM.evaluate('obj.b', { obj: { a: (ident) => ident, b: 'transferable' } }),
      ).to.be.rejectedWith('obj is not defined');
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
      isolateVM.dispose();
    });

    it('should throw an error when the VM is disposed', async function () {
      const isolateVM = new IsolateVM();
      isolateVM.dispose();
      await expect(isolateVM.evaluate('1 + 1')).to.be.rejectedWith(
        'Cannot evaluate, IsolateVM isolate has been disposed or is not initialized',
      );
    });
  });
  describe('evaluateSync', function () {
    it('should initialize and evaluate code', function () {
      const isolateVM = new IsolateVM();
      const result = isolateVM.evaluateSync('1 + 1');
      expect(result).to.equal(2);
      isolateVM.dispose();
    });

    it('should evaluate code with globals', function () {
      const isolateVM = new IsolateVM();
      const result = isolateVM.evaluateSync('a + b', { a: 1, b: 2 });
      expect(result).to.equal(3);
      isolateVM.dispose();
    });

    it('should evaluate code with an env', function () {
      const isolateVM = new IsolateVM({ env: 'let a = 1; let b = 2;' });
      const result = isolateVM.evaluateSync('a + b');
      expect(result).to.equal(3);
      isolateVM.dispose();
    });

    it('should throw an error when evaluation exceeds the timeout', function () {
      const isolateVM = new IsolateVM();
      expect(() => isolateVM.evaluateSync('while (true) {}', {}, { timeoutMs: 300 })).to.be.throw(
        'Script execution timed out.',
      );
      isolateVM.dispose();
    });

    it('two evaluation contexts should not share state', function () {
      const isolateVM = new IsolateVM();
      const result = isolateVM.evaluateSync('let a = 1; a + 1');
      expect(result).to.equal(2);
      expect(() => isolateVM.evaluateSync('a + 1')).to.throw('a is not defined');
      isolateVM.dispose();
    });

    it('two evaluation contexts should share an env', function () {
      const isolateVM = new IsolateVM({ env: 'let a = 1; let b = 2;' });
      const result = isolateVM.evaluateSync('a + b');
      expect(result).to.equal(3);
      const result2 = isolateVM.evaluateSync('a + b');
      expect(result2).to.equal(3);
      isolateVM.dispose();
    });

    it('evaluation contexts should not be mutable across different evaluation contexts', function () {
      const isolateVM = new IsolateVM({ env: 'const obj = { a: 1, b: 2 };' });
      const result = isolateVM.evaluateSync('obj.a = obj.a + 1; delete obj.b; obj;');
      expect(result).to.deep.equal({ a: 2 });
      const result2 = isolateVM.evaluateSync('obj');
      expect(result2).to.deep.equal({ a: 1, b: 2 });
      isolateVM.dispose();
    });

    it('globals can be modified with untrusted code', function () {
      const isolateVM = new IsolateVM();
      const result = isolateVM.evaluateSync(
        'obj.a = obj.a + 1; delete obj.b; obj;',
        { obj: { a: 1, b: 2 } },
        { modifyEnv: 'obj.a += 1; obj.b += 1;' },
      );
      expect(result).to.deep.equal({ a: 3 });
      isolateVM.dispose();
    });

    it('globals that are modified via runtime options should not persist between evaluation contexts', function () {
      const isolateVM = new IsolateVM();
      const result = isolateVM.evaluateSync(
        'obj',
        { obj: { a: 1, b: 2 } },
        { modifyEnv: 'obj.a += 1; obj.b += 1;' },
      );
      expect(result).to.deep.equal({ a: 2, b: 3 });
      const result2 = isolateVM.evaluateSync('obj', { obj: { a: 1, b: 2 } });
      expect(result2).to.deep.equal({ a: 1, b: 2 });
      expect(() => isolateVM.evaluateSync('obj')).to.throw('obj is not defined');
      isolateVM.dispose();
    });

    it('globals should not contain non-transferable entities and any object containing one will not be transfered', function () {
      const isolateVM = new IsolateVM();
      expect(
        // @ts-expect-error - Our TransferableValue type covers us at compile time, but we want to make sure runtime behavior is consistent
        () => isolateVM.evaluateSync('obj.b', { obj: { a: (ident) => ident, b: 'transferable' } }),
      ).to.throw('obj is not defined');
      isolateVM.dispose();
    });

    it('should not persist mutations to JavaScript intrinsic objects', function () {
      const isolateVM = new IsolateVM();
      const result = isolateVM.evaluateSync(
        'const originalPush = Array.prototype.push; Array.prototype.push = function() { return originalPush.call(this, "hacked") }; const arr = [1, 2]; arr.push(3); arr;',
      );
      expect(result).to.deep.equal([1, 2, 'hacked']);
      const result2 = isolateVM.evaluateSync('const arr = [1, 2]; arr.push(3); arr;');
      expect(result2).to.deep.equal([1, 2, 3]);
      isolateVM.dispose();
    });

    it('should throw an error when the VM is disposed', function () {
      const isolateVM = new IsolateVM();
      isolateVM.dispose();
      expect(() => isolateVM.evaluateSync('1 + 1')).to.throw(
        'Cannot evaluate, IsolateVM isolate has been disposed or is not initialized',
      );
    });
  });
});

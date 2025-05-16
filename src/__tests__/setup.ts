import chai from 'chai';

export async function setup() {
  const chaiAsPromised = await import('chai-as-promised');
  chai.use(chaiAsPromised.default);
}

import { Isolate, Context } from 'isolated-vm';

class ContextBuilder {
    private deps: string[] = [];

    static fromDefaultIsolate(): ContextBuilder {
        return new ContextBuilder(new Isolate({ memoryLimit: 128 }));
    }

    constructor(private isolate: any) {}

    withDependency(dependency: string): ContextBuilder;
    withDependency(dependency: string[]): ContextBuilder;
    withDependency(dependency: string | string[]): ContextBuilder {
        if (Array.isArray(dependency)) {
            this.deps.push(...dependency);
        } else {
            this.deps.push(dependency);
        }
        return this;
    }

    async createContext(): Promise<Context> {
        const context = await this.isolate.createContext();
        const jail = context.global;
        // Set up a reference to the global object
        await jail.set('global', jail.derefInto());
        await jail.set('log', console.log);
        return context;
    }

    createContextSync(): Context {
        const context = this.isolate.createContextSync();
        const jail = context.global;
        // Set up a reference to the global object
        jail.setSync('global', jail.derefInto());
        jail.setSync('log', console.log);
        return context;
    }

    async build(): Promise<Context> {
        const context = await this.createContext();
        for (const dep of this.deps) {
            await context.eval(dep);
        }
        return context;
    }

    buildSync(): Context {
        const context = this.createContextSync();
        for (const dep of this.deps) {
            context.evalSync(dep);
        }
        return context;
    }
}

export default ContextBuilder;

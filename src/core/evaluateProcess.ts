import * as FormioCore from '@formio/core';

import { evaluate } from './evaluate';
import { instanceShimCode } from './InstanceShim';
import { RootShim } from './RootShim';
import { lodashCode } from './deps/lodash';
import { momentCode } from './deps/moment';
import {
    baseCoreCode,
    polyfillCode,
    aliasesCode,
    fastJsonPatchCode,
} from './deps/core';

const code = `
root = new RootShim(context.form, context.submission);
context.instances = root.instanceMap;
data = context.data;

if (context.form.module) {
  // Wrap with parenthesis to return object, not function
  try {
    formModule = eval( '(' + context.form.module + ')');
    evalContext = formModule?.options?.form?.evalContext;

    if (evalContext) {
      evalContextFn = (context) => Object.assign({}, context, evalContext);
      context.evalContext = evalContextFn;
    }
  } catch (e) {}
}

context.processors = FormioCore.ProcessTargets.evaluator;
scope = FormioCore.processSync(context);

({ scope, data });
`;

export type EvaluateProcessorsOptions = {
    form: any;
    submission: any;
    deps?: EvaluationDependencies;
    scope?: any;
    token?: string;
};

export type EvaluationDependencies = {
    lodash?: string;
    moment?: string;
    core?: string;
    fastJsonPatch?: string;
    additionalDeps?: string[];
};

export type EvaluateProcessorsResult = {
    scope: any;
    data: any;
};

/**
 * Function to allow the caller of evaluateProcess to provide their own dependencies, but
 * falls back to @formio/vm-managed dependencies if they're not provided
 */
function generateDefaultDependencies({
    lodash = lodashCode,
    moment = momentCode,
    core = baseCoreCode,
    fastJsonPatch = fastJsonPatchCode,
    additionalDeps = [],
}: EvaluationDependencies): string[] {
    return [
        lodash,
        moment,
        polyfillCode,
        core,
        fastJsonPatch,
        aliasesCode,
        instanceShimCode,
        ...additionalDeps,
    ];
}

export async function evaluateProcess({
    form,
    submission,
    deps = {},
    scope = {},
    token = '',
}: EvaluateProcessorsOptions): Promise<EvaluateProcessorsResult> {
    const serializedSubmission = JSON.parse(JSON.stringify(submission));
    const evaluateContext = {
        form: form,
        components: form.components,
        submission: serializedSubmission,
        data: serializedSubmission.data,
        scope,
        config: {
            server: true,
            token,
        },
        options: {
            server: true,
        },
    };
    const result = await evaluate({
        deps: generateDefaultDependencies(deps),
        data: { context: evaluateContext },
        code,
    });
    return result as EvaluateProcessorsResult;
}

// Does the same as `evaluateProcess`, but omits the call to evaluate
// So it's possible to debug core functions outside of the vm
// Should be used ONLY for development
// Before using this function, make sure that it corresponds to the actual version of `evaluateProcess`
export async function evaluateProcessMocked(
    options: EvaluateProcessorsOptions,
): Promise<EvaluateProcessorsResult> {
    (globalThis as any).moment = require('moment');
    (globalThis as any)._ = require('lodash');
    (globalThis as any).FormioCore = require('@formio/core');
    (globalThis as any).utils = FormioCore.Utils;
    (globalThis as any).util = FormioCore.Utils;
    // TODO: add reporting here, types are not cooperating at the moment

    const submission = JSON.parse(JSON.stringify(options.submission));
    const context: any = {
        form: options.form,
        components: options.form.components,
        submission: submission,
        data: submission.data,
        scope: options.scope || {},
        config: {
            server: true,
            token: options.token || '',
        },
        options: {
            server: true,
        },
    };
    const root = new RootShim(context.form, context.submission);
    context.instances = root.instanceMap;
    const data = context.data;

    if (context.form.module) {
        // Wrap with parenthesis to return object, not function
        const formModule = eval('(' + context.form.module + ')');
        const evalContext = formModule?.options?.form?.evalContext;

        if (evalContext) {
            const evalContextFn = (context: any) =>
                Object.assign({}, context, evalContext);
            context.evalContext = evalContextFn;
        }
    }

    context.processors = FormioCore.ProcessTargets.evaluator;
    const scope = FormioCore.processSync(context);

    return { scope, data };
}

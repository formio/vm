import _ from 'lodash';
import {
  ProcessorContext,
  ProcessorFn,
  ProcessorFnSync,
  ProcessorInfo,
  ProcessorScope,
  Utils,
  processSync,
} from '@formio/core';
import { evaluate } from '..';

import macros from './deps/nunjucks-macros';

export type RenderEmailOptions = {
  render: any;
  context: any;
  timeout?: number;
};

const renderEmailProcessorSync: ProcessorFnSync<ProcessorScope> = (context) => {
  const { component, paths, parent, scope, data } = context;
  if (!(scope as any).renderEmail) {
    (scope as any).renderEmail = '';
  }
  const scopeRef = scope as any;
  if (
    scopeRef.conditionals.find(
      (cond: any) => cond.path === paths?.fullPath && cond.conditionallyHidden,
    )
  ) {
    return;
  }
  let result = '';

  switch (Utils.getModelType(component)) {
    case 'dataObject':
    case 'nestedArray':
    case 'nestedDataArray': {
      result += `
          <table border="1" style="width:100%">
            <tbody>
              <child />
            </tbody>
          </table>
        `;
      break;
    }
    case 'number':
    case 'boolean':
    case 'string': {
      result += `<tr>
        <th style="padding: 5px 10px;">${component.label || component.key}</th>
        <td style="width:100%;padding:5px 10px;">${_.get(
          data,
          paths?.fullPath ?? component.key,
        )}</td>
      </tr>`;
      break;
    }
    default:
      break;
  }

  if (!parent) {
    (scope as any).renderEmail += result;
  } else {
    (scope as any).renderEmail = (scope as any).renderEmail.replace('<child />', result);
  }
};

const renderEmailProcessor: ProcessorFn<ProcessorScope> = async (context) => {
  return renderEmailProcessorSync(context);
};

const renderEmailProcessorInfo: ProcessorInfo<ProcessorContext<ProcessorScope>, void> = {
  name: 'renderEmail',
  process: renderEmailProcessor,
  processSync: renderEmailProcessorSync,
  shouldProcess: () => true,
};

export async function renderEmail({
  render,
  context = {},
  timeout = 500,
}: RenderEmailOptions): Promise<string> {
  if (context._private) {
    delete context._private;
  }
  context.macros = macros;

  const renderMethod = getRenderMethod(render);

  const data: any = {
    input: omitUndefined(render),
    context,
    submissionTableHtml: null,
  };

  if (renderMethod === 'dynamic') {
    const result = processSync({
      ...context,
      components: context.form.components,
      processors: [renderEmailProcessorInfo],
    });
    data.submissionTableHtml = `<table border="1" style="width:100%"><tbody>${
      (result as any).renderEmail
    }</tbody></table>`;
  }

  const res = await evaluate({
    deps: ['lodash', 'moment', 'core', 'nunjucks'],
    data: data,
    code: getScript(render),
    timeout,
  });
  return res as string;
}

export function getScript(data: any) {
    const injectDependencies = `
    if (_) {
    environment.addGlobal('_',_)
    }
    if (moment) {
    environment.addGlobal('moment',moment)
    }
    if (utils) {
    environment.addGlobal('utils',utils)
    }`;

    if (_.isString(data)) {
        // Script to render a single string.
        return `
      ${injectDependencies}
      environment.params = context;
      output = unescape(environment.renderString(sanitize(input), context));
    `;
  }

    // Script to render an object of properties.
    return `
    ${injectDependencies}
    environment.params = context;
    var rendered = {};
    for (let prop in input) {
      if (input.hasOwnProperty(prop)) {
        rendered[prop] = input[prop];
        if (prop === 'html') {
          rendered[prop] = unescape(environment.renderString(context.macros + sanitize(rendered[prop]), context));
        }
        rendered[prop] = unescape(environment.renderString(context.macros + sanitize(rendered[prop]), context));
      }
    }
    output = rendered;
  `;
}

function getRenderMethod(render: any) {
  let renderMethod = 'static';
  if (process.env.RENDER_METHOD) {
    renderMethod = process.env.RENDER_METHOD;
  } else if (render && render.renderingMethod) {
    renderMethod = render.renderingMethod;
  }
  return renderMethod;
}

const omitUndefined = (obj: any) => _.omitBy(obj, _.isUndefined);

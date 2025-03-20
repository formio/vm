import {
  ProcessorContext,
  ProcessorFn,
  ProcessorFnSync,
  ProcessorInfo,
  ProcessorScope,
  processSync,
} from '@formio/core';
import {
  formatAddressValue,
  formatCurrency,
  formatDatetime,
  formatTime,
  insertDataMapTable,
  insertGridTable,
  insertRow,
  insertSketchpadTable,
  insertSurveyTable,
  insertTable,
  isLayoutComponent,
} from './renderEmailUtils';

import { JSDOM } from 'jsdom';
/* eslint-disable @typescript-eslint/no-explicit-any */
import _ from 'lodash';
import { evaluate } from '..';
import macros from './deps/nunjucks-macros';

export type RenderEmailOptions = {
  render: any;
  context: any;
  timeout?: number;
};

const renderEmailProcessorSync: ProcessorFnSync<ProcessorScope> = (context) => {
  const { component, paths, parent, row, scope, data } = context;
  if ((component as any).skipInEmail || isLayoutComponent(component)) return;
  if (!(scope as any).emailDom) {
    (scope as any).emailDom = new JSDOM(`
        <table border="1" style="width:100%">
          <tbody id="main">
          </tbody>
        </table>
      `);
  }
  const document = (scope as any).emailDom.window.document;
  const scopeRef = scope as any;
  if (
    scopeRef.conditionals.find(
      (cond: any) => cond.path === paths?.fullPath && cond.conditionallyHidden,
    )
  ) {
    return;
  }

  const language = (context as any)?.metadata?.language;

  const rowValue: any = _.get(data, paths?.dataPath ?? component.key);

  // remove the component key from the data path
  // to match it to the id of the parent table
  // TODO: handle nested edit grids, etc
  const dataPath = paths?.dataPath;
  const parentId = dataPath?.includes('.')
    ? dataPath.substring(0, dataPath.lastIndexOf('.')).replace(/\.data\b/g, '')
    : dataPath;
  const componentRenderContext = {
    component,
    data,
    row,
    paths,
    parentId: !parent ? 'main' : parentId,
    document,
    language,
  };

  switch (component.type) {
    case 'textfield':
    case 'number':
    case 'password':
    case 'select':
    case 'radio':
    case 'email':
    case 'url':
    case 'phoneNumber':
    case 'day':
    case 'tags': {
      const outputValue = component.multiple ? rowValue?.join(', ') : rowValue;
      insertRow(outputValue, componentRenderContext);
      return;
    }
    case 'checkbox': {
      // TODO: translation
      insertRow(rowValue ? 'Yes' : 'No', componentRenderContext);
      return;
    }
    case 'textarea': {
      const outputValue = component.multiple
        ? rowValue?.map((v: string) => v.replace(/\n/g, ' ')).join(', ')
        : rowValue;
      insertRow(outputValue, componentRenderContext);
      return;
    }
    case 'selectboxes': {
      const outputValue = (component as any).values
        ?.filter((v: any) => rowValue[v.value])
        .map((v: any) => v.label)
        .join(', ');
      insertRow(outputValue, componentRenderContext);
      return;
    }
    case 'address': {
      const outputValue = component.multiple
        ? rowValue?.map((v: any) => formatAddressValue(v, component, data)).join(', ')
        : formatAddressValue(rowValue, component, data);
      insertRow(outputValue, componentRenderContext);
      return;
    }
    case 'datetime': {
      const outputValue = component.multiple
        ? rowValue?.map((v: any) => formatDatetime(v, component)).join(', ')
        : formatDatetime(rowValue, component);
      insertRow(outputValue, componentRenderContext);
      return;
    }
    case 'time': {
      const outputValue = component.multiple
        ? rowValue?.map((v: any) => formatTime(v, component)).join(', ')
        : formatDatetime(rowValue, component);
      insertRow(outputValue, componentRenderContext);
      return;
    }
    case 'currency': {
      const outputValue = component.multiple
        ? rowValue?.map((v: any) => formatCurrency(v, component)).join(', ')
        : formatCurrency(rowValue, component);
      insertRow(outputValue, componentRenderContext);
      return;
    }
    case 'survey': {
      insertSurveyTable(rowValue, componentRenderContext);
      return;
    }
    case 'signature':
      // TODO: translation
      insertRow(rowValue ? 'Yes' : 'No', componentRenderContext);
      return;
    case 'datamap': {
      insertDataMapTable(rowValue, componentRenderContext);
      return;
    }
    // case 'datagrid': {
    //   insertTable(componentRenderContext);
    //   return;
    // }
    case 'editgrid': {
      insertGridTable(componentRenderContext);
      return;
    }
    // premium components
    // case 'datasource': N/A (pretty sure)
    //TODO: look into how options.review works for file components
    case 'file': {
      const outputValue = _.isArray(rowValue)
        ? rowValue?.map((v: any) => v?.originalName).join(', ')
        : rowValue?.originalName;
      insertRow(outputValue, componentRenderContext);
      return;
    }
    case 'sketchpad': {
      insertSketchpadTable(componentRenderContext);
      return;
    }
    case 'tagpad': {
      insertGridTable(componentRenderContext);
      return;
    }
    // case 'datatable':
    // case 'reviewpage':
    // case 'custom':
    // form components
    case 'form':
    case 'dynamicWizard': {
      // we don't currently handle double+ nested forms
      if (parent?.type === 'form') {
        const outputValue = (component as any).form;
        insertRow(outputValue, componentRenderContext);
        return;
      }
      insertTable(componentRenderContext);
      return;
    }
    case 'container': {
      insertTable(componentRenderContext);
      return;
    }
    default:
      return;
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
    data.submissionTableHtml = (result as any).emailDom.window.document.body.innerHTML;
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

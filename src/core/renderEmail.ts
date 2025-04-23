/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ProcessorContext,
  ProcessorFn,
  ProcessorFnSync,
  ProcessorInfo,
  ProcessorScope,
  processSync,
  Component,
  ComponentPaths,
  DataObject,
  AddressComponent,
  DateTimeComponent,
  TimeComponent,
  SelectBoxesComponent,
  AddressComponentDataObject,
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
  isGridBasedComponent,
  isLayoutComponent,
} from './renderEmailUtils';

import { JSDOM } from 'jsdom';
import _ from 'lodash';
import { evaluate } from '..';
import macros from './deps/nunjucks-macros';

export type RenderEmailOptions = {
  render: any;
  context: any;
  timeout?: number;
};

export type ComponentRenderContext = {
  component: Component;
  data: DataObject;
  row?: any;
  paths?: ComponentPaths;
  parent?: Component | null;
  parentId: string;
  componentId: string;
  document: Document;
  language?: string;
  directChildOfTagPad?: boolean;
  directChildOfGrid?: boolean;
};

const renderEmailProcessorSync: ProcessorFnSync<ProcessorScope> = (
  context: ProcessorContext<ProcessorScope>,
) => {
  const { component, paths, parent, row, scope, data } = context;
  const scopeRef = scope as any;
  if ((component as any).skipInEmail || isLayoutComponent(component)) return;

  const conditionallyHidden = scopeRef.conditionals.find(
    (cond: any) => cond.path === paths?.dataPath && cond.conditionallyHidden,
  );
  const intentionallyHidden = component.hidden;

  if (conditionallyHidden || intentionallyHidden) return;

  // the address component has all the data needed for rendering on context.data at the component's data path
  // the children (if in manual mode) do not need to be iterated over since this data is redundant
  // the children are the individual manual mode address fields (address1, city, etc)
  if (parent?.type === 'address') return;

  if (!scopeRef.emailDom) {
    scopeRef.emailDom = new JSDOM(`
        <table border="1" style="width:100%">
          <tbody id="main">
          </tbody>
        </table>
      `);
  }
  const document = scopeRef.emailDom.window.document;

  const language = (context as any)?.metadata?.language;

  const rowValue: any = _.get(data, paths?.dataPath ?? component.key);

  // some components (like nested forms) add .data to the path
  // this makes it hard to map onto the parent while iterating through nested children
  // i.e. if the parent's data path is 'form'
  // and the child's is 'form.data.textField'
  const componentId = paths?.dataPath?.replace(/\.data\b/g, '') ?? '';
  // remove the current component key from the path
  // so we can get at the parent component's data path
  // to insert child rows/tables into the parent html table
  // replace the last index (for grid-based components) for easier mapping
  // see comment in insertGridHtml()
  const parentId =
    parent && componentId.includes('.')
      ? componentId.substring(0, componentId.lastIndexOf('.')).replace(/\[\d+\]$/, '')
      : 'main';

  const isGridComponent = isGridBasedComponent(component);
  // this is necessary for rendering descendants of grid-based components that are wrapped by layout components
  const componentIdIncludesGridParent = componentId?.includes(scopeRef.gridComponentId);
  if (scopeRef.gridComponentId && !componentIdIncludesGridParent) {
    scopeRef.gridComponentId = undefined;
  }

  if (!scopeRef.gridComponentId && isGridComponent) {
    // it will be the parent for future iterations until the data path no longer includes the key
    scopeRef.gridComponentId = componentId;
  }

  const componentIdIncludesTagPadParent = componentId?.includes(scopeRef.tagPadComponentId);

  if (scopeRef.tagPadComponentId && !componentIdIncludesTagPadParent) {
    scopeRef.tagPadComponentId = undefined;
  }

  if (!scopeRef.tagPadComponentId && component?.type === 'tagpad') {
    scopeRef.tagPadComponentId = componentId;
  }

  // if the parent is a layout component, we need to check
  // if the current component is nested (directly) in a tagpad component
  // used to determine if we need to add a tagpad row number
  const directChildOfTagPad = parentId === scopeRef.tagPadComponentId;
  // if the parent is a layout component, we need to check
  // if the current component is nested (directly) in a grid-based component
  // if it has a parent that's a nested form or a container, we don't trigger the grid-based insertion logic
  const directChildOfGrid = parentId === scopeRef.gridComponentId;

  const componentRenderContext = {
    component,
    data,
    row,
    paths,
    parent,
    parentId,
    componentId,
    document,
    language,
    directChildOfTagPad,
    directChildOfGrid,
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
    case 'tags':
    case 'reviewpage': {
      const outputValue = component.multiple ? rowValue?.join(', ') : rowValue;
      insertRow(componentRenderContext, outputValue);
      return;
    }
    // TODO: translation
    case 'checkbox':
    case 'signature': {
      insertRow(componentRenderContext, rowValue ? 'Yes' : 'No');
      return;
    }
    case 'textarea': {
      const outputValue = component.multiple
        ? rowValue?.map((v: string) => v.replace(/\n/g, ' ')).join(', ')
        : rowValue;
      insertRow(componentRenderContext, outputValue);
      return;
    }
    case 'selectboxes': {
      const outputValue = rowValue
        ? (component as SelectBoxesComponent)?.values
            ?.filter((v) => rowValue[v.value])
            .map((v) => v.label)
            .join(', ')
        : '';
      insertRow(componentRenderContext, outputValue);
      return;
    }
    case 'address': {
      const outputValue = component.multiple
        ? rowValue
            ?.map((v: AddressComponentDataObject) =>
              formatAddressValue(v, component as AddressComponent, data),
            )
            .join(', ')
        : formatAddressValue(rowValue, component as AddressComponent, data);
      insertRow(componentRenderContext, outputValue);
      return;
    }
    case 'datetime': {
      const timezone = (context as any)?.metadata?.timezone;
      const outputValue = component.multiple
        ? rowValue
            ?.map((v: string) => formatDatetime(component as DateTimeComponent, timezone, v))
            .join(', ')
        : formatDatetime(component as DateTimeComponent, timezone, rowValue);
      insertRow(componentRenderContext, outputValue);
      return;
    }
    case 'time': {
      const outputValue = component.multiple
        ? rowValue?.map((v: string) => formatTime(component as TimeComponent, v)).join(', ')
        : formatTime(component as TimeComponent, rowValue);
      insertRow(componentRenderContext, outputValue);
      return;
    }
    case 'currency': {
      const outputValue = component.multiple
        ? rowValue?.map((v: string) => formatCurrency(component, v)).join(', ')
        : formatCurrency(component, rowValue);
      insertRow(componentRenderContext, outputValue);
      return;
    }
    case 'survey': {
      insertSurveyTable(componentRenderContext, rowValue);
      return;
    }
    case 'datamap': {
      insertDataMapTable(componentRenderContext, rowValue);
      return;
    }
    //TODO: look into how options.review works for file components
    case 'file': {
      const outputValue = _.isArray(rowValue)
        ? rowValue?.map((v: any) => v?.originalName).join(', ')
        : rowValue?.originalName;
      insertRow(componentRenderContext, outputValue);
      return;
    }
    case 'sketchpad': {
      insertSketchpadTable(componentRenderContext, rowValue);
      return;
    }
    case 'datagrid':
    case 'editgrid':
    case 'tagpad':
    case 'datatable': {
      insertGridTable(componentRenderContext, rowValue);
      return;
    }
    case 'form': {
      // if no child data exists in the nested form, just render the nested form's submission id
      if (!rowValue?.data) {
        const outputValue = rowValue?._id;
        insertRow(componentRenderContext, outputValue);
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

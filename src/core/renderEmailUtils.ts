import {
  I18n,
  convertFormatToMoment,
  coreEnTranslation,
  currentTimezone,
  momentDate,
  Component,
  DataObject,
  AddressComponent,
  DateTimeComponent,
  SurveyComponent,
  TimeComponent,
  Evaluator,
  AddressComponentDataObject,
  Utils,
} from '@formio/core';

/* eslint-disable @typescript-eslint/no-explicit-any */
import _ from 'lodash';
import moment from 'moment';
import { ComponentRenderContext } from './renderEmail';

export const t = (
  text: string,
  language: string = 'en',
  params: Record<string, any> = {},
  ...args: any[]
): string => {
  if (!text) {
    return '';
  }
  // Use _userInput: true to ignore translations from defaults
  if (text in coreEnTranslation && params._userInput) {
    return text;
  }
  const i18n = I18n.init(language);
  return i18n.t(text, params, ...args);
};

export const isLayoutComponent = (component: Component) => {
  const modelType = Utils.getModelType(component);
  return modelType === 'none' || modelType === 'content';
};

export const isGridBasedComponent = (component?: Component | null) => {
  if (!component) return false;
  const modelType = Utils.getModelType(component);
  return modelType === 'nestedArray' || modelType === 'nestedDataArray';
};

const shouldInsertGridChild = (
  component: Component,
  parent?: Component | null,
  directChildOfGrid?: boolean, // if the parent is a layout component, we use this to determine if this component is within a grid
) => isGridBasedComponent(parent) || (!isGridBasedComponent(component) && directChildOfGrid);

const isValueInLegacyFormat = (value: AddressComponentDataObject) => {
  return value && !value.mode;
};

// if the value is in legacy format, it won't be of type AddressComponentDataObject
// so using any instead
const normalizeValue = (value: any, component: AddressComponent) => {
  return component.enableManualMode && isValueInLegacyFormat(value)
    ? {
        mode: 'autocomplete',
        address: value,
      }
    : value;
};

const getProviderDisplayValue = (
  address: AddressComponentDataObject,
  component: AddressComponent,
): string => {
  let displayedProperty = '';
  switch (component.provider) {
    case 'google':
      displayedProperty = _.has(address, 'formattedPlace') ? 'formattedPlace' : 'formatted_address';
      break;
    case 'nominatim':
      displayedProperty = 'display_name';
      break;
    case 'azure':
      displayedProperty = 'address.freeformAddress';
      break;
    case 'custom':
      displayedProperty = component?.providerOptions?.displayValueProperty;
      break;
  }
  return _.get(address, displayedProperty, '');
};

export const formatAddressValue = (
  value: AddressComponentDataObject,
  component: AddressComponent,
  data: DataObject,
): string => {
  const normalizedValue = normalizeValue(value, component);

  const { address, mode } = component.enableManualMode
    ? normalizedValue
    : {
        address: normalizedValue,
        mode: 'autocomplete',
      };

  const valueInManualMode = mode === 'manual';

  if (component.provider && !valueInManualMode) {
    return getProviderDisplayValue(address, component);
  }
  if (valueInManualMode) {
    if (component.manualModeViewString && address) {
      return Evaluator.interpolateString(component.manualModeViewString, {
        address,
        component,
        data,
      });
    }
  }
  if (address) {
    const parts = [];
    if (address.address1) parts.push(address.address1);
    if (address.address2) parts.push(address.address2);
    if (address.city) parts.push(address.city);
    if (address.state) parts.push(address.state);
    if (address.zip) parts.push(address.zip);
    if (address.country) parts.push(address.country);
    return parts.join(', ');
  }
  return '';
};

export const formatCurrency = (component: Component, value?: string) => {
  if (!value) return '';
  const currency = (component as any).currency;
  return currency
    ? Number(value).toLocaleString(undefined, {
        style: 'currency',
        currency,
      })
    : value;
};

export const formatDatetime = (
  component: DateTimeComponent,
  userProvidedTimezone?: string,
  value?: string,
) => {
  if (!value) return '';
  const rawFormat = component.format ?? 'yyyy-MM-dd hh:mm a';
  let format = convertFormatToMoment(rawFormat);
  format += format.match(/z$/) ? '' : ' z';
  const displayInTimezone = component.displayInTimezone;
  const locationTimezone = component.timezone;
  const timezone =
    displayInTimezone === 'utc'
      ? 'Etc/UTC'
      : userProvidedTimezone && displayInTimezone === 'submission'
        ? userProvidedTimezone
        : locationTimezone && displayInTimezone === 'location'
          ? locationTimezone
          : // of viewer (i.e. wherever this server is)
            currentTimezone();
  return momentDate(value, format, timezone).format(format);
};

export const formatTime = (component: TimeComponent, value?: string) => {
  if (!value) return '';
  const format = component.format ?? 'HH:mm';
  const dataFormat = component.dataFormat ?? 'HH:mm:ss';
  return moment(value, dataFormat).format(format);
};

export const insertRow = (
  componentRenderContext: ComponentRenderContext,
  rawValue?: string,
  label?: string,
  noInsert?: boolean, // only used by insertDataMapTable
) => {
  const { component, parent, parentId, document, directChildOfGrid } = componentRenderContext;
  const value = component?.protected ? '--- PROTECTED ---' : rawValue ?? '';
  if (shouldInsertGridChild(component, parent, directChildOfGrid) && !noInsert) {
    insertGridRow(value, componentRenderContext);
    return;
  }
  const html = `
    <tr>
      <th style="padding: 5px 10px;">${label ?? component?.label ?? component?.key ?? ''}</th>
      <td style="width:100%;padding:5px 10px;">
        ${value}
      </td>
    </tr>
  `;
  if (noInsert) return html;
  insertHtml(html, parentId, document);
};

const insertGridHeader = (componentRenderContext: ComponentRenderContext) => {
  const { component, data, row, parentId, paths, document, language } = componentRenderContext;
  const componentIdNoLastIndex = `${parentId}-${component.key}`;
  const existingHeadValue = document.getElementById(`${componentIdNoLastIndex}-th`);
  if (!existingHeadValue) {
    const headValue = `
      <th style="padding: 5px 10px;" id="${componentIdNoLastIndex}-th">${t(
        component?.label ?? component.key,
        language,
        {
          data,
          row,
          paths,
          _userInput: true,
        },
      )}
      </th>`;
    const parentTheadId = `${parentId}-thead`;
    insertHtml(headValue, parentTheadId, document);
  }
};

const insertGridHtml = (
  componentRenderContext: ComponentRenderContext,
  childHtml: string, // child row or child table
) => {
  const { document, paths, directChildOfTagPad, parentId } = componentRenderContext;
  const childRowId = `${parentId}${paths?.dataIndex ?? 0}-childRow`;
  const existingChildRow = document.getElementById(childRowId);
  const styles = directChildOfTagPad ? 'text-align: center' : 'padding: 5px 10px;';
  const rowValue = `
    ${!existingChildRow ? `<tr id="${childRowId}">` : ''}
        ${
          !existingChildRow && directChildOfTagPad
            ? `<td style="${styles}">${paths?.dataIndex != null ? paths.dataIndex + 1 : 0}</td>`
            : ''
        }
        ${childHtml}
      ${!existingChildRow ? `</tr>` : ''}`;

  insertHtml(
    rowValue,
    // use parentId, which has no last index since when the parent grid-based table was inserted
    // the componentId of that table had no index
    // i.e. 'tagpad' was the componentId of the parent
    // but the data path of the child would be 'tagpad[0].textfield'
    // so, to derive the parentId based on the child's data path
    // we need to 1: remove the component key from the path, and 2: remove the final index
    // if it's a nested grid, we need every index except the last
    // i.e. 'editgrid[0].editgrid1[1].textfield', the parentId would be 'editgrid[0].editgrid1'
    existingChildRow ? childRowId : parentId,
    document,
  );
};

const insertGridRow = (value: string, componentRenderContext: ComponentRenderContext) => {
  const { directChildOfTagPad } = componentRenderContext;
  insertGridHeader(componentRenderContext);
  const styles = directChildOfTagPad ? 'text-align: center' : 'padding: 5px 10px;';
  const childValue = `<td style="${styles}">${value}</td>`;
  insertGridHtml(componentRenderContext, childValue);
};

export const insertTable = (
  componentRenderContext: ComponentRenderContext,
  rows?: string,
  tHead?: string,
) => {
  const { component, componentId, parentId, document, parent, directChildOfGrid } =
    componentRenderContext;
  if (shouldInsertGridChild(component, parent, directChildOfGrid)) {
    insertGridChildTable(componentRenderContext, rows, tHead);
    return;
  }
  const html = `
    <tr>
      <th style="padding: 5px 10px;">${component.label ?? component.key}</th>
      <td style="width:100%;padding:5px 10px;">
        <table border="1" style="width:100%">
          ${tHead ?? ''}
          <tbody id="${componentId}">
            ${rows ?? ''}
          </tbody>
        </table>
      </td>
    </tr>
  `;
  insertHtml(html, parentId, document);
};

// a child that is a table within a grid-based component
// i.e. a nested form inside of an edit grid
const insertGridChildTable = (
  componentRenderContext: ComponentRenderContext,
  rows?: string,
  tHead?: string,
) => {
  const { componentId, directChildOfTagPad } = componentRenderContext;
  insertGridHeader(componentRenderContext);
  const styles = directChildOfTagPad ? 'text-align: center' : 'padding: 5px 10px;';
  const childTable = `
    <td style="${styles}">
      <table border="1" style="width:100%">
        ${tHead ?? ''}
        <tbody id="${componentId}">
        ${rows ?? ''}
        </tbody>
      </table>
    </td>
  `;
  insertGridHtml(componentRenderContext, childTable);
};

export const insertSketchpadTable = (
  componentRenderContext: ComponentRenderContext,
  rowValue?: any[],
) => {
  const { component, data, row, language = 'en' } = componentRenderContext;
  const tHead =
    rowValue?.length !== 0
      ? `
        <thead>
          <tr><th>${t(component?.label ?? component.key, language, {
            data,
            row,
            component,
            _userInput: true,
          })}</th>${t('complexData', language, { data, row, component })}</tr>
        </thead>
      `
      : '';
  insertTable(componentRenderContext, undefined, tHead);
};

// insert a grid-based table component
// i.e. an edit grid, data grid, etc.
export const insertGridTable = (
  componentRenderContext: ComponentRenderContext,
  rowValue?: any[],
) => {
  const { component, componentId, data, row, paths, language = 'en' } = componentRenderContext;
  const tHead =
    rowValue?.length !== 0
      ? `
    <thead>
      <tr id="${componentId}-thead">
        ${
          component.type === 'tagpad'
            ? `<th id="tagpad-dots" style="padding: 5px 10px;">${t('dots', language, {
                data,
                row,
                paths,
              })}</th>`
            : ''
        }
      </tr>
    </thead>
  `
      : '';
  insertTable(componentRenderContext, undefined, tHead);
};

export const insertSurveyTable = (
  componentRenderContext: ComponentRenderContext,
  value: Record<string, string>,
) => {
  const { component, data, row, language = 'en' } = componentRenderContext;
  const tHead = `             
    <thead>
      <tr>
        <th>${t('surveyQuestion', language, { data, row, component })}</th>
        <th>${t('surveyQuestionValue', language, { data, row, component })}</th>
      </tr>
    </thead>`;
  const rows = value
    ? Object.entries(value)
        .map(([key, value]) => {
          const question = _.find((component as SurveyComponent).questions, ['value', key]);
          const answer = _.find((component as SurveyComponent).values, ['value', value]);
          if (!question || !answer) {
            return;
          }
          return `
            <tr>
              <td style="text-align:center;padding: 5px 10px;">${question.label}</td>
              <td style="text-align:center;padding: 5px 10px;">${answer.label}</td>
            </tr>
        `;
        })
        .join('')
    : '';
  insertTable(componentRenderContext, rows, tHead);
};

export const insertDataMapTable = (
  componentRenderContext: ComponentRenderContext,
  value: Record<string, string>,
) => {
  const rows = value
    ? Object.entries(value)
        .map(([key, value]) => insertRow(componentRenderContext, value, key, true))
        .join('')
    : '';
  insertTable(componentRenderContext, rows);
};

const insertHtml = (html: string, parentId: string, document: Document) => {
  const parentElement = document.getElementById(parentId);
  if (parentElement) {
    parentElement.insertAdjacentHTML('beforeend', html);
  }
};

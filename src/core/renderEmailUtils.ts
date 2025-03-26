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
} from '@formio/core';

/* eslint-disable @typescript-eslint/no-explicit-any */
import _ from 'lodash';
import moment from 'moment';
import { ComponentRenderContext, GridParent } from './renderEmail';

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

export const isLayoutComponent = (component: Component): boolean =>
  ['panel', 'table', 'columns', 'fieldset', 'tabs', 'well', 'htmlelement', 'content'].includes(
    component.type,
  );

export const isGridBasedComponent = (component?: Component | null): boolean =>
  ['editgrid', 'tagpad', 'datagrid', 'datatable'].includes(component?.type ?? '');

const shouldInsertGridChild = (
  component: Component,
  parent?: Component | null,
  gridParent?: GridParent,
): boolean =>
  isGridBasedComponent(parent) ||
  (Boolean(gridParent) && !isGridBasedComponent(component) && parent?.type !== 'form');

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

export const formatCurrency = (value: string, component: Component): string => {
  const currency = (component as any).currency;
  // TODO: handle empty vals
  return currency
    ? Number(value).toLocaleString(undefined, {
        style: 'currency',
        currency,
      })
    : value;
};

export const formatDatetime = (value: string, component: DateTimeComponent): string => {
  const rawFormat = component.format ?? 'yyyy-MM-dd hh:mm a';
  let format = convertFormatToMoment(rawFormat);
  format += format.match(/z$/) ? '' : ' z';
  const displayInTimezone = component.displayInTimezone;
  const submissionTimezone = component.timezone;
  const timezone =
    displayInTimezone === 'utc'
      ? 'Etc/UTC'
      : submissionTimezone
        ? submissionTimezone
        : currentTimezone();
  return momentDate(value, format, timezone).format(format);
};

export const formatTime = (value: string, component: TimeComponent): string => {
  const format = component.format ?? 'HH:mm';
  const dataFormat = component.dataFormat ?? 'HH:mm:ss';
  return moment(value, dataFormat).format(format);
};

export const insertRow = (
  componentRenderContext: ComponentRenderContext,
  rawValue?: string,
  label?: string,
  noInsert?: boolean, // only used by insertDataMapTable
): string | void => {
  const { component, parent, parentId, document, gridParent } = componentRenderContext;
  const value = component?.protected ? '--- PROTECTED ---' : rawValue ?? '';
  if (shouldInsertGridChild(component, parent, gridParent) && !noInsert) {
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

const insertGridHeader = ({
  component,
  data,
  row,
  parentId,
  paths,
  document,
  language,
}: ComponentRenderContext) => {
  // we ignore the row index of the current table since we only need one header (<th>) per component label
  // i.e. if we have editGrid[0].editGrid1[0].editGrid[1]
  // we only want editGrid[0].editGrid1[0].editGrid
  const parentIdNoLastIndex = parentId.replace(/\[\d+\]$/, '');
  const componentIdNoRowIndex = `${parentIdNoLastIndex}-${component.key}`;
  const existingHeadValue = document.getElementById(`${componentIdNoRowIndex}-th`);
  if (!existingHeadValue) {
    const headValue = `
      <th style="padding: 5px 10px;" id="${componentIdNoRowIndex}-th">${t(
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
    // we ignore the most immediate row index here too because when the parent grid-based table was inserted
    // it had no rows
    const modifiedParentId = `${parentIdNoLastIndex}-thead`;
    insertHtml(headValue, modifiedParentId, document);
  }
};

const insertGridHtml = (
  { document, paths, gridParent, parentId }: ComponentRenderContext,
  childHtml: string, // child row or child table
) => {
  const dataIndex = paths?.dataIndex ? paths.dataIndex + 1 : 0;
  const childRowId = `${parentId}-childRow`;
  const existingChildRow = document.getElementById(childRowId);
  const isTagPad = gridParent?.isTagPad;
  const styles = isTagPad ? 'text-align: center' : 'padding: 5px 10px;';
  const rowValue = `
    ${!existingChildRow ? `<tr id="${childRowId}">` : ''}
        ${!existingChildRow && isTagPad ? `<td style="${styles}">${dataIndex}</td>` : ''}
        ${childHtml}
      ${!existingChildRow ? `</tr>` : ''}`;

  insertHtml(
    rowValue,
    // replace the last index since when the parent grid-based table was inserted
    // the componentId of that table had no index
    existingChildRow ? childRowId : parentId.replace(/\[\d+\]$/, ''),
    document,
  );
};

export const insertGridRow = (
  value: string,
  { gridParent, ...componentRenderContext }: ComponentRenderContext,
) => {
  insertGridHeader({ gridParent, ...componentRenderContext });
  const styles = gridParent?.isTagPad ? 'text-align: center' : 'padding: 5px 10px;';
  const childValue = `<td style="${styles}">${value}</td>`;
  insertGridHtml({ gridParent, ...componentRenderContext }, childValue);
};

export const insertTable = (
  {
    component,
    componentId,
    parentId,
    document,
    parent,
    gridParent,
    ...componentRenderContext
  }: ComponentRenderContext,
  rows?: string,
  tHead?: string,
) => {
  if (shouldInsertGridChild(component, parent, gridParent)) {
    insertGridChildTable(
      {
        component,
        componentId,
        parentId,
        document,
        parent,
        gridParent,
        ...componentRenderContext,
      },
      rows,
      tHead,
    );
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

export const insertGridChildTable = (
  { componentId, gridParent, ...componentRenderContext }: ComponentRenderContext,
  rows?: string,
  tHead?: string,
) => {
  insertGridHeader({ componentId, gridParent, ...componentRenderContext });
  const styles = gridParent?.isTagPad ? 'text-align: center' : 'padding: 5px 10px;';
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
  insertGridHtml({ componentId, gridParent, ...componentRenderContext }, childTable);
};

export const insertSketchpadTable = ({
  component,
  data,
  row,
  parentId,
  language = 'en',
  ...componentRenderContext
}: ComponentRenderContext) => {
  const tHead = `
    <thead>
      <tr><th>${t(component?.label ?? component.key, language, {
        data,
        row,
        component,
        _userInput: true,
      })}</th>${t('complexData', language, { data, row, component })}</tr>
    </thead>
  `;
  insertTable({ component, parentId, data, ...componentRenderContext }, undefined, tHead);
};

export const insertGridTable = ({
  component,
  componentId,
  data,
  row,
  paths,
  language = 'en',
  ...componentRenderContext
}: ComponentRenderContext) => {
  const tHead = `
    <thead>
      <tr id="${componentId}-thead">
        ${
          component.type === 'tagpad'
            ? `<th id="tagpad-dots">${t('dots', language, { data, row, paths })}</th>`
            : ''
        }
      </tr>
    </thead>
  `;
  insertTable(
    { component, componentId, data, row, paths, language, ...componentRenderContext },
    undefined,
    tHead,
  );
};

export const insertSurveyTable = (
  {
    component,
    data,
    row,
    parentId,
    gridParent,
    document,
    paths,
    language = 'en',
    ...componentRenderContext
  }: ComponentRenderContext,
  value: Record<string, string>,
) => {
  if (component.type !== 'survey') return;
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
  insertTable(
    { component, parentId, data, gridParent, document, paths, ...componentRenderContext },
    rows,
    tHead,
  );
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

const insertHtml = (html: string, parentId: string, document: Document): void => {
  const parentElement = document.getElementById(parentId);
  if (parentElement) {
    parentElement.insertAdjacentHTML('beforeend', html);
  }
};

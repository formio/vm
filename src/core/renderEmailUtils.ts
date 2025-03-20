import {
  I18n,
  convertFormatToMoment,
  coreEnTranslation,
  currentTimezone,
  momentDate,
} from '@formio/core';

/* eslint-disable @typescript-eslint/no-explicit-any */
import _ from 'lodash';
import moment from 'moment';

export const t = (text: any, language: any, params: any = {}, ...args: []) => {
  if (!text) {
    return '';
  }
  // Use _userInput: true to ignore translations from defaults
  if (text in coreEnTranslation && params._userInput) {
    return text;
  }
  const i18n = I18n.init(language);
  params.data = params.data;
  params.row = params.row;
  params.component = params.component;
  return i18n.t(text, params, ...args);
};

export const isLayoutComponent = (component: any) => {
  return [
    'panel',
    'table',
    'columns',
    'fieldset',
    'tabs',
    'well',
    'htmlelement',
    'content',
  ].includes(component.type);
};

const isValueInLegacyFormat = (value: any) => {
  return value && !value.mode;
};

const normalizeValue = (value: any, component: any, data: any) => {
  return component.enableManualMode && isValueInLegacyFormat(data.address)
    ? {
        mode: 'autocomplete',
        address: value,
      }
    : value;
};

const getProviderDisplayValue = (address: any, component: any) => {
  let displayedProperty = '';
  if (component.provider === 'google') {
    displayedProperty = _.has(address, 'formattedPlace') ? 'formattedPlace' : 'formatted_address';
  } else if (component.provider === 'nominatim') {
    displayedProperty = 'display_name';
  } else if (component.provider === 'azure') {
    displayedProperty = 'address.freeformAddress';
  } else if (component.provider === 'custom') {
    displayedProperty = component?.providerOptions?.displayValueProperty;
  }
  return _.get(address, displayedProperty, '');
};

export const formatAddressValue = (value: any, component: any, data: any): string => {
  const normalizedValue = normalizeValue(value, component, data);

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
  // TODO: use interpolate fn from core
  if (valueInManualMode) {
    if (component.manualModeViewString && address) {
      return component.manualModeViewString.replace(
        /\{\{\s*([\w.[\]]+)\s*\}\}/g,
        (match: string, path: string) => {
          if (path.startsWith('address.')) {
            const addressPath = path.replace('address.', '');
            return _.get(address, addressPath, '');
          } else if (path.startsWith('component.')) {
            const componentPath = path.replace('component.', '');
            return _.get(component, componentPath, '');
          } else if (path.startsWith('data.')) {
            const dataPath = path.replace('data.', '');
            return _.get(data, dataPath, '');
          }
        },
      );
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
  }
  return '';
};

export const formatCurrency = (value: any, component: any) => {
  const currency = component.currency;
  // TODO: handle empty vals
  return currency
    ? Number(value).toLocaleString(undefined, {
        style: 'currency',
        currency,
      })
    : value;
};

export const formatDatetime = (value: any, component: any) => {
  const rawFormat = (component as any).format ?? 'yyyy-MM-dd hh:mm a';
  let format = convertFormatToMoment(rawFormat);
  format += format.match(/z$/) ? '' : ' z';
  const displayInTimezone = (component as any).displayInTimezone;
  const submissionTimezone = (component as any).timezone;
  const timezone =
    displayInTimezone === 'utc'
      ? 'Etc/UTC'
      : submissionTimezone
        ? submissionTimezone
        : currentTimezone();
  return momentDate(value, format, timezone).format(format);
};

export const formatTime = (value: any, component: any) => {
  const format = (component as any).format ?? 'HH:mm';
  const dataFormat = (component as any).dataFormat ?? 'HH:mm:ss';
  return moment(value as any, dataFormat).format(format);
};

export const insertRow = (
  value: any,
  componentRenderContext: any,
  label?: any,
  noInsert?: boolean,
) => {
  const { component, parentId, document } = componentRenderContext;
  if (/^.*\[\d+\]$/.test(parentId)) {
    insertGridRow(value, componentRenderContext);
    return;
  }
  const html = `
    <tr>
      <th style="padding: 5px 10px;">${label ?? component?.label ?? component?.key ?? ''}</th>
      <td style="width:100%;padding:5px 10px;">
        ${component?.protected ? '--- PROTECTED ---' : value ?? ''}
      </td>
    </tr>
  `;
  if (noInsert) return html;
  const nonIndexedPath = parentId.replace(/\[\d+\]/g, '');
  insertHtml(html, nonIndexedPath, document);
};

const insertGridHeader = ({ component, data, row, paths, document }: any, rootComponentId: any) => {
  const existingHeadValue = document.getElementById(component.compPath);
  if (!existingHeadValue) {
    const headValue = `
      <th id="${component.compPath}">${t(component.label, {
        data,
        row,
        paths,
        _userInput: true,
      })}
      </th>`;
    const modifiedParentId = `${rootComponentId}-thead`;
    insertHtml(headValue, modifiedParentId, document);
  }
};

const insertGridHtml = (
  document: any,
  childHtml: any, // child row or child table
  rootComponentId: any,
  dataIndex: any,
) => {
  const childRowId = `${rootComponentId}-childRow${dataIndex}`;
  const existingChildRow = document.getElementById(childRowId);
  // this check won't work if there's any tagpad anywhere on the doc...
  const isTagPadChild = document.getElementById('tagpad-dots');

  const rowValue = `
    ${!existingChildRow ? `<tr id="${rootComponentId}-childRow${dataIndex}">` : ''}
        ${
          !existingChildRow && isTagPadChild
            ? `<td id="${dataIndex}-tdIndex" style="text-align: center">${dataIndex}</td>`
            : ''
        }
        ${childHtml}
      ${!existingChildRow ? `</tr>` : ''}`;

  insertHtml(rowValue, existingChildRow ? childRowId : rootComponentId, document);
};

export const insertGridRow = (
  value: any,
  { component, data, row, parentId, paths, document }: any,
) => {
  const rootComponentId = parentId.replace(/\[\d+\]/g, '').replace(/\[\d+\]/g, '');
  insertGridHeader({ component, data, row, paths, document }, rootComponentId);
  const dataIndex = paths?.dataIndex + 1;
  const childValue = `<td style="text-align: center">${value}</td>`;
  insertGridHtml(document, childValue, rootComponentId, dataIndex);
};

export const insertTable = (
  { component, data, row, parentId, document, paths }: any,
  rows?: any,
  tHead?: any,
) => {
  const modifiedComponentPath = paths?.dataPath?.replace(/\.data\b/g, '');
  // match tagpad[0] or editgrid[1] etc
  if (/^.*\[\d+\]$/.test(parentId)) {
    insertGridChildTable(
      {
        component,
        data,
        row,
        paths,
        parentId,
        document,
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
          <tbody id="${modifiedComponentPath}">
            ${rows ?? ''}
          </tbody>
        </table>
      </td>
    </tr>
  `;
  insertHtml(html, parentId, document);
};

export const insertGridChildTable = (
  { component, data, row, parentId, paths, document }: any,
  rows?: any,
  tHead?: any,
) => {
  const rootComponentId = parentId.replace(/\[\d+\]/g, '');
  insertGridHeader({ component, data, row, paths, document }, rootComponentId);
  const childTable = `
    <td style="text-align: center">
      <table border="1" style="width:100%">
        ${tHead ?? ''}
        <tbody id="${parentId}">
        ${rows ?? ''}
        </tbody>
      </table>
    </td>
  `;
  const dataIndex = paths?.dataIndex + 1;
  insertGridHtml(document, childTable, rootComponentId, dataIndex);
};

export const insertSketchpadTable = ({
  component,
  data,
  row,
  parentId,
  paths,
  document,
  language = 'en',
}: any) => {
  const tHead = `
    <thead>
      <tr><th>${t(component.label, { data, row, component, _userInput: true })}</th>${t(
        'complexData',
        language,
        { data, row, component },
      )}</tr>
    </thead>
  `;
  insertTable({ component, parentId, document, paths }, undefined, tHead);
};

export const insertGridTable = ({
  component,
  data,
  row,
  parentId,
  document,
  paths,
  language = 'en',
}: any) => {
  const modifiedComponentPath = paths?.dataPath?.replace(/\.data\b/g, '').replace(/\[\d+\]/g, '');
  const tHead = `
    <thead>
      <tr id="${modifiedComponentPath}-thead">
        ${
          component.type === 'tagpad'
            ? `<th id="tagpad-dots">${t('dots', language, { data, row, paths })}</th>`
            : ''
        }
      </tr>
    </thead>
  `;
  insertTable({ component, parentId, document, paths }, undefined, tHead);
};

export const insertSurveyTable = (
  value: any,
  { component, data, row, parentId, document, paths, language = 'en' }: any,
) => {
  const tHead = `             
    <thead>
      <tr>
        <th>${t('surveyQuestion', language, { data, row, component })}</th>
        <th>${t('surveyQuestionValue', language, { data, row, component })}</th>
      </tr>
    </thead>`;
  const rows = value
    ? Object.entries(value as any)
        .map(([key, value]) => {
          const question = _.find((component as any).questions, ['value', key]);
          const answer = _.find((component as any).values, ['value', value]);
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
    : [];
  insertTable({ component, parentId, document, paths }, rows, tHead);
};

export const insertDataMapTable = (rowValue: any, componentRenderContext: any) => {
  const modifiedComponentPath = componentRenderContext?.paths?.dataPath?.replace(/\.data\b/g, '');
  const rows = rowValue
    ? Object.entries(rowValue as any)
        .map(([key, value]) =>
          insertRow(
            value,
            { ...componentRenderContext, parentId: modifiedComponentPath },
            key,
            true,
          ),
        )
        .join('')
    : [];
  insertTable(componentRenderContext, rows);
};

const insertHtml = (html: any, parentId: any, document: any) => {
  const parentElement = document.getElementById(parentId);
  if (parentElement) {
    parentElement.insertAdjacentHTML('beforeend', html);
  }
};

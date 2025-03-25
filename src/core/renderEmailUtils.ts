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

export const isGridBasedComponent = (component: any) => {
  return ['editgrid', 'tagpad', 'datagrid', 'datatable'].includes(component?.type);
};

const shouldInsertGridChild = (parent: any, component: any, gridParent: any) =>
  isGridBasedComponent(parent) ||
  (gridParent && !isGridBasedComponent(component) && parent?.type !== 'form');

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
  rawValue: any,
  componentRenderContext: any,
  label?: any,
  noInsert?: boolean, // only used by insertDataMapTable
) => {
  const { component, parent, parentId, document, gridParent } = componentRenderContext;
  const value = component?.protected ? '--- PROTECTED ---' : rawValue ?? '';
  if (shouldInsertGridChild(parent, component, gridParent) && !noInsert) {
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

const insertGridHeader = ({ component, data, row, parentId, paths, document }: any) => {
  // we ignore the row index of the current table since we only need one header (<th>) per component label
  // i.e. if we have editGrid[0].editGrid1[0].editGrid[1]
  // we only want editGrid[0].editGrid1[0].editGrid
  const parentIdNoLastIndex = parentId.replace(/\[\d+\]$/, '');
  const componentIdNoRowIndex = `${parentIdNoLastIndex}-${(component as any).key}`;
  const existingHeadValue = document.getElementById(`${componentIdNoRowIndex}-th`);
  if (!existingHeadValue) {
    const headValue = `
      <th style="padding: 5px 10px;" id="${componentIdNoRowIndex}-th">${t(component.label, {
        data,
        row,
        paths,
        _userInput: true,
      })}
      </th>`;
    // we ignore the most immediate row index here too because when the parent grid-based table was inserted
    // it had no rows
    const modifiedParentId = `${parentIdNoLastIndex}-thead`;
    insertHtml(headValue, modifiedParentId, document);
  }
};

const insertGridHtml = (
  { document, paths, gridParent, parentId }: any,
  childHtml: any, // child row or child table
) => {
  const dataIndex = paths?.dataIndex + 1;
  const childRowId = `${parentId}-childRow`;
  const existingChildRow = document.getElementById(childRowId);
  const isTagPad = gridParent?.isTagPad;
  const styles = isTagPad ? 'text-align: center' : 'padding: 5px 10px;';
  const rowValue = `
    ${!existingChildRow ? `<tr id="${childRowId}">` : ''}
        ${
          !existingChildRow && isTagPad
            ? `<td id="${dataIndex}-tdIndex" style="${styles}">${dataIndex}</td>`
            : ''
        }
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

export const insertGridRow = (value: any, { gridParent, ...componentRenderContext }: any) => {
  insertGridHeader({ gridParent, ...componentRenderContext });
  const styles = gridParent?.isTagPad ? 'text-align: center' : 'padding: 5px 10px;';
  const childValue = `<td style="${styles}">${value}</td>`;
  insertGridHtml({ gridParent, ...componentRenderContext }, childValue);
};

export const insertTable = (
  { component, componentId, parentId, document, gridParent, ...componentRenderContext }: any,
  rows?: any,
  tHead?: any,
) => {
  if (shouldInsertGridChild(parent, component, gridParent)) {
    insertGridChildTable(
      {
        component,
        componentId,
        parentId,
        document,
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
  { componentId, gridParent, ...componentRenderContext }: any,
  rows?: any,
  tHead?: any,
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
  paths,
  document,
  language = 'en',
  gridParent,
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
  insertTable({ component, parentId, gridParent, document, paths }, undefined, tHead);
};

export const insertGridTable = ({
  component,
  componentId,
  data,
  row,
  paths,
  language = 'en',
  ...componentRenderContext
}: any) => {
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
  value: any,
  { component, data, row, parentId, gridParent, document, paths, language = 'en' }: any,
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
  insertTable({ component, parentId, gridParent, document, paths }, rows, tHead);
};

export const insertDataMapTable = (rowValue: any, componentRenderContext: any) => {
  const rows = rowValue
    ? Object.entries(rowValue as any)
        .map(([key, value]) => insertRow(value, componentRenderContext, key, true))
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

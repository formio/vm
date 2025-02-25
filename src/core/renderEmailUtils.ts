import { ComponentPath, I18n, Utils, convertFormatToMoment, currentTimezone, momentDate } from '@formio/core';
import { JSDOM } from 'jsdom';
 
/* eslint-disable @typescript-eslint/no-explicit-any */
import _ from 'lodash';
import moment from 'moment';

export const t = (text: any, language: any, params: any = {}, ...args: []) => {
  if (!text) {
    return '';
  }
  // Use _userInput: true to ignore translations from defaults
  // if (text in enTranslation && params._userInput) {
  //   return text;
  // }
  const i18n = I18n.init(language);
  params.data = params.data;
  params.row = params.row;
  params.component = params.component;
  return i18n.t(text, params, ...args);
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

export const renderRow = (value: any, component?: any, label?: any) => {
  return `
    <tr>
      <th style="padding: 5px 10px;">${label ?? component?.label ?? component?.key ?? ''}</th>
      <td style="width:100%;padding:5px 10px;">
        ${component?.protected ? '--- PROTECTED ---' : value ?? ''}
      </td>
    </tr>
  `;
};


export const renderTable = (component: any, paths: any, pathSuffix?: any, rows?: any, tHead?: any) => {  
  return `
    <tr>
      <th style="padding: 5px 10px;">${component.label ?? component.key}</th>
      <td style="width:100%;padding:5px 10px;">
        <table border="1" style="width:100%">
          ${tHead ?? ''}
          <tbody id="${paths?.dataPath}${pathSuffix ?? ''}">
            ${rows ?? ''}
          </tbody>
        </table>
      </td>
    </tr>
  `;
};

export const renderSurveyTable = (value: any, component: any, data: any, row: any, paths: any, language: any) => {  
  const tHead = `             
    <thead>
      <tr>
        <th>${t('surveyQuestion', language, {data, row, component})}</th>
        <th>${t('surveyQuestionValue', language, {data, row, component})}</th>
      </tr>
    </thead>`;
  const rows = value ? 
    Object.entries(value as any)
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
      }).join('') : 
      [];
  return renderTable(component, paths, undefined, rows, tHead);
};

export const renderDataMapTable = (rowValue: any, component: any, paths: any) => {  
  const rows = rowValue ? 
    Object.entries(rowValue as any)
      .map(([key, value]) => renderRow(value, undefined, key)).join('') : 
    [];
  return renderTable(component, paths, undefined, rows);
};

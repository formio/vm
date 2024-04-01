import fs from 'fs';
import path from 'path';

const baseCoreCode = fs.readFileSync(
    path.join(__dirname, './assets/formio.core.min.js'),
    'utf8',
);
const fastJsonPatchCode = fs.readFileSync(
    path.join(__dirname, './assets/fast-json-patch.min.js'),
    'utf8',
);
const polyfillCode = `
var Text              = class {};
var HTMLElement       = class {};
var HTMLCanvasElement = class {};
var navigator         = {userAgent: ''};
var document          = {
  createElement: () => ({}),
  cookie: '',
  getElementsByTagName: () => [],
  documentElement: {
    style: [],
    firstElementChild: {appendChild: () => {}}
  }
};
var window = {addEventListener: () => {}, Event: function() {}, navigator: global.navigator};
var btoa = (str) => {
  return (str instanceof Buffer) ?
    str.toString('base64') :
    Buffer.from(str.toString(), 'binary').toString('base64');
};
//var setTimeout = () => {};
var self = global;
`;
const aliasesCode = `
utils = FormioCore.Utils;
util = FormioCore.Utils;

// jsonLogic = util.jsonLogic;
`;

export const coreCode = [
    polyfillCode,
    baseCoreCode,
    fastJsonPatchCode,
    aliasesCode,
];

import fs from 'fs';
import path from 'path';

export const coreCode = fs.readFileSync(
    path.join(__dirname, './assets/formio.core.min.js'),
    'utf8',
);
export const fastJsonPatchCode = fs.readFileSync(
    path.join(__dirname, './assets/fast-json-patch.min.js'),
    'utf8',
);

export const aliasesCode = `
utils = FormioCore.Utils;
util = FormioCore.Utils;

// jsonLogic = util.jsonLogic;
`;

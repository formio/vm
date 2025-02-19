import _ from 'lodash';
import { Formio, Form } from '@formio/js';
import { evaluate } from '..';

import macros from './deps/nunjucks-macros';

export type RenderEmailOptions = {
    render: any;
    context: any;
    timeout?: number;
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
        try {
            const premium = await import(
                // @ts-expect-error Premium is included in the server build.
                '@formio/premium/dist/premium-server.min.js'
            );
            Formio.use(premium);
        } catch {
            // eslint-disable-next-line no-empty
        }
        const form = await new Form(context.form, {
            server: true,
            noeval: true,
            noDefaults: true,
            submissionTimezone: context?.metadata?.timezone,
        }).ready;

        form.setValue({ data: context.data }, { sanitize: true });

        // this is a hack to ensure the form is fully rendered before we get the form html
        // ideally, we'd have a promise from the renderer that we can await to ensure the form is fully rendered
        await new Promise((resolve) => {
            setTimeout(resolve, 1000);
        });

        const submissionTableHtml = form.getView(context.data, {
            email: true,
        });

        data.submissionTableHtml = submissionTableHtml;
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

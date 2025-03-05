import { expect } from 'chai';
import { RootShim } from '../RootShim';
import { InstanceShim } from '../InstanceShim';

describe('getComponent', () => {
    it('should return a component (InstanceShim) at an exact path if it exists', () => {
        const components = [
            {
                type: 'textfield',
                key: 'textfield',
                label: 'Text Field',
                input: true,
            },
        ];
        const root = new RootShim({ components }, { data: {} });
        const component = root.getComponent('textfield');
        expect(component).to.be.instanceOf(InstanceShim);
        expect(component.component.key).to.be.equal('textfield');
    });

    it('should return a component at an exact nested path if it exists', () => {
        const components = [
            {
                type: 'datagrid',
                key: 'dataGrid',
                components: [
                    {
                        type: 'textfield',
                        key: 'textField',
                        label: 'Text Field',
                        input: true,
                    },
                ],
            },
        ];
        const root = new RootShim(
            { components },
            { data: { dataGrid: [{ textField: 'hello' }] } },
        );
        const component = root.getComponent('dataGrid[0].textField');
        expect(component).to.be.instanceOf(InstanceShim);
        expect(component.component.key).to.be.equal('textField');
    });

    it('should return a component at an exact path if it exists and there is no data associated with that component', () => {
        const components = [
            {
                type: 'datagrid',
                key: 'dataGrid',
                components: [
                    {
                        type: 'textfield',
                        key: 'textField',
                        label: 'Text Field',
                        input: true,
                    },
                ],
            },
        ];
        const root = new RootShim({ components }, { data: {} });
        const component = root.getComponent('dataGrid[0].textField');
        expect(component).to.be.instanceOf(InstanceShim);
        expect(component.component.key).to.be.equal('textField');
        expect(component.component.label).to.be.equal('Text Field');
    });

    it('should return a component (InstanceShim) at a path with the final pathname segment matching the path argument if it exists', () => {
        const components = [
            {
                type: 'datagrid',
                key: 'dataGrid',
                components: [
                    {
                        type: 'textfield',
                        key: 'textField',
                        label: 'Text Field',
                        input: true,
                    },
                ],
            },
        ];
        const root = new RootShim(
            { components },
            { data: { dataGrid: [{ textField: 'hello' }] } },
        );
        const component = root.getComponent('textField');
        expect(component).to.be.instanceOf(InstanceShim);
        expect(component.component.key).to.be.equal('textField');
    });

    it('should return a component (InstanceShim) at a path with the final pathname segment matching the path argument if it exists and there is no data associated with the component', () => {
        const components = [
            {
                type: 'datagrid',
                key: 'dataGrid',
                components: [
                    {
                        type: 'textfield',
                        key: 'textField',
                        label: 'Text Field',
                        input: true,
                    },
                ],
            },
        ];
        const root = new RootShim({ components }, { data: {} });
        const component = root.getComponent('textField');
        expect(component).to.be.instanceOf(InstanceShim);
        expect(component.component.key).to.be.equal('textField');
        expect(component.component.label).to.be.equal('Text Field');
    });

    it('should return a component (InstanceShim) at an exact path that is a nested component if it exists', () => {
        const components = [
            {
                type: 'datagrid',
                key: 'dataGrid',
                components: [
                    {
                        type: 'textfield',
                        key: 'textField',
                        label: 'Text Field',
                        input: true,
                    },
                    {
                        type: 'textfield',
                        key: 'textField2',
                        label: 'Text Field 2',
                        input: true,
                    },
                ],
            },
        ];
        const root = new RootShim(
            { components },
            {
                data: {
                    dataGrid: [
                        { textField: 'hello', textField2: 'world' },
                        { textField: 'foo', textField2: 'bar' },
                    ],
                },
            },
        );
        const component = root.getComponent('dataGrid');
        expect(component).to.be.instanceOf(InstanceShim);
        expect(component.component.key).to.be.equal('dataGrid');
        expect(root.getComponent('dataGrid[0].textField')).to.be.instanceOf(
            InstanceShim,
        );
        expect(
            root.getComponent('dataGrid[0].textField').component.key,
        ).to.be.equal('textField');
        expect(root.getComponent('dataGrid[0].textField2')).to.be.instanceOf(
            InstanceShim,
        );
        expect(
            root.getComponent('dataGrid[0].textField2').component.key,
        ).to.be.equal('textField2');
        expect(root.getComponent('dataGrid[1].textField')).to.be.instanceOf(
            InstanceShim,
        );
        expect(
            root.getComponent('dataGrid[1].textField').component.key,
        ).to.be.equal('textField');
        expect(root.getComponent('dataGrid[1].textField2')).to.be.instanceOf(
            InstanceShim,
        );
        expect(
            root.getComponent('dataGrid[1].textField2').component.key,
        ).to.be.equal('textField2');
    });

    it('Returned component should have visible option (true if not hidden)', () => {
        const component = {
            type: 'textfield',
            key: 'textField',
            label: 'Text Field',
            input: true,
        };
        const components = [component];
        const data = {
            textField: '123',
        };
        const scope = {
            conditionals: [{ conditionallyHidden: false, path: 'textField' }],
        };
        const root = new RootShim({ components }, { data }, scope);
        const notHiddenComponent = root.getComponent('textField');
        expect(notHiddenComponent).to.be.instanceOf(InstanceShim);
        expect(notHiddenComponent.visible).to.be.equal(true);
    });

    it('Returned component should have visible option (false if hidden)', () => {
        const component = {
            type: 'textfield',
            key: 'textField',
            label: 'Text Field',
            input: true,
        };

        const components = [component];
        const data = {
            textField: '123',
        };

        const scope = {
            conditionals: [{ conditionallyHidden: true, path: 'textField' }],
        };
        const root = new RootShim({ components }, { data }, scope);

        const hiddenComponent = root.getComponent('textField');
        expect(hiddenComponent).to.be.instanceOf(InstanceShim);
        expect(hiddenComponent.visible).to.be.equal(false);
    });
});

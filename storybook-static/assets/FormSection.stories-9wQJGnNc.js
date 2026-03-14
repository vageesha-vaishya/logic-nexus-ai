import{j as e}from"./jsx-runtime-Z5uAzocK.js";import{a as m,F as u}from"./FormLayout-oyGXQSLB.js";import{I as o}from"./input-CNzcFKnn.js";import{L as i}from"./label-DJjKlAcl.js";import{B as x}from"./button-D21-Im3S.js";import"./index-pP6CS22B.js";import"./_commonjsHelpers-Cpj98o6Y.js";import"./card-DV47ztDp.js";import"./utils-CytzSlOG.js";import"./index-BtDAWfto.js";import"./index-DLHbBEj9.js";import"./index-Ccz2s4W_.js";const N={title:"Forms/FormSection",component:m,parameters:{a11y:{disable:!1}},argTypes:{title:{control:"text",description:"Section title"},description:{control:"text",description:"Section description"},actions:{control:"object",description:"Header actions node"}}},r={args:{title:"Details",description:"Provide information below"},render:p=>e.jsx("div",{className:"p-4",children:e.jsx(m,{...p,children:e.jsxs(u,{columns:2,children:[e.jsxs("div",{className:"space-y-1",children:[e.jsx(i,{children:"Field A"}),e.jsx(o,{placeholder:"Value A"})]}),e.jsxs("div",{className:"space-y-1",children:[e.jsx(i,{children:"Field B"}),e.jsx(o,{placeholder:"Value B"})]})]})})})},s={args:{...r.args,actions:e.jsx(x,{size:"sm",variant:"outline",children:"Action"})},render:r.render};var n,t,a;r.parameters={...r.parameters,docs:{...(n=r.parameters)==null?void 0:n.docs,source:{originalSource:`{
  args: {
    title: "Details",
    description: "Provide information below"
  },
  render: args => <div className="p-4">
      <FormSection {...args}>
        <FormGrid columns={2}>
          <div className="space-y-1">
            <Label>Field A</Label>
            <Input placeholder="Value A" />
          </div>
          <div className="space-y-1">
            <Label>Field B</Label>
            <Input placeholder="Value B" />
          </div>
        </FormGrid>
      </FormSection>
    </div>
}`,...(a=(t=r.parameters)==null?void 0:t.docs)==null?void 0:a.source}}};var c,l,d;s.parameters={...s.parameters,docs:{...(c=s.parameters)==null?void 0:c.docs,source:{originalSource:`{
  args: {
    ...Basic.args,
    actions: <Button size="sm" variant="outline">Action</Button>
  },
  render: Basic.render
}`,...(d=(l=s.parameters)==null?void 0:l.docs)==null?void 0:d.source}}};const I=["Basic","WithActions"];export{r as Basic,s as WithActions,I as __namedExportsOrder,N as default};

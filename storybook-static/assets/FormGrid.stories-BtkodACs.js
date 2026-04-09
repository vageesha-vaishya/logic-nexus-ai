import{j as e,I as h}from"./iframe-BA3bigUR.js";import{F as o,a as t,b as j}from"./FormLayout-CZqNzbeo.js";import{L as S}from"./label-D9P-urtt.js";import"./preload-helper-C1FmrZbK.js";import"./card-CStZ5zmI.js";const E={title:"Forms/FormGrid",component:o,tags:["autodocs"],argTypes:{columns:{control:"select",options:[1,2,3,4],description:"Number of columns at md/lg breakpoints"}}},l=({label:a,placeholder:C,span:g})=>e.jsx(j,{span:g,children:e.jsxs("div",{className:"space-y-2",children:[e.jsx(S,{children:a}),e.jsx(h,{placeholder:C||`Enter ${a.toLowerCase()}...`})]})}),s={args:{columns:4},render:a=>e.jsx(t,{title:"Complex Entity Form",description:"Example of a complex form with mixed column spans",children:e.jsxs(o,{...a,children:[e.jsx(l,{label:"Organization Name",span:2}),e.jsx(l,{label:"Tax ID"}),e.jsx(l,{label:"Status"}),e.jsx(l,{label:"Full Address",span:"full",placeholder:"123 Main St, Suite 100"}),e.jsx(l,{label:"City"}),e.jsx(l,{label:"State"}),e.jsx(l,{label:"Zip Code"}),e.jsx(l,{label:"Country"}),e.jsx(j,{span:4,children:e.jsx("div",{className:"p-4 border rounded bg-muted/20 text-center text-muted-foreground",children:"Full width section (span 4)"})}),e.jsx(l,{label:"Contact Person",span:2}),e.jsx(l,{label:"Email",span:2})]})})},n={args:{columns:3},render:a=>e.jsx(t,{title:"3-Column Grid",description:"Standard desktop layout",children:e.jsxs(o,{...a,children:[e.jsx(l,{label:"First Name"}),e.jsx(l,{label:"Middle Name"}),e.jsx(l,{label:"Last Name"}),e.jsx(l,{label:"Address",span:2}),e.jsx(l,{label:"Zip"}),e.jsx(l,{label:"Notes",span:"full"})]})})},r={args:{columns:2},render:a=>e.jsx(t,{title:"2-Column Grid",description:"Compact layout",children:e.jsxs(o,{...a,children:[e.jsx(l,{label:"Username"}),e.jsx(l,{label:"Role"}),e.jsx(l,{label:"Email",span:"full"}),e.jsx(l,{label:"Password"}),e.jsx(l,{label:"Confirm Password"})]})})};var i,d,m;s.parameters={...s.parameters,docs:{...(i=s.parameters)==null?void 0:i.docs,source:{originalSource:`{
  args: {
    columns: 4
  },
  render: args => <FormSection title="Complex Entity Form" description="Example of a complex form with mixed column spans">
      <FormGrid {...args}>
        <Field label="Organization Name" span={2} />
        <Field label="Tax ID" />
        <Field label="Status" />
        
        <Field label="Full Address" span="full" placeholder="123 Main St, Suite 100" />
        
        <Field label="City" />
        <Field label="State" />
        <Field label="Zip Code" />
        <Field label="Country" />

        <FormItem span={4}>
          <div className="p-4 border rounded bg-muted/20 text-center text-muted-foreground">
            Full width section (span 4)
          </div>
        </FormItem>

        <Field label="Contact Person" span={2} />
        <Field label="Email" span={2} />
      </FormGrid>
    </FormSection>
}`,...(m=(d=s.parameters)==null?void 0:d.docs)==null?void 0:m.source}}};var c,p,u;n.parameters={...n.parameters,docs:{...(c=n.parameters)==null?void 0:c.docs,source:{originalSource:`{
  args: {
    columns: 3
  },
  render: args => <FormSection title="3-Column Grid" description="Standard desktop layout">
      <FormGrid {...args}>
        <Field label="First Name" />
        <Field label="Middle Name" />
        <Field label="Last Name" />
        
        <Field label="Address" span={2} />
        <Field label="Zip" />
        
        <Field label="Notes" span="full" />
      </FormGrid>
    </FormSection>
}`,...(u=(p=n.parameters)==null?void 0:p.docs)==null?void 0:u.source}}};var F,x,b;r.parameters={...r.parameters,docs:{...(F=r.parameters)==null?void 0:F.docs,source:{originalSource:`{
  args: {
    columns: 2
  },
  render: args => <FormSection title="2-Column Grid" description="Compact layout">
      <FormGrid {...args}>
        <Field label="Username" />
        <Field label="Role" />
        <Field label="Email" span="full" />
        <Field label="Password" />
        <Field label="Confirm Password" />
      </FormGrid>
    </FormSection>
}`,...(b=(x=r.parameters)==null?void 0:x.docs)==null?void 0:b.source}}};const L=["FourColumnLayout","ThreeColumnLayout","TwoColumnLayout"];export{s as FourColumnLayout,n as ThreeColumnLayout,r as TwoColumnLayout,L as __namedExportsOrder,E as default};

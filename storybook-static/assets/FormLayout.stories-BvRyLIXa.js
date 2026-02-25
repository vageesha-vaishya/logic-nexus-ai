import{j as e}from"./jsx-runtime-DF2Pcvd1.js";import{F as s,a as u,b as n,L as a}from"./label-CvlwLwVJ.js";import{I as r}from"./input-DQrLB-hL.js";import{S as j,a as I,b as F,c as S,d as o}from"./select-CbrB-pmO.js";import{B as m}from"./button-Cpm3eO9b.js";import"./index-B2-qRKKC.js";import"./_commonjsHelpers-Cpj98o6Y.js";import"./card-DDgMyP-I.js";import"./utils-CytzSlOG.js";import"./index-BmZbFD_3.js";import"./index-CFX93qP1.js";import"./index-Bh3JKd2m.js";import"./index-CGh0mKBy.js";import"./index-DW48STyt.js";import"./index-Z75IbNXa.js";import"./index-DRfMV7qj.js";import"./Combination-uNsERWH7.js";import"./index-ciuW_uyV.js";import"./index-Bz0SC8DB.js";import"./createLucideIcon-DapQ2WKf.js";import"./index-DK19BPjP.js";import"./index-_AbP6Uzr.js";const _={title:"Forms/FormLayout",component:s,parameters:{layout:"padded"},tags:["autodocs"]},t={render:()=>e.jsx(u,{title:"Complex Entity Form",description:"Example of a complex form with mixed column spans",className:"max-w-4xl",children:e.jsxs(s,{columns:4,children:[e.jsxs(n,{span:2,children:[e.jsx(a,{children:"Status"}),e.jsxs(j,{children:[e.jsx(I,{children:e.jsx(F,{placeholder:"...Enter status"})}),e.jsxs(S,{children:[e.jsx(o,{value:"active",children:"Active"}),e.jsx(o,{value:"inactive",children:"Inactive"})]})]})]}),e.jsxs(n,{span:2,children:[e.jsx(a,{children:"Tax ID"}),e.jsx(r,{placeholder:"...Enter tax id"})]}),e.jsxs(n,{span:4,children:[e.jsx(a,{children:"Organization Name"}),e.jsx(r,{placeholder:"...Enter organization name"})]}),e.jsxs(n,{span:4,children:[e.jsx(a,{children:"Full Address"}),e.jsx(r,{defaultValue:"Main St, Suite 100 123"})]}),e.jsxs(n,{span:1,children:[e.jsx(a,{children:"Country"}),e.jsx(r,{placeholder:"...Enter country"})]}),e.jsxs(n,{span:1,children:[e.jsx(a,{children:"Zip Code"}),e.jsx(r,{placeholder:"...Enter zip code"})]}),e.jsxs(n,{span:1,children:[e.jsx(a,{children:"State"}),e.jsx(r,{placeholder:"...Enter state"})]}),e.jsxs(n,{span:1,children:[e.jsx(a,{children:"City"}),e.jsx(r,{placeholder:"...Enter city"})]}),e.jsx(n,{span:4,className:"p-4 bg-muted rounded-md border border-dashed text-center text-muted-foreground",children:"Full width section (span 4)"}),e.jsxs(n,{span:2,children:[e.jsx(a,{children:"Email"}),e.jsx(r,{placeholder:"...Enter email"})]}),e.jsxs(n,{span:2,children:[e.jsx(a,{children:"Contact Person"}),e.jsx(r,{placeholder:"...Enter contact person"})]}),e.jsx(n,{span:4,className:"flex justify-end pt-4",children:e.jsxs("div",{className:"flex gap-2",children:[e.jsx(m,{variant:"outline",children:"Cancel"}),e.jsx(m,{children:"Save Changes"})]})})]})})},l={render:()=>e.jsxs(s,{columns:4,children:[e.jsxs(n,{span:1,children:[e.jsx(a,{children:"Column 1"}),e.jsx(r,{placeholder:"Span 1"})]}),e.jsxs(n,{span:1,children:[e.jsx(a,{children:"Column 2"}),e.jsx(r,{placeholder:"Span 1"})]}),e.jsxs(n,{span:1,children:[e.jsx(a,{children:"Column 3"}),e.jsx(r,{placeholder:"Span 1"})]}),e.jsxs(n,{span:1,children:[e.jsx(a,{children:"Column 4"}),e.jsx(r,{placeholder:"Span 1"})]}),e.jsxs(n,{span:2,children:[e.jsx(a,{children:"Span 2"}),e.jsx(r,{placeholder:"Span 2"})]}),e.jsxs(n,{span:2,children:[e.jsx(a,{children:"Span 2"}),e.jsx(r,{placeholder:"Span 2"})]}),e.jsxs(n,{span:3,children:[e.jsx(a,{children:"Span 3"}),e.jsx(r,{placeholder:"Span 3"})]}),e.jsxs(n,{span:1,children:[e.jsx(a,{children:"Span 1"}),e.jsx(r,{placeholder:"Span 1"})]}),e.jsxs(n,{span:4,children:[e.jsx(a,{children:"Span 4 (Full Width)"}),e.jsx(r,{placeholder:"Span 4"})]})]})};var p,c,d;t.parameters={...t.parameters,docs:{...(p=t.parameters)==null?void 0:p.docs,source:{originalSource:`{
  render: () => <FormSection title="Complex Entity Form" description="Example of a complex form with mixed column spans" className="max-w-4xl">
      <FormGrid columns={4}>
        <FormItem span={2}>
          <Label>Status</Label>
          <Select>
            <SelectTrigger>
              <SelectValue placeholder="...Enter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </FormItem>
        <FormItem span={2}>
          <Label>Tax ID</Label>
          <Input placeholder="...Enter tax id" />
        </FormItem>

        <FormItem span={4}>
          <Label>Organization Name</Label>
          <Input placeholder="...Enter organization name" />
        </FormItem>

        <FormItem span={4}>
          <Label>Full Address</Label>
          <Input defaultValue="Main St, Suite 100 123" />
        </FormItem>

        <FormItem span={1}>
          <Label>Country</Label>
          <Input placeholder="...Enter country" />
        </FormItem>
        <FormItem span={1}>
          <Label>Zip Code</Label>
          <Input placeholder="...Enter zip code" />
        </FormItem>
        <FormItem span={1}>
          <Label>State</Label>
          <Input placeholder="...Enter state" />
        </FormItem>
        <FormItem span={1}>
          <Label>City</Label>
          <Input placeholder="...Enter city" />
        </FormItem>

        <FormItem span={4} className="p-4 bg-muted rounded-md border border-dashed text-center text-muted-foreground">
          Full width section (span 4)
        </FormItem>

        <FormItem span={2}>
          <Label>Email</Label>
          <Input placeholder="...Enter email" />
        </FormItem>
        <FormItem span={2}>
          <Label>Contact Person</Label>
          <Input placeholder="...Enter contact person" />
        </FormItem>
        
        <FormItem span={4} className="flex justify-end pt-4">
          <div className="flex gap-2">
            <Button variant="outline">Cancel</Button>
            <Button>Save Changes</Button>
          </div>
        </FormItem>
      </FormGrid>
    </FormSection>
}`,...(d=(c=t.parameters)==null?void 0:c.docs)==null?void 0:d.source}}};var i,x,h;l.parameters={...l.parameters,docs:{...(i=l.parameters)==null?void 0:i.docs,source:{originalSource:`{
  render: () => <FormGrid columns={4}>
      <FormItem span={1}>
        <Label>Column 1</Label>
        <Input placeholder="Span 1" />
      </FormItem>
      <FormItem span={1}>
        <Label>Column 2</Label>
        <Input placeholder="Span 1" />
      </FormItem>
      <FormItem span={1}>
        <Label>Column 3</Label>
        <Input placeholder="Span 1" />
      </FormItem>
      <FormItem span={1}>
        <Label>Column 4</Label>
        <Input placeholder="Span 1" />
      </FormItem>
      
      <FormItem span={2}>
        <Label>Span 2</Label>
        <Input placeholder="Span 2" />
      </FormItem>
      <FormItem span={2}>
        <Label>Span 2</Label>
        <Input placeholder="Span 2" />
      </FormItem>
      
      <FormItem span={3}>
        <Label>Span 3</Label>
        <Input placeholder="Span 3" />
      </FormItem>
      <FormItem span={1}>
        <Label>Span 1</Label>
        <Input placeholder="Span 1" />
      </FormItem>
      
      <FormItem span={4}>
        <Label>Span 4 (Full Width)</Label>
        <Input placeholder="Span 4" />
      </FormItem>
    </FormGrid>
}`,...(h=(x=l.parameters)==null?void 0:x.docs)==null?void 0:h.source}}};const R=["ComplexEntityForm","FourColumnLayout"];export{t as ComplexEntityForm,l as FourColumnLayout,R as __namedExportsOrder,_ as default};

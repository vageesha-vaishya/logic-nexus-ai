import{j as e}from"./jsx-runtime-Z5uAzocK.js";import{W as L}from"./WidgetContainer-jFqrZ5le.js";import"./index-pP6CS22B.js";import"./_commonjsHelpers-Cpj98o6Y.js";import"./card-BRH59LJj.js";import"./utils-mOyDzkE6.js";const R={title:"Dashboard/Widget",component:L,tags:["autodocs"],parameters:{layout:"centered",controls:{expanded:!0}},argTypes:{title:{control:"text",description:"Widget title"},children:{description:"Widget content"},className:{control:"text",description:"Custom CSS classes for the card"}}},t=({children:F})=>e.jsx("div",{className:"p-4 text-center text-gray-600",children:F}),s={args:{title:"Small Widget",children:e.jsx(t,{children:"Small widget content here"}),className:"w-48"}},a={args:{title:"Medium Widget",children:e.jsx(t,{children:"Medium widget content here"}),className:"w-96"}},r={args:{title:"Large Widget",children:e.jsx(t,{children:"Large widget content here with more space for displaying data"}),className:"w-full"}},i={args:{title:"Full Width Widget",children:e.jsx(t,{children:"Full width widget content spanning the entire width"}),className:"w-full"}},n={args:{title:"Widget with Actions",children:e.jsx(t,{children:"Widget content with action buttons"}),action:e.jsxs("div",{className:"flex gap-2",children:[e.jsx("button",{className:"px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600",children:"Action 1"}),e.jsx("button",{className:"px-3 py-1 text-sm bg-gray-300 text-gray-700 rounded hover:bg-gray-400",children:"Action 2"})]}),className:"w-96"}},d={args:{children:e.jsx(t,{children:"Widget without a title bar"}),className:"w-96"}},c={args:{title:"Complex Widget",children:e.jsxs("div",{className:"space-y-3",children:[e.jsxs("div",{className:"flex justify-between items-center p-2 bg-gray-50 rounded",children:[e.jsx("span",{className:"font-medium",children:"Metric 1"}),e.jsx("span",{className:"text-lg font-bold text-blue-600",children:"$45,000"})]}),e.jsxs("div",{className:"flex justify-between items-center p-2 bg-gray-50 rounded",children:[e.jsx("span",{className:"font-medium",children:"Metric 2"}),e.jsx("span",{className:"text-lg font-bold text-green-600",children:"82%"})]}),e.jsxs("div",{className:"flex justify-between items-center p-2 bg-gray-50 rounded",children:[e.jsx("span",{className:"font-medium",children:"Metric 3"}),e.jsx("span",{className:"text-lg font-bold text-purple-600",children:"1,234"})]})]}),className:"w-96"}};var o,l,m;s.parameters={...s.parameters,docs:{...(o=s.parameters)==null?void 0:o.docs,source:{originalSource:`{
  args: {
    title: 'Small Widget',
    children: <WidgetBody>Small widget content here</WidgetBody>,
    className: 'w-48'
  }
}`,...(m=(l=s.parameters)==null?void 0:l.docs)==null?void 0:m.source}}};var g,p,u;a.parameters={...a.parameters,docs:{...(g=a.parameters)==null?void 0:g.docs,source:{originalSource:`{
  args: {
    title: 'Medium Widget',
    children: <WidgetBody>Medium widget content here</WidgetBody>,
    className: 'w-96'
  }
}`,...(u=(p=a.parameters)==null?void 0:p.docs)==null?void 0:u.source}}};var h,x,b;r.parameters={...r.parameters,docs:{...(h=r.parameters)==null?void 0:h.docs,source:{originalSource:`{
  args: {
    title: 'Large Widget',
    children: <WidgetBody>Large widget content here with more space for displaying data</WidgetBody>,
    className: 'w-full'
  }
}`,...(b=(x=r.parameters)==null?void 0:x.docs)==null?void 0:b.source}}};var w,y,N;i.parameters={...i.parameters,docs:{...(w=i.parameters)==null?void 0:w.docs,source:{originalSource:`{
  args: {
    title: 'Full Width Widget',
    children: <WidgetBody>Full width widget content spanning the entire width</WidgetBody>,
    className: 'w-full'
  }
}`,...(N=(y=i.parameters)==null?void 0:y.docs)==null?void 0:N.source}}};var W,f,j;n.parameters={...n.parameters,docs:{...(W=n.parameters)==null?void 0:W.docs,source:{originalSource:`{
  args: {
    title: 'Widget with Actions',
    children: <WidgetBody>Widget content with action buttons</WidgetBody>,
    action: <div className="flex gap-2">
        <button className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">
          Action 1
        </button>
        <button className="px-3 py-1 text-sm bg-gray-300 text-gray-700 rounded hover:bg-gray-400">
          Action 2
        </button>
      </div>,
    className: 'w-96'
  }
}`,...(j=(f=n.parameters)==null?void 0:f.docs)==null?void 0:j.source}}};var v,S,B;d.parameters={...d.parameters,docs:{...(v=d.parameters)==null?void 0:v.docs,source:{originalSource:`{
  args: {
    children: <WidgetBody>Widget without a title bar</WidgetBody>,
    className: 'w-96'
  }
}`,...(B=(S=d.parameters)==null?void 0:S.docs)==null?void 0:B.source}}};var M,C,A;c.parameters={...c.parameters,docs:{...(M=c.parameters)==null?void 0:M.docs,source:{originalSource:`{
  args: {
    title: 'Complex Widget',
    children: <div className="space-y-3">
        <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
          <span className="font-medium">Metric 1</span>
          <span className="text-lg font-bold text-blue-600">$45,000</span>
        </div>
        <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
          <span className="font-medium">Metric 2</span>
          <span className="text-lg font-bold text-green-600">82%</span>
        </div>
        <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
          <span className="font-medium">Metric 3</span>
          <span className="text-lg font-bold text-purple-600">1,234</span>
        </div>
      </div>,
    className: 'w-96'
  }
}`,...(A=(C=c.parameters)==null?void 0:C.docs)==null?void 0:A.source}}};const k=["Small","Medium","Large","Full","WithActions","WithoutTitle","WithComplexContent"];export{i as Full,r as Large,a as Medium,s as Small,n as WithActions,c as WithComplexContent,d as WithoutTitle,k as __namedExportsOrder,R as default};

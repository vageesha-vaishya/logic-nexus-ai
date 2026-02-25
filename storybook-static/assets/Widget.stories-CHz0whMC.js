import{j as e}from"./jsx-runtime-DF2Pcvd1.js";import{C as $,a as D,b as H,d as I}from"./card-DDgMyP-I.js";import{c as o}from"./utils-CytzSlOG.js";import"./index-B2-qRKKC.js";import"./_commonjsHelpers-Cpj98o6Y.js";function L({title:l,action:d,children:q,className:_,contentClassName:E}){return e.jsxs($,{className:o("h-full flex flex-col",_),children:[(l||d)&&e.jsxs(D,{className:"flex-row items-center justify-between space-y-0 pb-2",children:[l&&e.jsx(H,{className:"text-base font-medium",children:l}),d&&e.jsx("div",{className:"flex items-center gap-2",children:d})]}),e.jsx(I,{className:o("flex-1",E),children:q})]})}L.__docgenInfo={description:"",methods:[],displayName:"WidgetContainer",props:{title:{required:!1,tsType:{name:"ReactReactNode",raw:"React.ReactNode"},description:""},action:{required:!1,tsType:{name:"ReactReactNode",raw:"React.ReactNode"},description:""},children:{required:!0,tsType:{name:"ReactReactNode",raw:"React.ReactNode"},description:""},className:{required:!1,tsType:{name:"string"},description:""},contentClassName:{required:!1,tsType:{name:"string"},description:""}}};const J={title:"Dashboard/Widget",component:L,tags:["autodocs"],argTypes:{title:{control:"text",description:"Widget title"},children:{description:"Widget content"},className:{control:"text",description:"Custom CSS classes for the card"}}},t={args:{title:"Small Widget",children:e.jsx("div",{className:"p-4 text-center text-gray-600",children:"Small widget content here"}),className:"w-48"}},s={args:{title:"Medium Widget",children:e.jsx("div",{className:"p-4 text-center text-gray-600",children:"Medium widget content here"}),className:"w-96"}},a={args:{title:"Large Widget",children:e.jsx("div",{className:"p-6 text-center text-gray-600",children:"Large widget content here with more space for displaying data"}),className:"w-full"}},r={args:{title:"Full Width Widget",children:e.jsx("div",{className:"p-6 text-center text-gray-600",children:"Full width widget content spanning the entire width"}),className:"w-full"}},i={args:{title:"Widget with Actions",children:e.jsx("div",{className:"p-4 text-gray-600",children:"Widget content with action buttons"}),action:e.jsxs("div",{className:"flex gap-2",children:[e.jsx("button",{className:"px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600",children:"Action 1"}),e.jsx("button",{className:"px-3 py-1 text-sm bg-gray-300 text-gray-700 rounded hover:bg-gray-400",children:"Action 2"})]}),className:"w-96"}},c={args:{children:e.jsx("div",{className:"p-4 text-center text-gray-600",children:"Widget without a title bar"}),className:"w-96"}},n={args:{title:"Complex Widget",children:e.jsxs("div",{className:"space-y-3",children:[e.jsxs("div",{className:"flex justify-between items-center p-2 bg-gray-50 rounded",children:[e.jsx("span",{className:"font-medium",children:"Metric 1"}),e.jsx("span",{className:"text-lg font-bold text-blue-600",children:"$45,000"})]}),e.jsxs("div",{className:"flex justify-between items-center p-2 bg-gray-50 rounded",children:[e.jsx("span",{className:"font-medium",children:"Metric 2"}),e.jsx("span",{className:"text-lg font-bold text-green-600",children:"82%"})]}),e.jsxs("div",{className:"flex justify-between items-center p-2 bg-gray-50 rounded",children:[e.jsx("span",{className:"font-medium",children:"Metric 3"}),e.jsx("span",{className:"text-lg font-bold text-purple-600",children:"1,234"})]})]}),className:"w-96"}};var m,p,g;t.parameters={...t.parameters,docs:{...(m=t.parameters)==null?void 0:m.docs,source:{originalSource:`{
  args: {
    title: 'Small Widget',
    children: <div className="p-4 text-center text-gray-600">Small widget content here</div>,
    className: 'w-48'
  }
}`,...(g=(p=t.parameters)==null?void 0:p.docs)==null?void 0:g.source}}};var u,x,h;s.parameters={...s.parameters,docs:{...(u=s.parameters)==null?void 0:u.docs,source:{originalSource:`{
  args: {
    title: 'Medium Widget',
    children: <div className="p-4 text-center text-gray-600">Medium widget content here</div>,
    className: 'w-96'
  }
}`,...(h=(x=s.parameters)==null?void 0:x.docs)==null?void 0:h.source}}};var N,f,b;a.parameters={...a.parameters,docs:{...(N=a.parameters)==null?void 0:N.docs,source:{originalSource:`{
  args: {
    title: 'Large Widget',
    children: <div className="p-6 text-center text-gray-600">Large widget content here with more space for displaying data</div>,
    className: 'w-full'
  }
}`,...(b=(f=a.parameters)==null?void 0:f.docs)==null?void 0:b.source}}};var w,y,v;r.parameters={...r.parameters,docs:{...(w=r.parameters)==null?void 0:w.docs,source:{originalSource:`{
  args: {
    title: 'Full Width Widget',
    children: <div className="p-6 text-center text-gray-600">Full width widget content spanning the entire width</div>,
    className: 'w-full'
  }
}`,...(v=(y=r.parameters)==null?void 0:y.docs)==null?void 0:v.source}}};var j,W,C;i.parameters={...i.parameters,docs:{...(j=i.parameters)==null?void 0:j.docs,source:{originalSource:`{
  args: {
    title: 'Widget with Actions',
    children: <div className="p-4 text-gray-600">Widget content with action buttons</div>,
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
}`,...(C=(W=i.parameters)==null?void 0:W.docs)==null?void 0:C.source}}};var S,R,M;c.parameters={...c.parameters,docs:{...(S=c.parameters)==null?void 0:S.docs,source:{originalSource:`{
  args: {
    children: <div className="p-4 text-center text-gray-600">Widget without a title bar</div>,
    className: 'w-96'
  }
}`,...(M=(R=c.parameters)==null?void 0:R.docs)==null?void 0:M.source}}};var T,A,F;n.parameters={...n.parameters,docs:{...(T=n.parameters)==null?void 0:T.docs,source:{originalSource:`{
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
}`,...(F=(A=n.parameters)==null?void 0:A.docs)==null?void 0:F.source}}};const K=["Small","Medium","Large","Full","WithActions","WithoutTitle","WithComplexContent"];export{r as Full,a as Large,s as Medium,t as Small,i as WithActions,n as WithComplexContent,c as WithoutTitle,K as __namedExportsOrder,J as default};

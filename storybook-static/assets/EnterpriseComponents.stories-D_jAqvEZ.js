import{j as e}from"./jsx-runtime-Z5uAzocK.js";import{r as g,R as xa}from"./index-pP6CS22B.js";import"./button-SB7iZ1uz.js";import{I as a}from"./input-uwiBJMe4.js";import{c as o}from"./utils-mOyDzkE6.js";import{C as Ae}from"./chevrons-up-down-ChP24vm-.js";import{C as ha}from"./chevron-up-BYJQeOkQ.js";import{C as ya}from"./chevron-down-D-nzWkjq.js";import{m as k}from"./proxy-C3Nso6pS.js";import{D as ga,a as ba,b as ja,c as fa,d as va,e as Ea}from"./dialog-Ja5eIU7h.js";import{S as Ce,a as Te,b as qe,c as Be,d as h}from"./select-DnAFOhuz.js";import{S as A,C as la}from"./settings-DB_wZjJV.js";import{c as Na}from"./createLucideIcon-DEP7aKU9.js";import{T as Fa}from"./trash-2-D2oab9LF.js";import{P as oa}from"./plus-BkGVcHzy.js";import"./_commonjsHelpers-Cpj98o6Y.js";import"./index-CyLt0tHj.js";import"./index-DGOKVkT8.js";import"./index-DW48STyt.js";import"./index-CuDmVINA.js";import"./index-CiCgAmAg.js";import"./index-DLuVoU5X.js";import"./index-DyZtt5qy.js";import"./index-BzXjCyLi.js";import"./index-DLHbBEj9.js";import"./index-DSMx10ar.js";import"./index-Bk-1lDEB.js";import"./x-DFQ5vw_2.js";import"./index-7TLWIpSA.js";import"./index-WQoRFki_.js";import"./index-DvPxE0jW.js";import"./index-CTbEET-J.js";import"./index-WyfESzTi.js";import"./index-hrYVS3HY.js";import"./check--MVdLoPp.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Sa=Na("Pen",[["path",{d:"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",key:"1a8usu"}]]);function F({columns:r,data:t,rowKey:i,onRowClick:d,sortBy:c,sortOrder:m="asc",onSort:b,isLoading:j=!1,emptyState:E,rowClassName:N,className:p,headerClassName:T,striped:M=!0,hover:Re=!0}){const[da,ca]=g.useState(null),ke=!!(c&&b),f=ke?c?{column:c,direction:m}:null:da,ma=g.useMemo(()=>f?[...t].sort((u,x)=>{const S=u[f.column],w=x[f.column];return S==null&&w==null?0:S==null?1:w==null?-1:typeof S=="string"&&typeof w=="string"?f.direction==="asc"?S.localeCompare(w):w.localeCompare(S):typeof S=="number"&&typeof w=="number"?f.direction==="asc"?S-w:w-S:0}):t,[t,f]),ua=l=>{if(l.sortable)if(ke&&b){const x=(c===String(l.key)?m:"asc")==="asc"?"desc":"asc";b(String(l.key),x)}else ca(u=>(u==null?void 0:u.column)!==l.key?{column:l.key,direction:"asc"}:u.direction==="asc"?{column:l.key,direction:"desc"}:null)},pa=l=>l.sortable?(f==null?void 0:f.column)!==l.key?e.jsx(Ae,{className:"h-4 w-4 text-gray-400"}):f.direction==="asc"?e.jsx(ha,{className:"h-4 w-4 text-primary"}):f.direction==="desc"?e.jsx(ya,{className:"h-4 w-4 text-primary"}):e.jsx(Ae,{className:"h-4 w-4 text-gray-400"}):null;return j?e.jsx("div",{className:o("border border-gray-200 rounded-lg shadow-[0_1px_4px_rgba(0,0,0,0.05)]",p),children:e.jsxs("table",{className:"w-full",children:[e.jsx("thead",{className:"bg-gray-50 border-b border-gray-200",children:e.jsx("tr",{children:r.map(l=>e.jsx("th",{style:{width:l.width},className:o("px-6 py-3 text-left text-sm font-medium text-gray-900",l.headerClassName),children:l.label},String(l.key)))})}),e.jsx("tbody",{children:[...Array(5)].map((l,u)=>e.jsx("tr",{className:"border-b border-gray-200 bg-white",children:r.map(x=>e.jsx("td",{className:o("px-6 py-3 text-sm",x.cellClassName),children:e.jsx("div",{className:"h-4 bg-gray-200 rounded animate-pulse"})},`${u}-${String(x.key)}`))},u))})]})}):t.length===0?e.jsx("div",{className:o("border border-gray-200 rounded-lg shadow-[0_1px_4px_rgba(0,0,0,0.05)] p-8",p),children:e.jsx("div",{className:"text-center text-muted-foreground",children:E||e.jsx(e.Fragment,{children:e.jsx("p",{className:"text-sm text-gray-500",children:"No data available"})})})}):e.jsx("div",{className:o("border border-gray-200 rounded-lg shadow-[0_1px_4px_rgba(0,0,0,0.05)] overflow-hidden",p),children:e.jsxs("table",{className:"w-full",children:[e.jsx("thead",{className:o("bg-gray-50 border-b border-gray-200",T),children:e.jsx("tr",{children:r.map(l=>e.jsx("th",{style:{width:l.width},onClick:()=>ua(l),className:o("px-6 py-3 text-left text-sm font-medium text-gray-900",l.sortable&&"cursor-pointer hover:bg-gray-100 transition-colors",l.headerClassName),children:e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("span",{children:l.label}),pa(l)]})},String(l.key)))})}),e.jsx("tbody",{children:ma.map((l,u)=>e.jsx("tr",{onClick:()=>d==null?void 0:d(l,u),className:o("border-b border-gray-200 transition-colors",M&&u%2===1&&"bg-gray-50",Re&&"hover:bg-gray-100",d&&"cursor-pointer",!M&&!Re&&"bg-white",N),children:r.map(x=>e.jsx("td",{className:o("px-6 py-3 text-sm text-gray-900",x.className,x.cellClassName),children:x.render?x.render(l[x.key],l,u):String(l[x.key]??"-")},String(x.key)))},i?i(l,u):u))})]})})}F.__docgenInfo={description:"",methods:[],displayName:"EnterpriseTable",props:{columns:{required:!0,tsType:{name:"Array",elements:[{name:"Column",elements:[{name:"T"}],raw:"Column<T>"}],raw:"Column<T>[]"},description:""},data:{required:!0,tsType:{name:"Array",elements:[{name:"T"}],raw:"T[]"},description:""},rowKey:{required:!1,tsType:{name:"signature",type:"function",raw:"(row: T, index: number) => string | number",signature:{arguments:[{type:{name:"T"},name:"row"},{type:{name:"number"},name:"index"}],return:{name:"union",raw:"string | number",elements:[{name:"string"},{name:"number"}]}}},description:""},onRowClick:{required:!1,tsType:{name:"signature",type:"function",raw:"(row: T, index: number) => void",signature:{arguments:[{type:{name:"T"},name:"row"},{type:{name:"number"},name:"index"}],return:{name:"void"}}},description:""},sortBy:{required:!1,tsType:{name:"string"},description:""},sortOrder:{required:!1,tsType:{name:"union",raw:"'asc' | 'desc'",elements:[{name:"literal",value:"'asc'"},{name:"literal",value:"'desc'"}]},description:"",defaultValue:{value:"'asc'",computed:!1}},onSort:{required:!1,tsType:{name:"signature",type:"function",raw:"(key: string, order: 'asc' | 'desc') => void",signature:{arguments:[{type:{name:"string"},name:"key"},{type:{name:"union",raw:"'asc' | 'desc'",elements:[{name:"literal",value:"'asc'"},{name:"literal",value:"'desc'"}]},name:"order"}],return:{name:"void"}}},description:""},isLoading:{required:!1,tsType:{name:"boolean"},description:"",defaultValue:{value:"false",computed:!1}},emptyState:{required:!1,tsType:{name:"ReactReactNode",raw:"React.ReactNode"},description:""},rowClassName:{required:!1,tsType:{name:"string"},description:""},className:{required:!1,tsType:{name:"string"},description:""},headerClassName:{required:!1,tsType:{name:"string"},description:""},striped:{required:!1,tsType:{name:"boolean"},description:"",defaultValue:{value:"true",computed:!1}},hover:{required:!1,tsType:{name:"boolean"},description:"",defaultValue:{value:"true",computed:!1}}}};const wa={default:"bg-white border border-gray-200 shadow-[0_1px_4px_rgba(0,0,0,0.05)]",outlined:"bg-white border border-gray-200",elevated:"bg-white border border-gray-200 shadow-[0_4px_12px_rgba(0,0,0,0.08)]"};function C({title:r,description:t,icon:i,children:d,footer:c,actions:m,className:b,headerClassName:j,bodyClassName:E,footerClassName:N,clickable:p=!1,onClick:T,variant:M="default"}){return e.jsxs(k.div,{initial:{opacity:0,y:8},animate:{opacity:1,y:0},transition:{duration:.2,ease:"easeOut"},onClick:T,className:o("rounded-sm overflow-hidden transition-all",wa[M],p&&"cursor-pointer hover:shadow-[0_8px_16px_rgba(0,0,0,0.1)]",b),children:[(r||t||m)&&e.jsxs("header",{className:o("px-4 py-3 border-b border-gray-200 bg-gray-50/50 flex items-start justify-between",j),children:[e.jsxs("div",{className:"flex items-start gap-3",children:[i&&e.jsx("div",{className:"text-gray-600 mt-0.5",children:i}),e.jsxs("div",{children:[r&&e.jsx("h3",{className:"text-sm font-semibold text-gray-900",children:r}),t&&e.jsx("p",{className:"text-xs text-muted-foreground mt-1",children:t})]})]}),m&&e.jsx("div",{className:"flex items-center gap-2",children:m})]}),e.jsx("section",{className:o("p-4",E),children:d}),c&&e.jsx("footer",{className:o("px-4 py-3 border-t border-gray-200 bg-gray-50/50",N),children:c})]})}C.__docgenInfo={description:"",methods:[],displayName:"EnterpriseCard",props:{title:{required:!1,tsType:{name:"string"},description:""},description:{required:!1,tsType:{name:"string"},description:""},icon:{required:!1,tsType:{name:"ReactReactNode",raw:"React.ReactNode"},description:""},children:{required:!0,tsType:{name:"ReactReactNode",raw:"React.ReactNode"},description:""},footer:{required:!1,tsType:{name:"ReactReactNode",raw:"React.ReactNode"},description:""},actions:{required:!1,tsType:{name:"ReactReactNode",raw:"React.ReactNode"},description:""},className:{required:!1,tsType:{name:"string"},description:""},headerClassName:{required:!1,tsType:{name:"string"},description:""},bodyClassName:{required:!1,tsType:{name:"string"},description:""},footerClassName:{required:!1,tsType:{name:"string"},description:""},clickable:{required:!1,tsType:{name:"boolean"},description:"",defaultValue:{value:"false",computed:!1}},onClick:{required:!1,tsType:{name:"signature",type:"function",raw:"() => void",signature:{arguments:[],return:{name:"void"}}},description:""},variant:{required:!1,tsType:{name:"union",raw:"'default' | 'outlined' | 'elevated'",elements:[{name:"literal",value:"'default'"},{name:"literal",value:"'outlined'"},{name:"literal",value:"'elevated'"}]},description:"",defaultValue:{value:"'default'",computed:!1}}}};function R({isOpen:r,onClose:t,title:i,description:d,children:c,footer:m,size:b="md",className:j,headerClassName:E,contentClassName:N,footerClassName:p}){const T={sm:"max-w-sm",md:"max-w-md",lg:"max-w-lg",xl:"max-w-xl"};return e.jsx(ga,{open:r,onOpenChange:t,children:e.jsx(ba,{className:o(T[b],"border-gray-200 shadow-[0_20px_25px_rgba(0,0,0,0.1)]",j),children:e.jsxs(k.div,{initial:{opacity:0,scale:.95},animate:{opacity:1,scale:1},exit:{opacity:0,scale:.95},transition:{duration:.2},children:[e.jsxs(ja,{className:o("border-b border-gray-200 pb-4",E),children:[e.jsx(fa,{className:"text-lg font-semibold text-gray-900",children:i}),d&&e.jsx(va,{className:"text-sm text-muted-foreground mt-1",children:d})]}),e.jsx("div",{className:o("py-4",N),children:c}),m&&e.jsx(Ea,{className:o("border-t border-gray-200 pt-4 mt-4",p),children:m})]})})})}R.__docgenInfo={description:"",methods:[],displayName:"EnterpriseModal",props:{isOpen:{required:!0,tsType:{name:"boolean"},description:""},onClose:{required:!0,tsType:{name:"signature",type:"function",raw:"() => void",signature:{arguments:[],return:{name:"void"}}},description:""},title:{required:!0,tsType:{name:"string"},description:""},description:{required:!1,tsType:{name:"string"},description:""},children:{required:!0,tsType:{name:"ReactReactNode",raw:"React.ReactNode"},description:""},footer:{required:!1,tsType:{name:"ReactReactNode",raw:"React.ReactNode"},description:""},size:{required:!1,tsType:{name:"union",raw:"'sm' | 'md' | 'lg' | 'xl'",elements:[{name:"literal",value:"'sm'"},{name:"literal",value:"'md'"},{name:"literal",value:"'lg'"},{name:"literal",value:"'xl'"}]},description:"",defaultValue:{value:"'md'",computed:!1}},className:{required:!1,tsType:{name:"string"},description:""},headerClassName:{required:!1,tsType:{name:"string"},description:""},contentClassName:{required:!1,tsType:{name:"string"},description:""},footerClassName:{required:!1,tsType:{name:"string"},description:""}}};const Ca={default:{container:"py-6",title:"text-2xl",subtitle:"text-sm",description:"text-sm"},compact:{container:"py-4",title:"text-lg",subtitle:"text-xs",description:"text-xs"},large:{container:"py-8",title:"text-4xl",subtitle:"text-base",description:"text-base"}};function q({title:r,subtitle:t,description:i,icon:d,status:c,actions:m,className:b,titleClassName:j,contentClassName:E,variant:N="default"}){const p=Ca[N];return e.jsx(k.header,{initial:{opacity:0,y:-10},animate:{opacity:1,y:0},transition:{duration:.3,ease:"easeOut"},className:o("border-b border-gray-200 bg-white",p.container,b),children:e.jsxs("div",{className:o("px-4 md:px-6 flex items-start justify-between gap-6",E),children:[e.jsxs("div",{className:"flex items-start gap-4 flex-1 min-w-0",children:[d&&e.jsx("div",{className:"flex-shrink-0 text-gray-600 mt-1",children:d}),e.jsxs("div",{className:"flex-1 min-w-0",children:[e.jsx("h1",{className:o("font-bold text-gray-900 leading-tight",p.title,j),children:r}),t&&e.jsx("p",{className:o("text-gray-600 mt-1",p.subtitle),children:t}),i&&e.jsx("p",{className:o("text-gray-500 mt-2",p.description),children:i})]})]}),e.jsxs("div",{className:"flex items-center gap-3 flex-shrink-0",children:[c&&e.jsx("div",{className:"flex items-center",children:c}),m&&e.jsx("div",{className:"flex items-center gap-2",children:m})]})]})})}q.__docgenInfo={description:"",methods:[],displayName:"EnterpriseHeader",props:{title:{required:!0,tsType:{name:"string"},description:""},subtitle:{required:!1,tsType:{name:"string"},description:""},description:{required:!1,tsType:{name:"string"},description:""},icon:{required:!1,tsType:{name:"ReactReactNode",raw:"React.ReactNode"},description:""},status:{required:!1,tsType:{name:"ReactReactNode",raw:"React.ReactNode"},description:""},actions:{required:!1,tsType:{name:"ReactReactNode",raw:"React.ReactNode"},description:""},className:{required:!1,tsType:{name:"string"},description:""},titleClassName:{required:!1,tsType:{name:"string"},description:""},contentClassName:{required:!1,tsType:{name:"string"},description:""},variant:{required:!1,tsType:{name:"union",raw:"'default' | 'compact' | 'large'",elements:[{name:"literal",value:"'default'"},{name:"literal",value:"'compact'"},{name:"literal",value:"'large'"}]},description:"",defaultValue:{value:"'default'",computed:!1}}}};const s=xa.forwardRef(({variant:r="primary",size:t="md",icon:i,iconPosition:d="left",loading:c=!1,children:m,className:b,disabled:j,...E},N)=>{const p={primary:"bg-[#714B67] text-white hover:bg-[#5d3d54] disabled:bg-gray-300 disabled:text-gray-500",secondary:"bg-gray-100 text-gray-900 hover:bg-gray-200 disabled:bg-gray-100 disabled:text-gray-400",destructive:"bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300 disabled:text-red-100",ghost:"bg-transparent text-gray-900 hover:bg-gray-100 disabled:text-gray-400",outline:"bg-white border border-gray-300 text-gray-900 hover:bg-gray-50 disabled:border-gray-200 disabled:text-gray-400"},T={sm:"px-3 py-1.5 text-xs font-medium rounded-sm",md:"px-4 py-2 text-sm font-medium rounded-sm",lg:"px-6 py-2.5 text-base font-semibold rounded-sm"};return e.jsx(k.button,{ref:N,whileHover:!j&&!c?{scale:1.02}:{},whileTap:!j&&!c?{scale:.98}:{},disabled:j||c,className:o("inline-flex items-center justify-center gap-2 font-medium transition-all","focus:outline-none focus:ring-2 focus:ring-[#714B67]/20 focus:ring-offset-2","disabled:cursor-not-allowed disabled:opacity-60",p[r],T[t],b),...E,children:c?e.jsxs(e.Fragment,{children:[e.jsxs("svg",{className:"h-4 w-4 animate-spin",xmlns:"http://www.w3.org/2000/svg",fill:"none",viewBox:"0 0 24 24",children:[e.jsx("circle",{className:"opacity-25",cx:"12",cy:"12",r:"10",stroke:"currentColor",strokeWidth:"4"}),e.jsx("path",{className:"opacity-75",fill:"currentColor",d:"M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"})]}),e.jsx("span",{children:"Loading..."})]}):e.jsxs(e.Fragment,{children:[i&&d==="left"&&e.jsx("span",{children:i}),e.jsx("span",{children:m}),i&&d==="right"&&e.jsx("span",{children:i})]})})});s.displayName="EnterpriseButton";s.__docgenInfo={description:"",methods:[],displayName:"EnterpriseButton",props:{variant:{required:!1,tsType:{name:"union",raw:"'primary' | 'secondary' | 'destructive' | 'ghost' | 'outline'",elements:[{name:"literal",value:"'primary'"},{name:"literal",value:"'secondary'"},{name:"literal",value:"'destructive'"},{name:"literal",value:"'ghost'"},{name:"literal",value:"'outline'"}]},description:"",defaultValue:{value:"'primary'",computed:!1}},size:{required:!1,tsType:{name:"union",raw:"'sm' | 'md' | 'lg'",elements:[{name:"literal",value:"'sm'"},{name:"literal",value:"'md'"},{name:"literal",value:"'lg'"}]},description:"",defaultValue:{value:"'md'",computed:!1}},icon:{required:!1,tsType:{name:"ReactReactNode",raw:"React.ReactNode"},description:""},iconPosition:{required:!1,tsType:{name:"union",raw:"'left' | 'right'",elements:[{name:"literal",value:"'left'"},{name:"literal",value:"'right'"}]},description:"",defaultValue:{value:"'left'",computed:!1}},loading:{required:!1,tsType:{name:"boolean"},description:"",defaultValue:{value:"false",computed:!1}},children:{required:!0,tsType:{name:"ReactReactNode",raw:"React.ReactNode"},description:""}}};function B({children:r,onSubmit:t,className:i,sectionClassName:d}){return e.jsx("form",{onSubmit:t,className:o("space-y-6",i),children:r})}function v({title:r,description:t,children:i,className:d,contentClassName:c}){return e.jsxs(k.div,{initial:{opacity:0},animate:{opacity:1},transition:{duration:.3},className:o("bg-white border border-gray-200 rounded-sm overflow-hidden",d),children:[(r||t)&&e.jsxs("div",{className:"px-6 py-4 border-b border-gray-200 bg-gray-50/50",children:[r&&e.jsx("h2",{className:"text-base font-semibold text-gray-900",children:r}),t&&e.jsx("p",{className:"text-sm text-muted-foreground mt-1",children:t})]}),e.jsx("div",{className:o("p-6 space-y-6",c),children:i})]})}function y({children:r,columns:t=2,className:i}){const d={1:"grid-cols-1",2:"grid-cols-1 md:grid-cols-2",3:"grid-cols-1 md:grid-cols-3"};return e.jsx("div",{className:o("grid gap-6",d[t],i),children:r})}function n({label:r,required:t=!1,error:i,hint:d,children:c,className:m}){return e.jsxs("div",{className:o("flex flex-col gap-2",m),children:[e.jsxs("label",{className:"text-sm font-medium text-gray-900",children:[r,t&&e.jsx("span",{className:"text-red-600 ml-1",children:"*"})]}),c,i&&e.jsx("p",{className:"text-xs text-red-600",children:i}),d&&e.jsx("p",{className:"text-xs text-muted-foreground",children:d})]})}B.__docgenInfo={description:"",methods:[],displayName:"EnterpriseForm",props:{children:{required:!0,tsType:{name:"ReactReactNode",raw:"React.ReactNode"},description:""},onSubmit:{required:!1,tsType:{name:"signature",type:"function",raw:"(e: React.FormEvent<HTMLFormElement>) => void",signature:{arguments:[{type:{name:"ReactFormEvent",raw:"React.FormEvent<HTMLFormElement>",elements:[{name:"HTMLFormElement"}]},name:"e"}],return:{name:"void"}}},description:""},className:{required:!1,tsType:{name:"string"},description:""},sectionClassName:{required:!1,tsType:{name:"string"},description:""}}};v.__docgenInfo={description:"",methods:[],displayName:"EnterpriseFormSection",props:{title:{required:!1,tsType:{name:"string"},description:""},description:{required:!1,tsType:{name:"string"},description:""},children:{required:!0,tsType:{name:"ReactReactNode",raw:"React.ReactNode"},description:""},className:{required:!1,tsType:{name:"string"},description:""},contentClassName:{required:!1,tsType:{name:"string"},description:""}}};y.__docgenInfo={description:"",methods:[],displayName:"EnterpriseFormRow",props:{children:{required:!0,tsType:{name:"ReactReactNode",raw:"React.ReactNode"},description:""},columns:{required:!1,tsType:{name:"union",raw:"1 | 2 | 3",elements:[{name:"literal",value:"1"},{name:"literal",value:"2"},{name:"literal",value:"3"}]},description:"",defaultValue:{value:"2",computed:!1}},className:{required:!1,tsType:{name:"string"},description:""}}};n.__docgenInfo={description:"",methods:[],displayName:"EnterpriseFormField",props:{label:{required:!0,tsType:{name:"string"},description:""},required:{required:!1,tsType:{name:"boolean"},description:"",defaultValue:{value:"false",computed:!1}},error:{required:!1,tsType:{name:"string"},description:""},hint:{required:!1,tsType:{name:"string"},description:""},children:{required:!0,tsType:{name:"ReactReactNode",raw:"React.ReactNode"},description:""},className:{required:!1,tsType:{name:"string"},description:""}}};const bs={title:"Enterprise/Table",component:F,parameters:{layout:"padded"},tags:["autodocs"]},I=[{id:"1",name:"Acme Corporation",type:"Enterprise",revenue:5e6,status:"Active"},{id:"2",name:"TechFlow Inc",type:"Mid-Market",revenue:12e5,status:"Active"},{id:"3",name:"Global Logistics",type:"Enterprise",revenue:35e5,status:"Inactive"},{id:"4",name:"StartUp Labs",type:"SMB",revenue:25e4,status:"Active"}],D={render:()=>e.jsx(F,{columns:[{key:"name",label:"Account Name",sortable:!0,width:"35%"},{key:"type",label:"Account Type",sortable:!0,width:"20%"},{key:"revenue",label:"Annual Revenue",sortable:!0,width:"25%",render:r=>`$${(r/1e6).toFixed(1)}M`},{key:"status",label:"Status",sortable:!1,width:"20%"}],data:I,rowKey:r=>r.id})},Ta=()=>{const[r,t]=g.useState("name"),[i,d]=g.useState("asc");return e.jsx(F,{columns:[{key:"name",label:"Account Name",sortable:!0,width:"35%"},{key:"type",label:"Account Type",sortable:!0,width:"20%"},{key:"revenue",label:"Annual Revenue",sortable:!0,width:"25%",render:c=>`$${(c/1e6).toFixed(1)}M`},{key:"status",label:"Status",sortable:!1,width:"20%"}],data:I,rowKey:c=>c.id,sortBy:r,sortOrder:i,onSort:(c,m)=>{t(c),d(m)}})},P={render:()=>e.jsx(Ta,{})},L={render:()=>e.jsx(F,{columns:[{key:"name",label:"Account Name",sortable:!0,width:"35%"},{key:"type",label:"Account Type",sortable:!0,width:"20%"},{key:"revenue",label:"Annual Revenue",sortable:!0,width:"25%"},{key:"status",label:"Status",sortable:!1,width:"20%"}],data:[],isLoading:!0})},_={render:()=>e.jsx(F,{columns:[{key:"name",label:"Account Name",sortable:!0},{key:"type",label:"Account Type",sortable:!0},{key:"revenue",label:"Annual Revenue",sortable:!0},{key:"status",label:"Status",sortable:!1}],data:[],emptyState:e.jsxs("div",{className:"text-center",children:[e.jsx("p",{className:"text-sm text-gray-500 mb-2",children:"No accounts found"}),e.jsx("p",{className:"text-xs text-gray-400",children:"Create a new account to get started"})]})})},W={render:()=>e.jsx(F,{columns:[{key:"name",label:"Account Name",sortable:!0},{key:"type",label:"Account Type",sortable:!0},{key:"revenue",label:"Annual Revenue",sortable:!0,render:r=>`$${(r/1e6).toFixed(1)}M`},{key:"status",label:"Status",sortable:!1}],data:I,rowKey:r=>r.id,striped:!0,hover:!0})},O={render:()=>e.jsx(F,{columns:[{key:"name",label:"Account Name",sortable:!0},{key:"type",label:"Account Type",sortable:!0},{key:"revenue",label:"Annual Revenue",sortable:!0,render:r=>`$${(r/1e6).toFixed(1)}M`},{key:"status",label:"Status",sortable:!1}],data:I,rowKey:r=>r.id,striped:!1,hover:!1})},qa=()=>{const[r,t]=g.useState(null);return e.jsxs("div",{className:"space-y-4",children:[e.jsx(F,{columns:[{key:"name",label:"Account Name",sortable:!0},{key:"type",label:"Account Type",sortable:!0},{key:"revenue",label:"Annual Revenue",sortable:!0,render:i=>`$${(i/1e6).toFixed(1)}M`},{key:"status",label:"Status",sortable:!1}],data:I,rowKey:i=>i.id,onRowClick:i=>t(i)}),r&&e.jsx("div",{className:"p-4 border border-gray-200 rounded-lg bg-blue-50",children:e.jsxs("p",{className:"text-sm font-medium",children:["Selected: ",r.name]})})]})},H={render:()=>e.jsx(qa,{})},z={render:()=>e.jsx(C,{variant:"default",children:e.jsx("p",{className:"text-sm text-gray-600",children:"This is a default card with simple content and a subtle shadow."})})},V={render:()=>e.jsx(C,{title:"Account Overview",description:"Key metrics and status",icon:e.jsx(A,{className:"w-5 h-5"}),variant:"default",children:e.jsx("p",{className:"text-sm text-gray-600",children:"Display important account information and metrics."})})},$={render:()=>e.jsx(C,{title:"Quick Actions",description:"Common operations",actions:e.jsxs("div",{className:"flex gap-2",children:[e.jsx("button",{className:"p-1 hover:bg-gray-200 rounded",children:e.jsx(Sa,{className:"w-4 h-4 text-gray-600"})}),e.jsx("button",{className:"p-1 hover:bg-gray-200 rounded",children:e.jsx(Fa,{className:"w-4 h-4 text-gray-600"})})]}),variant:"default",children:e.jsx("p",{className:"text-sm text-gray-600",children:"Card with action buttons in the header."})})},K={render:()=>e.jsx(C,{title:"Status Report",description:"Current status",variant:"default",footer:e.jsx("div",{className:"text-xs text-gray-500",children:"Last updated: 2 hours ago"}),children:e.jsx("div",{className:"space-y-2",children:e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx(la,{className:"w-4 h-4 text-green-600"}),e.jsx("span",{className:"text-sm",children:"All systems operational"})]})})})},G={render:()=>e.jsx(C,{title:"Outlined Card",description:"Minimal styling",variant:"outlined",children:e.jsx("p",{className:"text-sm text-gray-600",children:"This is an outlined card with minimal styling."})})},Y={render:()=>e.jsx(C,{title:"Elevated Card",description:"Enhanced shadow",variant:"elevated",children:e.jsx("p",{className:"text-sm text-gray-600",children:"This card has an elevated appearance with a stronger shadow."})})},Ba=()=>{const[r,t]=g.useState(!1);return e.jsxs(C,{title:"Clickable Card",clickable:!0,onClick:()=>t(!r),className:r?"border-blue-500":"",children:[e.jsx("p",{className:"text-sm text-gray-600",children:"Click this card to interact with it"}),r&&e.jsx("p",{className:"text-xs text-blue-600 mt-3",children:"Card was clicked!"})]})},Z={render:()=>e.jsx(Ba,{})},U={render:()=>e.jsx(q,{title:"Acme Corporation",icon:e.jsx(A,{className:"w-6 h-6 text-gray-600"}),variant:"default"})},J={render:()=>e.jsx(q,{title:"Account Details",subtitle:"Acme Corporation",description:"Enterprise account with full service package",icon:e.jsx(A,{className:"w-6 h-6 text-gray-600"}),variant:"default"})},Q={render:()=>e.jsx(q,{title:"Account Status",subtitle:"Acme Corporation",icon:e.jsx(A,{className:"w-6 h-6 text-gray-600"}),status:e.jsxs("div",{className:"flex items-center gap-2 px-3 py-1 bg-green-50 border border-green-200 rounded-full",children:[e.jsx(la,{className:"w-4 h-4 text-green-600"}),e.jsx("span",{className:"text-xs font-medium text-green-700",children:"Active"})]}),variant:"default"})},X={render:()=>e.jsx(q,{title:"Account Dashboard",subtitle:"Acme Corporation",icon:e.jsx(A,{className:"w-6 h-6 text-gray-600"}),actions:e.jsxs("div",{className:"flex gap-2",children:[e.jsx("button",{className:"px-3 py-2 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50",children:"Edit"}),e.jsx("button",{className:"px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700",children:"Save"})]}),variant:"default"})},ee={render:()=>e.jsx(q,{title:"Compact Header",subtitle:"Sub heading",variant:"compact"})},re={render:()=>e.jsx(q,{title:"Large Header",subtitle:"Sub heading",description:"With full description and plenty of space",variant:"large"})},te={render:()=>e.jsx(s,{variant:"primary",children:"Primary Button"})},ae={render:()=>e.jsx(s,{variant:"secondary",children:"Secondary Button"})},se={render:()=>e.jsx(s,{variant:"destructive",children:"Delete"})},ne={render:()=>e.jsx(s,{variant:"ghost",children:"Ghost Button"})},ie={render:()=>e.jsx(s,{variant:"outline",children:"Outline Button"})},le={render:()=>e.jsx(s,{variant:"primary",size:"sm",children:"Small Button"})},oe={render:()=>e.jsx(s,{variant:"primary",size:"md",children:"Medium Button"})},de={render:()=>e.jsx(s,{variant:"primary",size:"lg",children:"Large Button"})},ce={render:()=>e.jsx(s,{variant:"primary",icon:e.jsx(oa,{className:"w-4 h-4"}),iconPosition:"left",children:"Add New"})},me={render:()=>e.jsx(s,{variant:"primary",icon:e.jsx(oa,{className:"w-4 h-4"}),iconPosition:"right",children:"Add New"})},ue={render:()=>e.jsx(s,{variant:"primary",loading:!0,children:"Processing"})},pe={render:()=>e.jsx(s,{variant:"primary",disabled:!0,children:"Disabled"})},xe={render:()=>e.jsxs("div",{className:"flex flex-wrap gap-3",children:[e.jsx(s,{variant:"primary",children:"Primary"}),e.jsx(s,{variant:"secondary",children:"Secondary"}),e.jsx(s,{variant:"destructive",children:"Destructive"}),e.jsx(s,{variant:"ghost",children:"Ghost"}),e.jsx(s,{variant:"outline",children:"Outline"})]})},he={render:()=>e.jsxs("div",{className:"flex flex-wrap gap-3 items-center",children:[e.jsx(s,{variant:"primary",size:"sm",children:"Small"}),e.jsx(s,{variant:"primary",size:"md",children:"Medium"}),e.jsx(s,{variant:"primary",size:"lg",children:"Large"})]})},Ra=()=>{const[r,t]=g.useState(!0);return e.jsxs(e.Fragment,{children:[e.jsx(s,{onClick:()=>t(!0),children:"Open Small Modal"}),e.jsx(R,{isOpen:r,onClose:()=>t(!1),title:"Confirm Action",size:"sm",children:e.jsx("p",{className:"text-sm text-gray-600",children:"Are you sure you want to proceed with this action?"})})]})},ye={render:()=>e.jsx(Ra,{})},ka=()=>{const[r,t]=g.useState(!0);return e.jsxs(e.Fragment,{children:[e.jsx(s,{onClick:()=>t(!0),children:"Open Medium Modal"}),e.jsx(R,{isOpen:r,onClose:()=>t(!1),title:"Create New Account",description:"Fill in the details below to create a new account",size:"md",children:e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{children:[e.jsx("label",{className:"text-sm font-medium",children:"Account Name"}),e.jsx(a,{placeholder:"Enter account name"})]}),e.jsxs("div",{children:[e.jsx("label",{className:"text-sm font-medium",children:"Type"}),e.jsxs(Ce,{children:[e.jsx(Te,{children:e.jsx(qe,{placeholder:"Select type"})}),e.jsxs(Be,{children:[e.jsx(h,{value:"enterprise",children:"Enterprise"}),e.jsx(h,{value:"mid-market",children:"Mid-Market"}),e.jsx(h,{value:"smb",children:"SMB"})]})]})]})]})})]})},ge={render:()=>e.jsx(ka,{})},Aa=()=>{const[r,t]=g.useState(!0);return e.jsxs(e.Fragment,{children:[e.jsx(s,{onClick:()=>t(!0),children:"Open Large Modal"}),e.jsx(R,{isOpen:r,onClose:()=>t(!1),title:"Account Details",description:"View and edit all account information",size:"lg",children:e.jsx("div",{className:"space-y-6",children:e.jsxs("div",{className:"grid grid-cols-2 gap-4",children:[e.jsxs("div",{children:[e.jsx("label",{className:"text-sm font-medium",children:"Company Name"}),e.jsx(a,{placeholder:"Enter company name"})]}),e.jsxs("div",{children:[e.jsx("label",{className:"text-sm font-medium",children:"Industry"}),e.jsx(a,{placeholder:"Enter industry"})]}),e.jsxs("div",{children:[e.jsx("label",{className:"text-sm font-medium",children:"Email"}),e.jsx(a,{placeholder:"Enter email"})]}),e.jsxs("div",{children:[e.jsx("label",{className:"text-sm font-medium",children:"Phone"}),e.jsx(a,{placeholder:"Enter phone"})]})]})})})]})},be={render:()=>e.jsx(Aa,{})},Ia=()=>{const[r,t]=g.useState(!0);return e.jsxs(e.Fragment,{children:[e.jsx(s,{onClick:()=>t(!0),children:"Open XL Modal"}),e.jsx(R,{isOpen:r,onClose:()=>t(!1),title:"Comprehensive Form",size:"xl",children:e.jsx("div",{className:"space-y-6",children:e.jsxs("div",{className:"grid grid-cols-3 gap-4",children:[e.jsxs("div",{children:[e.jsx("label",{className:"text-sm font-medium",children:"First Name"}),e.jsx(a,{placeholder:"Enter first name"})]}),e.jsxs("div",{children:[e.jsx("label",{className:"text-sm font-medium",children:"Last Name"}),e.jsx(a,{placeholder:"Enter last name"})]}),e.jsxs("div",{children:[e.jsx("label",{className:"text-sm font-medium",children:"Email"}),e.jsx(a,{placeholder:"Enter email"})]}),e.jsxs("div",{children:[e.jsx("label",{className:"text-sm font-medium",children:"Phone"}),e.jsx(a,{placeholder:"Enter phone"})]}),e.jsxs("div",{children:[e.jsx("label",{className:"text-sm font-medium",children:"Company"}),e.jsx(a,{placeholder:"Enter company"})]}),e.jsxs("div",{children:[e.jsx("label",{className:"text-sm font-medium",children:"Position"}),e.jsx(a,{placeholder:"Enter position"})]})]})})})]})},je={render:()=>e.jsx(Ia,{})},Ma=()=>{const[r,t]=g.useState(!0);return e.jsxs(e.Fragment,{children:[e.jsx(s,{onClick:()=>t(!0),children:"Open Modal with Footer"}),e.jsx(R,{isOpen:r,onClose:()=>t(!1),title:"Confirm Changes",description:"Are you sure you want to save these changes?",size:"md",footer:e.jsxs("div",{className:"flex gap-3 justify-end",children:[e.jsx(s,{variant:"outline",onClick:()=>t(!1),children:"Cancel"}),e.jsx(s,{variant:"primary",onClick:()=>t(!1),children:"Save Changes"})]}),children:e.jsx("p",{className:"text-sm text-gray-600",children:"All changes will be saved and cannot be undone."})})]})},fe={render:()=>e.jsx(Ma,{})},ve={render:()=>e.jsxs(B,{className:"max-w-2xl",onSubmit:r=>{r.preventDefault(),alert("Form submitted!")},children:[e.jsxs(v,{title:"Contact Information",description:"Enter your contact details",children:[e.jsx(n,{label:"Full Name",required:!0,children:e.jsx(a,{placeholder:"Enter your full name"})}),e.jsx(n,{label:"Email",required:!0,children:e.jsx(a,{type:"email",placeholder:"Enter your email"})})]}),e.jsxs("div",{className:"flex gap-3 justify-end",children:[e.jsx(s,{variant:"outline",children:"Cancel"}),e.jsx(s,{variant:"primary",type:"submit",children:"Save"})]})]})},Ee={render:()=>e.jsxs(B,{className:"max-w-4xl",children:[e.jsxs(v,{title:"Account Information",description:"Basic details about the account",children:[e.jsxs(y,{columns:2,children:[e.jsx(n,{label:"Account Name",required:!0,children:e.jsx(a,{placeholder:"Enter account name"})}),e.jsx(n,{label:"Account Type",required:!0,children:e.jsxs(Ce,{children:[e.jsx(Te,{children:e.jsx(qe,{placeholder:"Select type"})}),e.jsxs(Be,{children:[e.jsx(h,{value:"enterprise",children:"Enterprise"}),e.jsx(h,{value:"mid-market",children:"Mid-Market"}),e.jsx(h,{value:"smb",children:"SMB"})]})]})})]}),e.jsx(y,{columns:1,children:e.jsx(n,{label:"Description",children:e.jsx(a,{placeholder:"Enter description"})})})]}),e.jsxs("div",{className:"flex gap-3 justify-end",children:[e.jsx(s,{variant:"outline",children:"Cancel"}),e.jsx(s,{variant:"primary",children:"Save"})]})]})},Ne={render:()=>e.jsxs(B,{className:"max-w-4xl",children:[e.jsxs(v,{title:"Contact Details",description:"Contact information for the account",children:[e.jsxs(y,{columns:3,children:[e.jsx(n,{label:"First Name",required:!0,children:e.jsx(a,{placeholder:"Enter first name"})}),e.jsx(n,{label:"Last Name",required:!0,children:e.jsx(a,{placeholder:"Enter last name"})}),e.jsx(n,{label:"Email",required:!0,children:e.jsx(a,{type:"email",placeholder:"Enter email"})})]}),e.jsxs(y,{columns:3,children:[e.jsx(n,{label:"Phone",children:e.jsx(a,{placeholder:"Enter phone"})}),e.jsx(n,{label:"Title",children:e.jsx(a,{placeholder:"Enter title"})}),e.jsx(n,{label:"Department",children:e.jsx(a,{placeholder:"Enter department"})})]})]}),e.jsxs("div",{className:"flex gap-3 justify-end",children:[e.jsx(s,{variant:"outline",children:"Cancel"}),e.jsx(s,{variant:"primary",children:"Save"})]})]})},Fe={render:()=>e.jsxs(B,{className:"max-w-4xl",children:[e.jsx(v,{title:"Company Information",description:"Details about your company",children:e.jsxs(y,{columns:2,children:[e.jsx(n,{label:"Company Name",required:!0,children:e.jsx(a,{placeholder:"Enter company name"})}),e.jsx(n,{label:"Industry",required:!0,children:e.jsx(a,{placeholder:"Enter industry"})})]})}),e.jsx(v,{title:"Contact Information",description:"Primary contact details",children:e.jsxs(y,{columns:2,children:[e.jsx(n,{label:"Email",required:!0,children:e.jsx(a,{type:"email",placeholder:"Enter email"})}),e.jsx(n,{label:"Phone",required:!0,children:e.jsx(a,{placeholder:"Enter phone"})})]})}),e.jsxs(v,{title:"Address",description:"Company location",children:[e.jsx(y,{columns:1,children:e.jsx(n,{label:"Street Address",required:!0,children:e.jsx(a,{placeholder:"Enter street address"})})}),e.jsxs(y,{columns:3,children:[e.jsx(n,{label:"City",required:!0,children:e.jsx(a,{placeholder:"Enter city"})}),e.jsx(n,{label:"State",required:!0,children:e.jsx(a,{placeholder:"Enter state"})}),e.jsx(n,{label:"ZIP Code",required:!0,children:e.jsx(a,{placeholder:"Enter ZIP code"})})]})]}),e.jsxs("div",{className:"flex gap-3 justify-end",children:[e.jsx(s,{variant:"outline",children:"Cancel"}),e.jsx(s,{variant:"primary",children:"Save Changes"})]})]})},Da=()=>{const[r,t]=g.useState({}),i=d=>{d.preventDefault(),t({email:"This email is already in use",phone:"Invalid phone number format"})};return e.jsxs(B,{className:"max-w-2xl",onSubmit:i,children:[e.jsxs(v,{title:"Account Details",children:[e.jsx(n,{label:"Email",required:!0,error:r.email,children:e.jsx(a,{type:"email",placeholder:"Enter email",className:r.email?"border-red-500":""})}),e.jsx(n,{label:"Phone",required:!0,error:r.phone,children:e.jsx(a,{placeholder:"Enter phone",className:r.phone?"border-red-500":""})}),e.jsx(n,{label:"Company Website",hint:"Optional - include https://",children:e.jsx(a,{placeholder:"https://example.com"})})]}),e.jsxs("div",{className:"flex gap-3 justify-end",children:[e.jsx(s,{variant:"outline",children:"Cancel"}),e.jsx(s,{variant:"primary",type:"submit",children:"Submit"})]})]})},Se={render:()=>e.jsx(Da,{})},we={render:()=>e.jsxs(B,{className:"max-w-4xl",children:[e.jsxs(v,{title:"Personal Information",description:"Tell us about yourself",children:[e.jsxs(y,{columns:2,children:[e.jsx(n,{label:"First Name",required:!0,children:e.jsx(a,{placeholder:"John"})}),e.jsx(n,{label:"Last Name",required:!0,children:e.jsx(a,{placeholder:"Doe"})})]}),e.jsx(n,{label:"Email",required:!0,hint:"We'll use this to contact you",children:e.jsx(a,{type:"email",placeholder:"john@example.com"})})]}),e.jsxs(v,{title:"Professional Details",description:"Information about your role",children:[e.jsxs(y,{columns:3,children:[e.jsx(n,{label:"Company",required:!0,children:e.jsx(a,{placeholder:"Your Company"})}),e.jsx(n,{label:"Position",required:!0,children:e.jsx(a,{placeholder:"Your Position"})}),e.jsx(n,{label:"Phone",children:e.jsx(a,{placeholder:"(555) 123-4567"})})]}),e.jsxs(y,{columns:2,children:[e.jsx(n,{label:"Industry",required:!0,children:e.jsxs(Ce,{children:[e.jsx(Te,{children:e.jsx(qe,{placeholder:"Select industry"})}),e.jsxs(Be,{children:[e.jsx(h,{value:"tech",children:"Technology"}),e.jsx(h,{value:"finance",children:"Finance"}),e.jsx(h,{value:"healthcare",children:"Healthcare"}),e.jsx(h,{value:"other",children:"Other"})]})]})}),e.jsx(n,{label:"Company Size",children:e.jsxs(Ce,{children:[e.jsx(Te,{children:e.jsx(qe,{placeholder:"Select size"})}),e.jsxs(Be,{children:[e.jsx(h,{value:"1-10",children:"1-10 employees"}),e.jsx(h,{value:"11-50",children:"11-50 employees"}),e.jsx(h,{value:"51-200",children:"51-200 employees"}),e.jsx(h,{value:"200+",children:"200+ employees"})]})]})})]})]}),e.jsxs(v,{title:"Address",description:"Your location information",children:[e.jsx(y,{columns:1,children:e.jsx(n,{label:"Street Address",required:!0,children:e.jsx(a,{placeholder:"123 Main St"})})}),e.jsxs(y,{columns:3,children:[e.jsx(n,{label:"City",required:!0,children:e.jsx(a,{placeholder:"San Francisco"})}),e.jsx(n,{label:"State/Province",required:!0,children:e.jsx(a,{placeholder:"California"})}),e.jsx(n,{label:"ZIP Code",required:!0,children:e.jsx(a,{placeholder:"94102"})})]})]}),e.jsxs("div",{className:"flex gap-3 justify-end pt-4",children:[e.jsx(s,{variant:"outline",children:"Cancel"}),e.jsx(s,{variant:"primary",type:"submit",children:"Create Account"})]})]})};var Ie,Me,De;D.parameters={...D.parameters,docs:{...(Ie=D.parameters)==null?void 0:Ie.docs,source:{originalSource:`{
  render: () => <EnterpriseTable columns={[{
    key: 'name',
    label: 'Account Name',
    sortable: true,
    width: '35%'
  }, {
    key: 'type',
    label: 'Account Type',
    sortable: true,
    width: '20%'
  }, {
    key: 'revenue',
    label: 'Annual Revenue',
    sortable: true,
    width: '25%',
    render: value => \`$\${(value / 1000000).toFixed(1)}M\`
  }, {
    key: 'status',
    label: 'Status',
    sortable: false,
    width: '20%'
  }]} data={mockAccounts} rowKey={row => row.id} />
}`,...(De=(Me=D.parameters)==null?void 0:Me.docs)==null?void 0:De.source}}};var Pe,Le,_e;P.parameters={...P.parameters,docs:{...(Pe=P.parameters)==null?void 0:Pe.docs,source:{originalSource:`{
  render: () => <TableWithSortingComponent />
}`,...(_e=(Le=P.parameters)==null?void 0:Le.docs)==null?void 0:_e.source}}};var We,Oe,He;L.parameters={...L.parameters,docs:{...(We=L.parameters)==null?void 0:We.docs,source:{originalSource:`{
  render: () => <EnterpriseTable columns={[{
    key: 'name',
    label: 'Account Name',
    sortable: true,
    width: '35%'
  }, {
    key: 'type',
    label: 'Account Type',
    sortable: true,
    width: '20%'
  }, {
    key: 'revenue',
    label: 'Annual Revenue',
    sortable: true,
    width: '25%'
  }, {
    key: 'status',
    label: 'Status',
    sortable: false,
    width: '20%'
  }]} data={[]} isLoading={true} />
}`,...(He=(Oe=L.parameters)==null?void 0:Oe.docs)==null?void 0:He.source}}};var ze,Ve,$e;_.parameters={..._.parameters,docs:{...(ze=_.parameters)==null?void 0:ze.docs,source:{originalSource:`{
  render: () => <EnterpriseTable columns={[{
    key: 'name',
    label: 'Account Name',
    sortable: true
  }, {
    key: 'type',
    label: 'Account Type',
    sortable: true
  }, {
    key: 'revenue',
    label: 'Annual Revenue',
    sortable: true
  }, {
    key: 'status',
    label: 'Status',
    sortable: false
  }]} data={[]} emptyState={<div className="text-center">
          <p className="text-sm text-gray-500 mb-2">No accounts found</p>
          <p className="text-xs text-gray-400">Create a new account to get started</p>
        </div>} />
}`,...($e=(Ve=_.parameters)==null?void 0:Ve.docs)==null?void 0:$e.source}}};var Ke,Ge,Ye;W.parameters={...W.parameters,docs:{...(Ke=W.parameters)==null?void 0:Ke.docs,source:{originalSource:`{
  render: () => <EnterpriseTable columns={[{
    key: 'name',
    label: 'Account Name',
    sortable: true
  }, {
    key: 'type',
    label: 'Account Type',
    sortable: true
  }, {
    key: 'revenue',
    label: 'Annual Revenue',
    sortable: true,
    render: value => \`$\${(value / 1000000).toFixed(1)}M\`
  }, {
    key: 'status',
    label: 'Status',
    sortable: false
  }]} data={mockAccounts} rowKey={row => row.id} striped={true} hover={true} />
}`,...(Ye=(Ge=W.parameters)==null?void 0:Ge.docs)==null?void 0:Ye.source}}};var Ze,Ue,Je;O.parameters={...O.parameters,docs:{...(Ze=O.parameters)==null?void 0:Ze.docs,source:{originalSource:`{
  render: () => <EnterpriseTable columns={[{
    key: 'name',
    label: 'Account Name',
    sortable: true
  }, {
    key: 'type',
    label: 'Account Type',
    sortable: true
  }, {
    key: 'revenue',
    label: 'Annual Revenue',
    sortable: true,
    render: value => \`$\${(value / 1000000).toFixed(1)}M\`
  }, {
    key: 'status',
    label: 'Status',
    sortable: false
  }]} data={mockAccounts} rowKey={row => row.id} striped={false} hover={false} />
}`,...(Je=(Ue=O.parameters)==null?void 0:Ue.docs)==null?void 0:Je.source}}};var Qe,Xe,er;H.parameters={...H.parameters,docs:{...(Qe=H.parameters)==null?void 0:Qe.docs,source:{originalSource:`{
  render: () => <TableWithRowClickComponent />
}`,...(er=(Xe=H.parameters)==null?void 0:Xe.docs)==null?void 0:er.source}}};var rr,tr,ar;z.parameters={...z.parameters,docs:{...(rr=z.parameters)==null?void 0:rr.docs,source:{originalSource:`{
  render: () => <EnterpriseCard variant="default">
      <p className="text-sm text-gray-600">
        This is a default card with simple content and a subtle shadow.
      </p>
    </EnterpriseCard>
}`,...(ar=(tr=z.parameters)==null?void 0:tr.docs)==null?void 0:ar.source}}};var sr,nr,ir;V.parameters={...V.parameters,docs:{...(sr=V.parameters)==null?void 0:sr.docs,source:{originalSource:`{
  render: () => <EnterpriseCard title="Account Overview" description="Key metrics and status" icon={<Settings className="w-5 h-5" />} variant="default">
      <p className="text-sm text-gray-600">
        Display important account information and metrics.
      </p>
    </EnterpriseCard>
}`,...(ir=(nr=V.parameters)==null?void 0:nr.docs)==null?void 0:ir.source}}};var lr,or,dr;$.parameters={...$.parameters,docs:{...(lr=$.parameters)==null?void 0:lr.docs,source:{originalSource:`{
  render: () => <EnterpriseCard title="Quick Actions" description="Common operations" actions={<div className="flex gap-2">
          <button className="p-1 hover:bg-gray-200 rounded">
            <Edit2 className="w-4 h-4 text-gray-600" />
          </button>
          <button className="p-1 hover:bg-gray-200 rounded">
            <Trash2 className="w-4 h-4 text-gray-600" />
          </button>
        </div>} variant="default">
      <p className="text-sm text-gray-600">
        Card with action buttons in the header.
      </p>
    </EnterpriseCard>
}`,...(dr=(or=$.parameters)==null?void 0:or.docs)==null?void 0:dr.source}}};var cr,mr,ur;K.parameters={...K.parameters,docs:{...(cr=K.parameters)==null?void 0:cr.docs,source:{originalSource:`{
  render: () => <EnterpriseCard title="Status Report" description="Current status" variant="default" footer={<div className="text-xs text-gray-500">
          Last updated: 2 hours ago
        </div>}>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <span className="text-sm">All systems operational</span>
        </div>
      </div>
    </EnterpriseCard>
}`,...(ur=(mr=K.parameters)==null?void 0:mr.docs)==null?void 0:ur.source}}};var pr,xr,hr;G.parameters={...G.parameters,docs:{...(pr=G.parameters)==null?void 0:pr.docs,source:{originalSource:`{
  render: () => <EnterpriseCard title="Outlined Card" description="Minimal styling" variant="outlined">
      <p className="text-sm text-gray-600">
        This is an outlined card with minimal styling.
      </p>
    </EnterpriseCard>
}`,...(hr=(xr=G.parameters)==null?void 0:xr.docs)==null?void 0:hr.source}}};var yr,gr,br;Y.parameters={...Y.parameters,docs:{...(yr=Y.parameters)==null?void 0:yr.docs,source:{originalSource:`{
  render: () => <EnterpriseCard title="Elevated Card" description="Enhanced shadow" variant="elevated">
      <p className="text-sm text-gray-600">
        This card has an elevated appearance with a stronger shadow.
      </p>
    </EnterpriseCard>
}`,...(br=(gr=Y.parameters)==null?void 0:gr.docs)==null?void 0:br.source}}};var jr,fr,vr;Z.parameters={...Z.parameters,docs:{...(jr=Z.parameters)==null?void 0:jr.docs,source:{originalSource:`{
  render: () => <CardClickableComponent />
}`,...(vr=(fr=Z.parameters)==null?void 0:fr.docs)==null?void 0:vr.source}}};var Er,Nr,Fr;U.parameters={...U.parameters,docs:{...(Er=U.parameters)==null?void 0:Er.docs,source:{originalSource:`{
  render: () => <EnterpriseHeader title="Acme Corporation" icon={<Settings className="w-6 h-6 text-gray-600" />} variant="default" />
}`,...(Fr=(Nr=U.parameters)==null?void 0:Nr.docs)==null?void 0:Fr.source}}};var Sr,wr,Cr;J.parameters={...J.parameters,docs:{...(Sr=J.parameters)==null?void 0:Sr.docs,source:{originalSource:`{
  render: () => <EnterpriseHeader title="Account Details" subtitle="Acme Corporation" description="Enterprise account with full service package" icon={<Settings className="w-6 h-6 text-gray-600" />} variant="default" />
}`,...(Cr=(wr=J.parameters)==null?void 0:wr.docs)==null?void 0:Cr.source}}};var Tr,qr,Br;Q.parameters={...Q.parameters,docs:{...(Tr=Q.parameters)==null?void 0:Tr.docs,source:{originalSource:`{
  render: () => <EnterpriseHeader title="Account Status" subtitle="Acme Corporation" icon={<Settings className="w-6 h-6 text-gray-600" />} status={<div className="flex items-center gap-2 px-3 py-1 bg-green-50 border border-green-200 rounded-full">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <span className="text-xs font-medium text-green-700">Active</span>
        </div>} variant="default" />
}`,...(Br=(qr=Q.parameters)==null?void 0:qr.docs)==null?void 0:Br.source}}};var Rr,kr,Ar;X.parameters={...X.parameters,docs:{...(Rr=X.parameters)==null?void 0:Rr.docs,source:{originalSource:`{
  render: () => <EnterpriseHeader title="Account Dashboard" subtitle="Acme Corporation" icon={<Settings className="w-6 h-6 text-gray-600" />} actions={<div className="flex gap-2">
          <button className="px-3 py-2 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50">
            Edit
          </button>
          <button className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
            Save
          </button>
        </div>} variant="default" />
}`,...(Ar=(kr=X.parameters)==null?void 0:kr.docs)==null?void 0:Ar.source}}};var Ir,Mr,Dr;ee.parameters={...ee.parameters,docs:{...(Ir=ee.parameters)==null?void 0:Ir.docs,source:{originalSource:`{
  render: () => <EnterpriseHeader title="Compact Header" subtitle="Sub heading" variant="compact" />
}`,...(Dr=(Mr=ee.parameters)==null?void 0:Mr.docs)==null?void 0:Dr.source}}};var Pr,Lr,_r;re.parameters={...re.parameters,docs:{...(Pr=re.parameters)==null?void 0:Pr.docs,source:{originalSource:`{
  render: () => <EnterpriseHeader title="Large Header" subtitle="Sub heading" description="With full description and plenty of space" variant="large" />
}`,...(_r=(Lr=re.parameters)==null?void 0:Lr.docs)==null?void 0:_r.source}}};var Wr,Or,Hr;te.parameters={...te.parameters,docs:{...(Wr=te.parameters)==null?void 0:Wr.docs,source:{originalSource:`{
  render: () => <EnterpriseButton variant="primary">Primary Button</EnterpriseButton>
}`,...(Hr=(Or=te.parameters)==null?void 0:Or.docs)==null?void 0:Hr.source}}};var zr,Vr,$r;ae.parameters={...ae.parameters,docs:{...(zr=ae.parameters)==null?void 0:zr.docs,source:{originalSource:`{
  render: () => <EnterpriseButton variant="secondary">Secondary Button</EnterpriseButton>
}`,...($r=(Vr=ae.parameters)==null?void 0:Vr.docs)==null?void 0:$r.source}}};var Kr,Gr,Yr;se.parameters={...se.parameters,docs:{...(Kr=se.parameters)==null?void 0:Kr.docs,source:{originalSource:`{
  render: () => <EnterpriseButton variant="destructive">Delete</EnterpriseButton>
}`,...(Yr=(Gr=se.parameters)==null?void 0:Gr.docs)==null?void 0:Yr.source}}};var Zr,Ur,Jr;ne.parameters={...ne.parameters,docs:{...(Zr=ne.parameters)==null?void 0:Zr.docs,source:{originalSource:`{
  render: () => <EnterpriseButton variant="ghost">Ghost Button</EnterpriseButton>
}`,...(Jr=(Ur=ne.parameters)==null?void 0:Ur.docs)==null?void 0:Jr.source}}};var Qr,Xr,et;ie.parameters={...ie.parameters,docs:{...(Qr=ie.parameters)==null?void 0:Qr.docs,source:{originalSource:`{
  render: () => <EnterpriseButton variant="outline">Outline Button</EnterpriseButton>
}`,...(et=(Xr=ie.parameters)==null?void 0:Xr.docs)==null?void 0:et.source}}};var rt,tt,at;le.parameters={...le.parameters,docs:{...(rt=le.parameters)==null?void 0:rt.docs,source:{originalSource:`{
  render: () => <EnterpriseButton variant="primary" size="sm">
      Small Button
    </EnterpriseButton>
}`,...(at=(tt=le.parameters)==null?void 0:tt.docs)==null?void 0:at.source}}};var st,nt,it;oe.parameters={...oe.parameters,docs:{...(st=oe.parameters)==null?void 0:st.docs,source:{originalSource:`{
  render: () => <EnterpriseButton variant="primary" size="md">
      Medium Button
    </EnterpriseButton>
}`,...(it=(nt=oe.parameters)==null?void 0:nt.docs)==null?void 0:it.source}}};var lt,ot,dt;de.parameters={...de.parameters,docs:{...(lt=de.parameters)==null?void 0:lt.docs,source:{originalSource:`{
  render: () => <EnterpriseButton variant="primary" size="lg">
      Large Button
    </EnterpriseButton>
}`,...(dt=(ot=de.parameters)==null?void 0:ot.docs)==null?void 0:dt.source}}};var ct,mt,ut;ce.parameters={...ce.parameters,docs:{...(ct=ce.parameters)==null?void 0:ct.docs,source:{originalSource:`{
  render: () => <EnterpriseButton variant="primary" icon={<Plus className="w-4 h-4" />} iconPosition="left">
      Add New
    </EnterpriseButton>
}`,...(ut=(mt=ce.parameters)==null?void 0:mt.docs)==null?void 0:ut.source}}};var pt,xt,ht;me.parameters={...me.parameters,docs:{...(pt=me.parameters)==null?void 0:pt.docs,source:{originalSource:`{
  render: () => <EnterpriseButton variant="primary" icon={<Plus className="w-4 h-4" />} iconPosition="right">
      Add New
    </EnterpriseButton>
}`,...(ht=(xt=me.parameters)==null?void 0:xt.docs)==null?void 0:ht.source}}};var yt,gt,bt;ue.parameters={...ue.parameters,docs:{...(yt=ue.parameters)==null?void 0:yt.docs,source:{originalSource:`{
  render: () => <EnterpriseButton variant="primary" loading={true}>
      Processing
    </EnterpriseButton>
}`,...(bt=(gt=ue.parameters)==null?void 0:gt.docs)==null?void 0:bt.source}}};var jt,ft,vt;pe.parameters={...pe.parameters,docs:{...(jt=pe.parameters)==null?void 0:jt.docs,source:{originalSource:`{
  render: () => <EnterpriseButton variant="primary" disabled={true}>
      Disabled
    </EnterpriseButton>
}`,...(vt=(ft=pe.parameters)==null?void 0:ft.docs)==null?void 0:vt.source}}};var Et,Nt,Ft;xe.parameters={...xe.parameters,docs:{...(Et=xe.parameters)==null?void 0:Et.docs,source:{originalSource:`{
  render: () => <div className="flex flex-wrap gap-3">
      <EnterpriseButton variant="primary">Primary</EnterpriseButton>
      <EnterpriseButton variant="secondary">Secondary</EnterpriseButton>
      <EnterpriseButton variant="destructive">Destructive</EnterpriseButton>
      <EnterpriseButton variant="ghost">Ghost</EnterpriseButton>
      <EnterpriseButton variant="outline">Outline</EnterpriseButton>
    </div>
}`,...(Ft=(Nt=xe.parameters)==null?void 0:Nt.docs)==null?void 0:Ft.source}}};var St,wt,Ct;he.parameters={...he.parameters,docs:{...(St=he.parameters)==null?void 0:St.docs,source:{originalSource:`{
  render: () => <div className="flex flex-wrap gap-3 items-center">
      <EnterpriseButton variant="primary" size="sm">
        Small
      </EnterpriseButton>
      <EnterpriseButton variant="primary" size="md">
        Medium
      </EnterpriseButton>
      <EnterpriseButton variant="primary" size="lg">
        Large
      </EnterpriseButton>
    </div>
}`,...(Ct=(wt=he.parameters)==null?void 0:wt.docs)==null?void 0:Ct.source}}};var Tt,qt,Bt;ye.parameters={...ye.parameters,docs:{...(Tt=ye.parameters)==null?void 0:Tt.docs,source:{originalSource:`{
  render: () => <ModalSmallComponent />
}`,...(Bt=(qt=ye.parameters)==null?void 0:qt.docs)==null?void 0:Bt.source}}};var Rt,kt,At;ge.parameters={...ge.parameters,docs:{...(Rt=ge.parameters)==null?void 0:Rt.docs,source:{originalSource:`{
  render: () => <ModalMediumComponent />
}`,...(At=(kt=ge.parameters)==null?void 0:kt.docs)==null?void 0:At.source}}};var It,Mt,Dt;be.parameters={...be.parameters,docs:{...(It=be.parameters)==null?void 0:It.docs,source:{originalSource:`{
  render: () => <ModalLargeComponent />
}`,...(Dt=(Mt=be.parameters)==null?void 0:Mt.docs)==null?void 0:Dt.source}}};var Pt,Lt,_t;je.parameters={...je.parameters,docs:{...(Pt=je.parameters)==null?void 0:Pt.docs,source:{originalSource:`{
  render: () => <ModalExtraLargeComponent />
}`,...(_t=(Lt=je.parameters)==null?void 0:Lt.docs)==null?void 0:_t.source}}};var Wt,Ot,Ht;fe.parameters={...fe.parameters,docs:{...(Wt=fe.parameters)==null?void 0:Wt.docs,source:{originalSource:`{
  render: () => <ModalWithFooterComponent />
}`,...(Ht=(Ot=fe.parameters)==null?void 0:Ot.docs)==null?void 0:Ht.source}}};var zt,Vt,$t;ve.parameters={...ve.parameters,docs:{...(zt=ve.parameters)==null?void 0:zt.docs,source:{originalSource:`{
  render: () => <EnterpriseForm className="max-w-2xl" onSubmit={e => {
    e.preventDefault();
    alert('Form submitted!');
  }}>
      <EnterpriseFormSection title="Contact Information" description="Enter your contact details">
        <EnterpriseFormField label="Full Name" required>
          <Input placeholder="Enter your full name" />
        </EnterpriseFormField>
        <EnterpriseFormField label="Email" required>
          <Input type="email" placeholder="Enter your email" />
        </EnterpriseFormField>
      </EnterpriseFormSection>

      <div className="flex gap-3 justify-end">
        <EnterpriseButton variant="outline">Cancel</EnterpriseButton>
        <EnterpriseButton variant="primary" type="submit">
          Save
        </EnterpriseButton>
      </div>
    </EnterpriseForm>
}`,...($t=(Vt=ve.parameters)==null?void 0:Vt.docs)==null?void 0:$t.source}}};var Kt,Gt,Yt;Ee.parameters={...Ee.parameters,docs:{...(Kt=Ee.parameters)==null?void 0:Kt.docs,source:{originalSource:`{
  render: () => <EnterpriseForm className="max-w-4xl">
      <EnterpriseFormSection title="Account Information" description="Basic details about the account">
        <EnterpriseFormRow columns={2}>
          <EnterpriseFormField label="Account Name" required>
            <Input placeholder="Enter account name" />
          </EnterpriseFormField>
          <EnterpriseFormField label="Account Type" required>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="enterprise">Enterprise</SelectItem>
                <SelectItem value="mid-market">Mid-Market</SelectItem>
                <SelectItem value="smb">SMB</SelectItem>
              </SelectContent>
            </Select>
          </EnterpriseFormField>
        </EnterpriseFormRow>

        <EnterpriseFormRow columns={1}>
          <EnterpriseFormField label="Description">
            <Input placeholder="Enter description" />
          </EnterpriseFormField>
        </EnterpriseFormRow>
      </EnterpriseFormSection>

      <div className="flex gap-3 justify-end">
        <EnterpriseButton variant="outline">Cancel</EnterpriseButton>
        <EnterpriseButton variant="primary">Save</EnterpriseButton>
      </div>
    </EnterpriseForm>
}`,...(Yt=(Gt=Ee.parameters)==null?void 0:Gt.docs)==null?void 0:Yt.source}}};var Zt,Ut,Jt;Ne.parameters={...Ne.parameters,docs:{...(Zt=Ne.parameters)==null?void 0:Zt.docs,source:{originalSource:`{
  render: () => <EnterpriseForm className="max-w-4xl">
      <EnterpriseFormSection title="Contact Details" description="Contact information for the account">
        <EnterpriseFormRow columns={3}>
          <EnterpriseFormField label="First Name" required>
            <Input placeholder="Enter first name" />
          </EnterpriseFormField>
          <EnterpriseFormField label="Last Name" required>
            <Input placeholder="Enter last name" />
          </EnterpriseFormField>
          <EnterpriseFormField label="Email" required>
            <Input type="email" placeholder="Enter email" />
          </EnterpriseFormField>
        </EnterpriseFormRow>

        <EnterpriseFormRow columns={3}>
          <EnterpriseFormField label="Phone">
            <Input placeholder="Enter phone" />
          </EnterpriseFormField>
          <EnterpriseFormField label="Title">
            <Input placeholder="Enter title" />
          </EnterpriseFormField>
          <EnterpriseFormField label="Department">
            <Input placeholder="Enter department" />
          </EnterpriseFormField>
        </EnterpriseFormRow>
      </EnterpriseFormSection>

      <div className="flex gap-3 justify-end">
        <EnterpriseButton variant="outline">Cancel</EnterpriseButton>
        <EnterpriseButton variant="primary">Save</EnterpriseButton>
      </div>
    </EnterpriseForm>
}`,...(Jt=(Ut=Ne.parameters)==null?void 0:Ut.docs)==null?void 0:Jt.source}}};var Qt,Xt,ea;Fe.parameters={...Fe.parameters,docs:{...(Qt=Fe.parameters)==null?void 0:Qt.docs,source:{originalSource:`{
  render: () => <EnterpriseForm className="max-w-4xl">
      <EnterpriseFormSection title="Company Information" description="Details about your company">
        <EnterpriseFormRow columns={2}>
          <EnterpriseFormField label="Company Name" required>
            <Input placeholder="Enter company name" />
          </EnterpriseFormField>
          <EnterpriseFormField label="Industry" required>
            <Input placeholder="Enter industry" />
          </EnterpriseFormField>
        </EnterpriseFormRow>
      </EnterpriseFormSection>

      <EnterpriseFormSection title="Contact Information" description="Primary contact details">
        <EnterpriseFormRow columns={2}>
          <EnterpriseFormField label="Email" required>
            <Input type="email" placeholder="Enter email" />
          </EnterpriseFormField>
          <EnterpriseFormField label="Phone" required>
            <Input placeholder="Enter phone" />
          </EnterpriseFormField>
        </EnterpriseFormRow>
      </EnterpriseFormSection>

      <EnterpriseFormSection title="Address" description="Company location">
        <EnterpriseFormRow columns={1}>
          <EnterpriseFormField label="Street Address" required>
            <Input placeholder="Enter street address" />
          </EnterpriseFormField>
        </EnterpriseFormRow>

        <EnterpriseFormRow columns={3}>
          <EnterpriseFormField label="City" required>
            <Input placeholder="Enter city" />
          </EnterpriseFormField>
          <EnterpriseFormField label="State" required>
            <Input placeholder="Enter state" />
          </EnterpriseFormField>
          <EnterpriseFormField label="ZIP Code" required>
            <Input placeholder="Enter ZIP code" />
          </EnterpriseFormField>
        </EnterpriseFormRow>
      </EnterpriseFormSection>

      <div className="flex gap-3 justify-end">
        <EnterpriseButton variant="outline">Cancel</EnterpriseButton>
        <EnterpriseButton variant="primary">Save Changes</EnterpriseButton>
      </div>
    </EnterpriseForm>
}`,...(ea=(Xt=Fe.parameters)==null?void 0:Xt.docs)==null?void 0:ea.source}}};var ra,ta,aa;Se.parameters={...Se.parameters,docs:{...(ra=Se.parameters)==null?void 0:ra.docs,source:{originalSource:`{
  render: () => <FormWithValidationComponent />
}`,...(aa=(ta=Se.parameters)==null?void 0:ta.docs)==null?void 0:aa.source}}};var sa,na,ia;we.parameters={...we.parameters,docs:{...(sa=we.parameters)==null?void 0:sa.docs,source:{originalSource:`{
  render: () => <EnterpriseForm className="max-w-4xl">
      <EnterpriseFormSection title="Personal Information" description="Tell us about yourself">
        <EnterpriseFormRow columns={2}>
          <EnterpriseFormField label="First Name" required>
            <Input placeholder="John" />
          </EnterpriseFormField>
          <EnterpriseFormField label="Last Name" required>
            <Input placeholder="Doe" />
          </EnterpriseFormField>
        </EnterpriseFormRow>

        <EnterpriseFormField label="Email" required hint="We'll use this to contact you">
          <Input type="email" placeholder="john@example.com" />
        </EnterpriseFormField>
      </EnterpriseFormSection>

      <EnterpriseFormSection title="Professional Details" description="Information about your role">
        <EnterpriseFormRow columns={3}>
          <EnterpriseFormField label="Company" required>
            <Input placeholder="Your Company" />
          </EnterpriseFormField>
          <EnterpriseFormField label="Position" required>
            <Input placeholder="Your Position" />
          </EnterpriseFormField>
          <EnterpriseFormField label="Phone">
            <Input placeholder="(555) 123-4567" />
          </EnterpriseFormField>
        </EnterpriseFormRow>

        <EnterpriseFormRow columns={2}>
          <EnterpriseFormField label="Industry" required>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Select industry" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tech">Technology</SelectItem>
                <SelectItem value="finance">Finance</SelectItem>
                <SelectItem value="healthcare">Healthcare</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </EnterpriseFormField>
          <EnterpriseFormField label="Company Size">
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Select size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1-10">1-10 employees</SelectItem>
                <SelectItem value="11-50">11-50 employees</SelectItem>
                <SelectItem value="51-200">51-200 employees</SelectItem>
                <SelectItem value="200+">200+ employees</SelectItem>
              </SelectContent>
            </Select>
          </EnterpriseFormField>
        </EnterpriseFormRow>
      </EnterpriseFormSection>

      <EnterpriseFormSection title="Address" description="Your location information">
        <EnterpriseFormRow columns={1}>
          <EnterpriseFormField label="Street Address" required>
            <Input placeholder="123 Main St" />
          </EnterpriseFormField>
        </EnterpriseFormRow>

        <EnterpriseFormRow columns={3}>
          <EnterpriseFormField label="City" required>
            <Input placeholder="San Francisco" />
          </EnterpriseFormField>
          <EnterpriseFormField label="State/Province" required>
            <Input placeholder="California" />
          </EnterpriseFormField>
          <EnterpriseFormField label="ZIP Code" required>
            <Input placeholder="94102" />
          </EnterpriseFormField>
        </EnterpriseFormRow>
      </EnterpriseFormSection>

      <div className="flex gap-3 justify-end pt-4">
        <EnterpriseButton variant="outline">Cancel</EnterpriseButton>
        <EnterpriseButton variant="primary" type="submit">
          Create Account
        </EnterpriseButton>
      </div>
    </EnterpriseForm>
}`,...(ia=(na=we.parameters)==null?void 0:na.docs)==null?void 0:ia.source}}};const js=["TableBasic","TableWithSorting","TableLoading","TableEmptyState","TableStriped","TableNoStriped","TableWithRowClick","CardDefault","CardWithHeader","CardWithActions","CardWithFooter","CardOutlined","CardElevated","CardClickable","HeaderDefault","HeaderWithSubtitle","HeaderWithStatus","HeaderWithActions","HeaderCompact","HeaderLarge","ButtonPrimary","ButtonSecondary","ButtonDestructive","ButtonGhost","ButtonOutline","ButtonSmall","ButtonMedium","ButtonLarge","ButtonWithIconLeft","ButtonWithIconRight","ButtonLoading","ButtonDisabled","ButtonAllVariants","ButtonAllSizes","ModalSmall","ModalMedium","ModalLarge","ModalExtraLarge","ModalWithFooter","FormBasic","FormTwoColumn","FormThreeColumn","FormMultipleSections","FormWithValidation","FormComplex"];export{he as ButtonAllSizes,xe as ButtonAllVariants,se as ButtonDestructive,pe as ButtonDisabled,ne as ButtonGhost,de as ButtonLarge,ue as ButtonLoading,oe as ButtonMedium,ie as ButtonOutline,te as ButtonPrimary,ae as ButtonSecondary,le as ButtonSmall,ce as ButtonWithIconLeft,me as ButtonWithIconRight,Z as CardClickable,z as CardDefault,Y as CardElevated,G as CardOutlined,$ as CardWithActions,K as CardWithFooter,V as CardWithHeader,ve as FormBasic,we as FormComplex,Fe as FormMultipleSections,Ne as FormThreeColumn,Ee as FormTwoColumn,Se as FormWithValidation,ee as HeaderCompact,U as HeaderDefault,re as HeaderLarge,X as HeaderWithActions,Q as HeaderWithStatus,J as HeaderWithSubtitle,je as ModalExtraLarge,be as ModalLarge,ge as ModalMedium,ye as ModalSmall,fe as ModalWithFooter,D as TableBasic,_ as TableEmptyState,L as TableLoading,O as TableNoStriped,W as TableStriped,H as TableWithRowClick,P as TableWithSorting,js as __namedExportsOrder,bs as default};

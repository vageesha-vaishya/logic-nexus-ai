import{j as e}from"./jsx-runtime-DF2Pcvd1.js";import{r as c,R as Ja}from"./index-B2-qRKKC.js";import"./button-Cpm3eO9b.js";import{I as o}from"./input-DQrLB-hL.js";import{c as m}from"./utils-CytzSlOG.js";import{C as Xe}from"./chevrons-up-down-DLg14hCS.js";import{C as Qa,a as en,u as rn}from"./index-DK19BPjP.js";import{c as D}from"./proxy-Cbcr9-XL.js";import{c as q}from"./index-DW48STyt.js";import{u as _e,a as tn}from"./index-Bh3JKd2m.js";import{c as an,a as nn}from"./index-DRfMV7qj.js";import{u as Me}from"./index-Z75IbNXa.js";import{P as sn,h as on,a as ln,u as cn,F as dn,D as mn}from"./Combination-uNsERWH7.js";import{P as Pe}from"./index-BVTljfQg.js";import{P as O}from"./index-BmZbFD_3.js";import{X as un}from"./x-CUxFzBkb.js";import{S as ke,a as Ae,b as Be,c as qe,d as v}from"./select-CbrB-pmO.js";import{c as Fa}from"./createLucideIcon-DapQ2WKf.js";import{T as pn}from"./trash-2-D86ef2fH.js";import{C as wa}from"./circle-check-big-dWDVVDXR.js";import{P as Ca}from"./plus-B4oY7sqh.js";import"./_commonjsHelpers-Cpj98o6Y.js";import"./index-ciuW_uyV.js";import"./index-CFX93qP1.js";import"./index-Bz0SC8DB.js";import"./index-CGh0mKBy.js";import"./index-_AbP6Uzr.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const hn=Fa("Pen",[["path",{d:"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",key:"1a8usu"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const M=Fa("Settings",[["path",{d:"M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z",key:"1qme2f"}],["circle",{cx:"12",cy:"12",r:"3",key:"1v7zrd"}]]);function w({columns:r,data:t,rowKey:a,onRowClick:n,sortBy:s,sortOrder:i="asc",onSort:u,isLoading:h=!1,emptyState:x,rowClassName:g,className:y,headerClassName:F,striped:P=!0,hover:Ze=!0}){const[Ka,Ya]=c.useState(null),Ue=!!(s&&u),E=Ue?s?{column:s,direction:i}:null:Ka,Za=c.useMemo(()=>E?[...t].sort((f,b)=>{const C=f[E.column],T=b[E.column];return C==null&&T==null?0:C==null?1:T==null?-1:typeof C=="string"&&typeof T=="string"?E.direction==="asc"?C.localeCompare(T):T.localeCompare(C):typeof C=="number"&&typeof T=="number"?E.direction==="asc"?C-T:T-C:0}):t,[t,E]),Ua=p=>{if(p.sortable)if(Ue&&u){const b=(s===String(p.key)?i:"asc")==="asc"?"desc":"asc";u(String(p.key),b)}else Ya(f=>(f==null?void 0:f.column)!==p.key?{column:p.key,direction:"asc"}:f.direction==="asc"?{column:p.key,direction:"desc"}:null)},Xa=p=>p.sortable?(E==null?void 0:E.column)!==p.key?e.jsx(Xe,{className:"h-4 w-4 text-gray-400"}):E.direction==="asc"?e.jsx(Qa,{className:"h-4 w-4 text-primary"}):E.direction==="desc"?e.jsx(en,{className:"h-4 w-4 text-primary"}):e.jsx(Xe,{className:"h-4 w-4 text-gray-400"}):null;return h?e.jsx("div",{className:m("border border-gray-200 rounded-lg shadow-[0_1px_4px_rgba(0,0,0,0.05)]",y),children:e.jsxs("table",{className:"w-full",children:[e.jsx("thead",{className:"bg-gray-50 border-b border-gray-200",children:e.jsx("tr",{children:r.map(p=>e.jsx("th",{style:{width:p.width},className:m("px-6 py-3 text-left text-sm font-medium text-gray-900",p.headerClassName),children:p.label},String(p.key)))})}),e.jsx("tbody",{children:[...Array(5)].map((p,f)=>e.jsx("tr",{className:"border-b border-gray-200 bg-white",children:r.map(b=>e.jsx("td",{className:m("px-6 py-3 text-sm",b.cellClassName),children:e.jsx("div",{className:"h-4 bg-gray-200 rounded animate-pulse"})},`${f}-${String(b.key)}`))},f))})]})}):t.length===0?e.jsx("div",{className:m("border border-gray-200 rounded-lg shadow-[0_1px_4px_rgba(0,0,0,0.05)] p-8",y),children:e.jsx("div",{className:"text-center text-muted-foreground",children:x||e.jsx(e.Fragment,{children:e.jsx("p",{className:"text-sm text-gray-500",children:"No data available"})})})}):e.jsx("div",{className:m("border border-gray-200 rounded-lg shadow-[0_1px_4px_rgba(0,0,0,0.05)] overflow-hidden",y),children:e.jsxs("table",{className:"w-full",children:[e.jsx("thead",{className:m("bg-gray-50 border-b border-gray-200",F),children:e.jsx("tr",{children:r.map(p=>e.jsx("th",{style:{width:p.width},onClick:()=>Ua(p),className:m("px-6 py-3 text-left text-sm font-medium text-gray-900",p.sortable&&"cursor-pointer hover:bg-gray-100 transition-colors",p.headerClassName),children:e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("span",{children:p.label}),Xa(p)]})},String(p.key)))})}),e.jsx("tbody",{children:Za.map((p,f)=>e.jsx("tr",{onClick:()=>n==null?void 0:n(p,f),className:m("border-b border-gray-200 transition-colors",P&&f%2===1&&"bg-gray-50",Ze&&"hover:bg-gray-100",n&&"cursor-pointer",!P&&!Ze&&"bg-white",g),children:r.map(b=>e.jsx("td",{className:m("px-6 py-3 text-sm text-gray-900",b.className,b.cellClassName),children:b.render?b.render(p[b.key],p,f):String(p[b.key]??"-")},String(b.key)))},a?a(p,f):f))})]})})}w.__docgenInfo={description:"",methods:[],displayName:"EnterpriseTable",props:{columns:{required:!0,tsType:{name:"Array",elements:[{name:"Column",elements:[{name:"T"}],raw:"Column<T>"}],raw:"Column<T>[]"},description:""},data:{required:!0,tsType:{name:"Array",elements:[{name:"T"}],raw:"T[]"},description:""},rowKey:{required:!1,tsType:{name:"signature",type:"function",raw:"(row: T, index: number) => string | number",signature:{arguments:[{type:{name:"T"},name:"row"},{type:{name:"number"},name:"index"}],return:{name:"union",raw:"string | number",elements:[{name:"string"},{name:"number"}]}}},description:""},onRowClick:{required:!1,tsType:{name:"signature",type:"function",raw:"(row: T, index: number) => void",signature:{arguments:[{type:{name:"T"},name:"row"},{type:{name:"number"},name:"index"}],return:{name:"void"}}},description:""},sortBy:{required:!1,tsType:{name:"string"},description:""},sortOrder:{required:!1,tsType:{name:"union",raw:"'asc' | 'desc'",elements:[{name:"literal",value:"'asc'"},{name:"literal",value:"'desc'"}]},description:"",defaultValue:{value:"'asc'",computed:!1}},onSort:{required:!1,tsType:{name:"signature",type:"function",raw:"(key: string, order: 'asc' | 'desc') => void",signature:{arguments:[{type:{name:"string"},name:"key"},{type:{name:"union",raw:"'asc' | 'desc'",elements:[{name:"literal",value:"'asc'"},{name:"literal",value:"'desc'"}]},name:"order"}],return:{name:"void"}}},description:""},isLoading:{required:!1,tsType:{name:"boolean"},description:"",defaultValue:{value:"false",computed:!1}},emptyState:{required:!1,tsType:{name:"ReactReactNode",raw:"React.ReactNode"},description:""},rowClassName:{required:!1,tsType:{name:"string"},description:""},className:{required:!1,tsType:{name:"string"},description:""},headerClassName:{required:!1,tsType:{name:"string"},description:""},striped:{required:!1,tsType:{name:"boolean"},description:"",defaultValue:{value:"true",computed:!1}},hover:{required:!1,tsType:{name:"boolean"},description:"",defaultValue:{value:"true",computed:!1}}}};const xn={default:"bg-white border border-gray-200 shadow-[0_1px_4px_rgba(0,0,0,0.05)]",outlined:"bg-white border border-gray-200",elevated:"bg-white border border-gray-200 shadow-[0_4px_12px_rgba(0,0,0,0.08)]"};function I({title:r,description:t,icon:a,children:n,footer:s,actions:i,className:u,headerClassName:h,bodyClassName:x,footerClassName:g,clickable:y=!1,onClick:F,variant:P="default"}){return e.jsxs(D.div,{initial:{opacity:0,y:8},animate:{opacity:1,y:0},transition:{duration:.2,ease:"easeOut"},onClick:F,className:m("rounded-sm overflow-hidden transition-all",xn[P],y&&"cursor-pointer hover:shadow-[0_8px_16px_rgba(0,0,0,0.1)]",u),children:[(r||t||i)&&e.jsxs("header",{className:m("px-4 py-3 border-b border-gray-200 bg-gray-50/50 flex items-start justify-between",h),children:[e.jsxs("div",{className:"flex items-start gap-3",children:[a&&e.jsx("div",{className:"text-gray-600 mt-0.5",children:a}),e.jsxs("div",{children:[r&&e.jsx("h3",{className:"text-sm font-semibold text-gray-900",children:r}),t&&e.jsx("p",{className:"text-xs text-muted-foreground mt-1",children:t})]})]}),i&&e.jsx("div",{className:"flex items-center gap-2",children:i})]}),e.jsx("section",{className:m("p-4",x),children:n}),s&&e.jsx("footer",{className:m("px-4 py-3 border-t border-gray-200 bg-gray-50/50",g),children:s})]})}I.__docgenInfo={description:"",methods:[],displayName:"EnterpriseCard",props:{title:{required:!1,tsType:{name:"string"},description:""},description:{required:!1,tsType:{name:"string"},description:""},icon:{required:!1,tsType:{name:"ReactReactNode",raw:"React.ReactNode"},description:""},children:{required:!0,tsType:{name:"ReactReactNode",raw:"React.ReactNode"},description:""},footer:{required:!1,tsType:{name:"ReactReactNode",raw:"React.ReactNode"},description:""},actions:{required:!1,tsType:{name:"ReactReactNode",raw:"React.ReactNode"},description:""},className:{required:!1,tsType:{name:"string"},description:""},headerClassName:{required:!1,tsType:{name:"string"},description:""},bodyClassName:{required:!1,tsType:{name:"string"},description:""},footerClassName:{required:!1,tsType:{name:"string"},description:""},clickable:{required:!1,tsType:{name:"boolean"},description:"",defaultValue:{value:"false",computed:!1}},onClick:{required:!1,tsType:{name:"signature",type:"function",raw:"() => void",signature:{arguments:[],return:{name:"void"}}},description:""},variant:{required:!1,tsType:{name:"union",raw:"'default' | 'outlined' | 'elevated'",elements:[{name:"literal",value:"'default'"},{name:"literal",value:"'outlined'"},{name:"literal",value:"'elevated'"}]},description:"",defaultValue:{value:"'default'",computed:!1}}}};var Oe="Dialog",[Ta]=an(Oe),[yn,S]=Ta(Oe),Ia=r=>{const{__scopeDialog:t,children:a,open:n,defaultOpen:s,onOpenChange:i,modal:u=!0}=r,h=c.useRef(null),x=c.useRef(null),[g,y]=rn({prop:n,defaultProp:s??!1,onChange:i,caller:Oe});return e.jsx(yn,{scope:t,triggerRef:h,contentRef:x,contentId:Me(),titleId:Me(),descriptionId:Me(),open:g,onOpenChange:y,onOpenToggle:c.useCallback(()=>y(F=>!F),[y]),modal:u,children:a})};Ia.displayName=Oe;var Ra="DialogTrigger",gn=c.forwardRef((r,t)=>{const{__scopeDialog:a,...n}=r,s=S(Ra,a),i=_e(t,s.triggerRef);return e.jsx(O.button,{type:"button","aria-haspopup":"dialog","aria-expanded":s.open,"aria-controls":s.contentId,"data-state":ze(s.open),...n,ref:i,onClick:q(r.onClick,s.onOpenToggle)})});gn.displayName=Ra;var Le="DialogPortal",[fn,ka]=Ta(Le,{forceMount:void 0}),Aa=r=>{const{__scopeDialog:t,forceMount:a,children:n,container:s}=r,i=S(Le,t);return e.jsx(fn,{scope:t,forceMount:a,children:c.Children.map(n,u=>e.jsx(Pe,{present:a||i.open,children:e.jsx(sn,{asChild:!0,container:s,children:u})}))})};Aa.displayName=Le;var De="DialogOverlay",Ba=c.forwardRef((r,t)=>{const a=ka(De,r.__scopeDialog),{forceMount:n=a.forceMount,...s}=r,i=S(De,r.__scopeDialog);return i.modal?e.jsx(Pe,{present:n||i.open,children:e.jsx(vn,{...s,ref:t})}):null});Ba.displayName=De;var bn=tn("DialogOverlay.RemoveScroll"),vn=c.forwardRef((r,t)=>{const{__scopeDialog:a,...n}=r,s=S(De,a);return e.jsx(ln,{as:bn,allowPinchZoom:!0,shards:[s.contentRef],children:e.jsx(O.div,{"data-state":ze(s.open),...n,ref:t,style:{pointerEvents:"auto",...n.style}})})}),R="DialogContent",qa=c.forwardRef((r,t)=>{const a=ka(R,r.__scopeDialog),{forceMount:n=a.forceMount,...s}=r,i=S(R,r.__scopeDialog);return e.jsx(Pe,{present:n||i.open,children:i.modal?e.jsx(jn,{...s,ref:t}):e.jsx(En,{...s,ref:t})})});qa.displayName=R;var jn=c.forwardRef((r,t)=>{const a=S(R,r.__scopeDialog),n=c.useRef(null),s=_e(t,a.contentRef,n);return c.useEffect(()=>{const i=n.current;if(i)return on(i)},[]),e.jsx(Da,{...r,ref:s,trapFocus:a.open,disableOutsidePointerEvents:!0,onCloseAutoFocus:q(r.onCloseAutoFocus,i=>{var u;i.preventDefault(),(u=a.triggerRef.current)==null||u.focus()}),onPointerDownOutside:q(r.onPointerDownOutside,i=>{const u=i.detail.originalEvent,h=u.button===0&&u.ctrlKey===!0;(u.button===2||h)&&i.preventDefault()}),onFocusOutside:q(r.onFocusOutside,i=>i.preventDefault())})}),En=c.forwardRef((r,t)=>{const a=S(R,r.__scopeDialog),n=c.useRef(!1),s=c.useRef(!1);return e.jsx(Da,{...r,ref:t,trapFocus:!1,disableOutsidePointerEvents:!1,onCloseAutoFocus:i=>{var u,h;(u=r.onCloseAutoFocus)==null||u.call(r,i),i.defaultPrevented||(n.current||(h=a.triggerRef.current)==null||h.focus(),i.preventDefault()),n.current=!1,s.current=!1},onInteractOutside:i=>{var x,g;(x=r.onInteractOutside)==null||x.call(r,i),i.defaultPrevented||(n.current=!0,i.detail.originalEvent.type==="pointerdown"&&(s.current=!0));const u=i.target;((g=a.triggerRef.current)==null?void 0:g.contains(u))&&i.preventDefault(),i.detail.originalEvent.type==="focusin"&&s.current&&i.preventDefault()}})}),Da=c.forwardRef((r,t)=>{const{__scopeDialog:a,trapFocus:n,onOpenAutoFocus:s,onCloseAutoFocus:i,...u}=r,h=S(R,a),x=c.useRef(null),g=_e(t,x);return cn(),e.jsxs(e.Fragment,{children:[e.jsx(dn,{asChild:!0,loop:!0,trapped:n,onMountAutoFocus:s,onUnmountAutoFocus:i,children:e.jsx(mn,{role:"dialog",id:h.contentId,"aria-describedby":h.descriptionId,"aria-labelledby":h.titleId,"data-state":ze(h.open),...u,ref:g,onDismiss:()=>h.onOpenChange(!1)})}),e.jsxs(e.Fragment,{children:[e.jsx(Nn,{titleId:h.titleId}),e.jsx(Fn,{contentRef:x,descriptionId:h.descriptionId})]})]})}),We="DialogTitle",Oa=c.forwardRef((r,t)=>{const{__scopeDialog:a,...n}=r,s=S(We,a);return e.jsx(O.h2,{id:s.titleId,...n,ref:t})});Oa.displayName=We;var Ma="DialogDescription",_a=c.forwardRef((r,t)=>{const{__scopeDialog:a,...n}=r,s=S(Ma,a);return e.jsx(O.p,{id:s.descriptionId,...n,ref:t})});_a.displayName=Ma;var Pa="DialogClose",La=c.forwardRef((r,t)=>{const{__scopeDialog:a,...n}=r,s=S(Pa,a);return e.jsx(O.button,{type:"button",...n,ref:t,onClick:q(r.onClick,()=>s.onOpenChange(!1))})});La.displayName=Pa;function ze(r){return r?"open":"closed"}var Wa="DialogTitleWarning",[ss,za]=nn(Wa,{contentName:R,titleName:We,docsSlug:"dialog"}),Nn=({titleId:r})=>{const t=za(Wa),a=`\`${t.contentName}\` requires a \`${t.titleName}\` for the component to be accessible for screen reader users.

If you want to hide the \`${t.titleName}\`, you can wrap it with our VisuallyHidden component.

For more information, see https://radix-ui.com/primitives/docs/components/${t.docsSlug}`;return c.useEffect(()=>{r&&(document.getElementById(r)||console.error(a))},[a,r]),null},Sn="DialogDescriptionWarning",Fn=({contentRef:r,descriptionId:t})=>{const n=`Warning: Missing \`Description\` or \`aria-describedby={undefined}\` for {${za(Sn).contentName}}.`;return c.useEffect(()=>{var i;const s=(i=r.current)==null?void 0:i.getAttribute("aria-describedby");t&&s&&(document.getElementById(t)||console.warn(n))},[n,r,t]),null},wn=Ia,Cn=Aa,Ha=Ba,$a=qa,Va=Oa,Ga=_a,Tn=La;const In=wn,Rn=Cn,He=c.forwardRef(({className:r,...t},a)=>e.jsx(Ha,{ref:a,className:m("fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",r),...t}));He.displayName=Ha.displayName;const $e=c.forwardRef(({className:r,children:t,...a},n)=>e.jsxs(Rn,{children:[e.jsx(He,{}),e.jsxs($a,{ref:n,className:m("fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",r),...a,children:[t,e.jsxs(Tn,{className:"absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity data-[state=open]:bg-accent data-[state=open]:text-muted-foreground hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none",children:[e.jsx(un,{className:"h-4 w-4"}),e.jsx("span",{className:"sr-only",children:"Close"})]})]})]}));$e.displayName=$a.displayName;const Ve=({className:r,...t})=>e.jsx("div",{className:m("flex flex-col space-y-1.5 text-center sm:text-left",r),...t});Ve.displayName="DialogHeader";const Ge=({className:r,...t})=>e.jsx("div",{className:m("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",r),...t});Ge.displayName="DialogFooter";const Ke=c.forwardRef(({className:r,...t},a)=>e.jsx(Va,{ref:a,className:m("text-lg font-semibold leading-none tracking-tight",r),...t}));Ke.displayName=Va.displayName;const Ye=c.forwardRef(({className:r,...t},a)=>e.jsx(Ga,{ref:a,className:m("text-sm text-muted-foreground",r),...t}));Ye.displayName=Ga.displayName;He.__docgenInfo={description:"",methods:[]};$e.__docgenInfo={description:"",methods:[]};Ve.__docgenInfo={description:"",methods:[],displayName:"DialogHeader"};Ge.__docgenInfo={description:"",methods:[],displayName:"DialogFooter"};Ke.__docgenInfo={description:"",methods:[]};Ye.__docgenInfo={description:"",methods:[]};function B({isOpen:r,onClose:t,title:a,description:n,children:s,footer:i,size:u="md",className:h,headerClassName:x,contentClassName:g,footerClassName:y}){const F={sm:"max-w-sm",md:"max-w-md",lg:"max-w-lg",xl:"max-w-xl"};return e.jsx(In,{open:r,onOpenChange:t,children:e.jsx($e,{className:m(F[u],"border-gray-200 shadow-[0_20px_25px_rgba(0,0,0,0.1)]",h),children:e.jsxs(D.div,{initial:{opacity:0,scale:.95},animate:{opacity:1,scale:1},exit:{opacity:0,scale:.95},transition:{duration:.2},children:[e.jsxs(Ve,{className:m("border-b border-gray-200 pb-4",x),children:[e.jsx(Ke,{className:"text-lg font-semibold text-gray-900",children:a}),n&&e.jsx(Ye,{className:"text-sm text-muted-foreground mt-1",children:n})]}),e.jsx("div",{className:m("py-4",g),children:s}),i&&e.jsx(Ge,{className:m("border-t border-gray-200 pt-4 mt-4",y),children:i})]})})})}B.__docgenInfo={description:"",methods:[],displayName:"EnterpriseModal",props:{isOpen:{required:!0,tsType:{name:"boolean"},description:""},onClose:{required:!0,tsType:{name:"signature",type:"function",raw:"() => void",signature:{arguments:[],return:{name:"void"}}},description:""},title:{required:!0,tsType:{name:"string"},description:""},description:{required:!1,tsType:{name:"string"},description:""},children:{required:!0,tsType:{name:"ReactReactNode",raw:"React.ReactNode"},description:""},footer:{required:!1,tsType:{name:"ReactReactNode",raw:"React.ReactNode"},description:""},size:{required:!1,tsType:{name:"union",raw:"'sm' | 'md' | 'lg' | 'xl'",elements:[{name:"literal",value:"'sm'"},{name:"literal",value:"'md'"},{name:"literal",value:"'lg'"},{name:"literal",value:"'xl'"}]},description:"",defaultValue:{value:"'md'",computed:!1}},className:{required:!1,tsType:{name:"string"},description:""},headerClassName:{required:!1,tsType:{name:"string"},description:""},contentClassName:{required:!1,tsType:{name:"string"},description:""},footerClassName:{required:!1,tsType:{name:"string"},description:""}}};const kn={default:{container:"py-6",title:"text-2xl",subtitle:"text-sm",description:"text-sm"},compact:{container:"py-4",title:"text-lg",subtitle:"text-xs",description:"text-xs"},large:{container:"py-8",title:"text-4xl",subtitle:"text-base",description:"text-base"}};function k({title:r,subtitle:t,description:a,icon:n,status:s,actions:i,className:u,titleClassName:h,contentClassName:x,variant:g="default"}){const y=kn[g];return e.jsx(D.header,{initial:{opacity:0,y:-10},animate:{opacity:1,y:0},transition:{duration:.3,ease:"easeOut"},className:m("border-b border-gray-200 bg-white",y.container,u),children:e.jsxs("div",{className:m("px-4 md:px-6 flex items-start justify-between gap-6",x),children:[e.jsxs("div",{className:"flex items-start gap-4 flex-1 min-w-0",children:[n&&e.jsx("div",{className:"flex-shrink-0 text-gray-600 mt-1",children:n}),e.jsxs("div",{className:"flex-1 min-w-0",children:[e.jsx("h1",{className:m("font-bold text-gray-900 leading-tight",y.title,h),children:r}),t&&e.jsx("p",{className:m("text-gray-600 mt-1",y.subtitle),children:t}),a&&e.jsx("p",{className:m("text-gray-500 mt-2",y.description),children:a})]})]}),e.jsxs("div",{className:"flex items-center gap-3 flex-shrink-0",children:[s&&e.jsx("div",{className:"flex items-center",children:s}),i&&e.jsx("div",{className:"flex items-center gap-2",children:i})]})]})})}k.__docgenInfo={description:"",methods:[],displayName:"EnterpriseHeader",props:{title:{required:!0,tsType:{name:"string"},description:""},subtitle:{required:!1,tsType:{name:"string"},description:""},description:{required:!1,tsType:{name:"string"},description:""},icon:{required:!1,tsType:{name:"ReactReactNode",raw:"React.ReactNode"},description:""},status:{required:!1,tsType:{name:"ReactReactNode",raw:"React.ReactNode"},description:""},actions:{required:!1,tsType:{name:"ReactReactNode",raw:"React.ReactNode"},description:""},className:{required:!1,tsType:{name:"string"},description:""},titleClassName:{required:!1,tsType:{name:"string"},description:""},contentClassName:{required:!1,tsType:{name:"string"},description:""},variant:{required:!1,tsType:{name:"union",raw:"'default' | 'compact' | 'large'",elements:[{name:"literal",value:"'default'"},{name:"literal",value:"'compact'"},{name:"literal",value:"'large'"}]},description:"",defaultValue:{value:"'default'",computed:!1}}}};const l=Ja.forwardRef(({variant:r="primary",size:t="md",icon:a,iconPosition:n="left",loading:s=!1,children:i,className:u,disabled:h,...x},g)=>{const y={primary:"bg-[#714B67] text-white hover:bg-[#5d3d54] disabled:bg-gray-300 disabled:text-gray-500",secondary:"bg-gray-100 text-gray-900 hover:bg-gray-200 disabled:bg-gray-100 disabled:text-gray-400",destructive:"bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300 disabled:text-red-100",ghost:"bg-transparent text-gray-900 hover:bg-gray-100 disabled:text-gray-400",outline:"bg-white border border-gray-300 text-gray-900 hover:bg-gray-50 disabled:border-gray-200 disabled:text-gray-400"},F={sm:"px-3 py-1.5 text-xs font-medium rounded-sm",md:"px-4 py-2 text-sm font-medium rounded-sm",lg:"px-6 py-2.5 text-base font-semibold rounded-sm"};return e.jsx(D.button,{ref:g,whileHover:!h&&!s?{scale:1.02}:{},whileTap:!h&&!s?{scale:.98}:{},disabled:h||s,className:m("inline-flex items-center justify-center gap-2 font-medium transition-all","focus:outline-none focus:ring-2 focus:ring-[#714B67]/20 focus:ring-offset-2","disabled:cursor-not-allowed disabled:opacity-60",y[r],F[t],u),...x,children:s?e.jsxs(e.Fragment,{children:[e.jsxs("svg",{className:"h-4 w-4 animate-spin",xmlns:"http://www.w3.org/2000/svg",fill:"none",viewBox:"0 0 24 24",children:[e.jsx("circle",{className:"opacity-25",cx:"12",cy:"12",r:"10",stroke:"currentColor",strokeWidth:"4"}),e.jsx("path",{className:"opacity-75",fill:"currentColor",d:"M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"})]}),e.jsx("span",{children:"Loading..."})]}):e.jsxs(e.Fragment,{children:[a&&n==="left"&&e.jsx("span",{children:a}),e.jsx("span",{children:i}),a&&n==="right"&&e.jsx("span",{children:a})]})})});l.displayName="EnterpriseButton";l.__docgenInfo={description:"",methods:[],displayName:"EnterpriseButton",props:{variant:{required:!1,tsType:{name:"union",raw:"'primary' | 'secondary' | 'destructive' | 'ghost' | 'outline'",elements:[{name:"literal",value:"'primary'"},{name:"literal",value:"'secondary'"},{name:"literal",value:"'destructive'"},{name:"literal",value:"'ghost'"},{name:"literal",value:"'outline'"}]},description:"",defaultValue:{value:"'primary'",computed:!1}},size:{required:!1,tsType:{name:"union",raw:"'sm' | 'md' | 'lg'",elements:[{name:"literal",value:"'sm'"},{name:"literal",value:"'md'"},{name:"literal",value:"'lg'"}]},description:"",defaultValue:{value:"'md'",computed:!1}},icon:{required:!1,tsType:{name:"ReactReactNode",raw:"React.ReactNode"},description:""},iconPosition:{required:!1,tsType:{name:"union",raw:"'left' | 'right'",elements:[{name:"literal",value:"'left'"},{name:"literal",value:"'right'"}]},description:"",defaultValue:{value:"'left'",computed:!1}},loading:{required:!1,tsType:{name:"boolean"},description:"",defaultValue:{value:"false",computed:!1}},children:{required:!0,tsType:{name:"ReactReactNode",raw:"React.ReactNode"},description:""}}};function A({children:r,onSubmit:t,className:a,sectionClassName:n}){return e.jsx("form",{onSubmit:t,className:m("space-y-6",a),children:r})}function N({title:r,description:t,children:a,className:n,contentClassName:s}){return e.jsxs(D.div,{initial:{opacity:0},animate:{opacity:1},transition:{duration:.3},className:m("bg-white border border-gray-200 rounded-sm overflow-hidden",n),children:[(r||t)&&e.jsxs("div",{className:"px-6 py-4 border-b border-gray-200 bg-gray-50/50",children:[r&&e.jsx("h2",{className:"text-base font-semibold text-gray-900",children:r}),t&&e.jsx("p",{className:"text-sm text-muted-foreground mt-1",children:t})]}),e.jsx("div",{className:m("p-6 space-y-6",s),children:a})]})}function j({children:r,columns:t=2,className:a}){const n={1:"grid-cols-1",2:"grid-cols-1 md:grid-cols-2",3:"grid-cols-1 md:grid-cols-3"};return e.jsx("div",{className:m("grid gap-6",n[t],a),children:r})}function d({label:r,required:t=!1,error:a,hint:n,children:s,className:i}){return e.jsxs("div",{className:m("flex flex-col gap-2",i),children:[e.jsxs("label",{className:"text-sm font-medium text-gray-900",children:[r,t&&e.jsx("span",{className:"text-red-600 ml-1",children:"*"})]}),s,a&&e.jsx("p",{className:"text-xs text-red-600",children:a}),n&&e.jsx("p",{className:"text-xs text-muted-foreground",children:n})]})}A.__docgenInfo={description:"",methods:[],displayName:"EnterpriseForm",props:{children:{required:!0,tsType:{name:"ReactReactNode",raw:"React.ReactNode"},description:""},onSubmit:{required:!1,tsType:{name:"signature",type:"function",raw:"(e: React.FormEvent<HTMLFormElement>) => void",signature:{arguments:[{type:{name:"ReactFormEvent",raw:"React.FormEvent<HTMLFormElement>",elements:[{name:"HTMLFormElement"}]},name:"e"}],return:{name:"void"}}},description:""},className:{required:!1,tsType:{name:"string"},description:""},sectionClassName:{required:!1,tsType:{name:"string"},description:""}}};N.__docgenInfo={description:"",methods:[],displayName:"EnterpriseFormSection",props:{title:{required:!1,tsType:{name:"string"},description:""},description:{required:!1,tsType:{name:"string"},description:""},children:{required:!0,tsType:{name:"ReactReactNode",raw:"React.ReactNode"},description:""},className:{required:!1,tsType:{name:"string"},description:""},contentClassName:{required:!1,tsType:{name:"string"},description:""}}};j.__docgenInfo={description:"",methods:[],displayName:"EnterpriseFormRow",props:{children:{required:!0,tsType:{name:"ReactReactNode",raw:"React.ReactNode"},description:""},columns:{required:!1,tsType:{name:"union",raw:"1 | 2 | 3",elements:[{name:"literal",value:"1"},{name:"literal",value:"2"},{name:"literal",value:"3"}]},description:"",defaultValue:{value:"2",computed:!1}},className:{required:!1,tsType:{name:"string"},description:""}}};d.__docgenInfo={description:"",methods:[],displayName:"EnterpriseFormField",props:{label:{required:!0,tsType:{name:"string"},description:""},required:{required:!1,tsType:{name:"boolean"},description:"",defaultValue:{value:"false",computed:!1}},error:{required:!1,tsType:{name:"string"},description:""},hint:{required:!1,tsType:{name:"string"},description:""},children:{required:!0,tsType:{name:"ReactReactNode",raw:"React.ReactNode"},description:""},className:{required:!1,tsType:{name:"string"},description:""}}};const is={title:"Enterprise/Table",component:w,parameters:{layout:"padded"},tags:["autodocs"]},_=[{id:"1",name:"Acme Corporation",type:"Enterprise",revenue:5e6,status:"Active"},{id:"2",name:"TechFlow Inc",type:"Mid-Market",revenue:12e5,status:"Active"},{id:"3",name:"Global Logistics",type:"Enterprise",revenue:35e5,status:"Inactive"},{id:"4",name:"StartUp Labs",type:"SMB",revenue:25e4,status:"Active"}],L={render:()=>e.jsx(w,{columns:[{key:"name",label:"Account Name",sortable:!0,width:"35%"},{key:"type",label:"Account Type",sortable:!0,width:"20%"},{key:"revenue",label:"Annual Revenue",sortable:!0,width:"25%",render:r=>`$${(r/1e6).toFixed(1)}M`},{key:"status",label:"Status",sortable:!1,width:"20%"}],data:_,rowKey:r=>r.id})},W={render:()=>{const[r,t]=c.useState("name"),[a,n]=c.useState("asc");return e.jsx(w,{columns:[{key:"name",label:"Account Name",sortable:!0,width:"35%"},{key:"type",label:"Account Type",sortable:!0,width:"20%"},{key:"revenue",label:"Annual Revenue",sortable:!0,width:"25%",render:s=>`$${(s/1e6).toFixed(1)}M`},{key:"status",label:"Status",sortable:!1,width:"20%"}],data:_,rowKey:s=>s.id,sortBy:r,sortOrder:a,onSort:(s,i)=>{t(s),n(i)}})}},z={render:()=>e.jsx(w,{columns:[{key:"name",label:"Account Name",sortable:!0,width:"35%"},{key:"type",label:"Account Type",sortable:!0,width:"20%"},{key:"revenue",label:"Annual Revenue",sortable:!0,width:"25%"},{key:"status",label:"Status",sortable:!1,width:"20%"}],data:[],isLoading:!0})},H={render:()=>e.jsx(w,{columns:[{key:"name",label:"Account Name",sortable:!0},{key:"type",label:"Account Type",sortable:!0},{key:"revenue",label:"Annual Revenue",sortable:!0},{key:"status",label:"Status",sortable:!1}],data:[],emptyState:e.jsxs("div",{className:"text-center",children:[e.jsx("p",{className:"text-sm text-gray-500 mb-2",children:"No accounts found"}),e.jsx("p",{className:"text-xs text-gray-400",children:"Create a new account to get started"})]})})},$={render:()=>e.jsx(w,{columns:[{key:"name",label:"Account Name",sortable:!0},{key:"type",label:"Account Type",sortable:!0},{key:"revenue",label:"Annual Revenue",sortable:!0,render:r=>`$${(r/1e6).toFixed(1)}M`},{key:"status",label:"Status",sortable:!1}],data:_,rowKey:r=>r.id,striped:!0,hover:!0})},V={render:()=>e.jsx(w,{columns:[{key:"name",label:"Account Name",sortable:!0},{key:"type",label:"Account Type",sortable:!0},{key:"revenue",label:"Annual Revenue",sortable:!0,render:r=>`$${(r/1e6).toFixed(1)}M`},{key:"status",label:"Status",sortable:!1}],data:_,rowKey:r=>r.id,striped:!1,hover:!1})},G={render:()=>{const[r,t]=c.useState(null);return e.jsxs("div",{className:"space-y-4",children:[e.jsx(w,{columns:[{key:"name",label:"Account Name",sortable:!0},{key:"type",label:"Account Type",sortable:!0},{key:"revenue",label:"Annual Revenue",sortable:!0,render:a=>`$${(a/1e6).toFixed(1)}M`},{key:"status",label:"Status",sortable:!1}],data:_,rowKey:a=>a.id,onRowClick:a=>t(a)}),r&&e.jsx("div",{className:"p-4 border border-gray-200 rounded-lg bg-blue-50",children:e.jsxs("p",{className:"text-sm font-medium",children:["Selected: ",r.name]})})]})}},K={render:()=>e.jsx(I,{variant:"default",children:e.jsx("p",{className:"text-sm text-gray-600",children:"This is a default card with simple content and a subtle shadow."})})},Y={render:()=>e.jsx(I,{title:"Account Overview",description:"Key metrics and status",icon:e.jsx(M,{className:"w-5 h-5"}),variant:"default",children:e.jsx("p",{className:"text-sm text-gray-600",children:"Display important account information and metrics."})})},Z={render:()=>e.jsx(I,{title:"Quick Actions",description:"Common operations",actions:e.jsxs("div",{className:"flex gap-2",children:[e.jsx("button",{className:"p-1 hover:bg-gray-200 rounded",children:e.jsx(hn,{className:"w-4 h-4 text-gray-600"})}),e.jsx("button",{className:"p-1 hover:bg-gray-200 rounded",children:e.jsx(pn,{className:"w-4 h-4 text-gray-600"})})]}),variant:"default",children:e.jsx("p",{className:"text-sm text-gray-600",children:"Card with action buttons in the header."})})},U={render:()=>e.jsx(I,{title:"Status Report",description:"Current status",variant:"default",footer:e.jsx("div",{className:"text-xs text-gray-500",children:"Last updated: 2 hours ago"}),children:e.jsx("div",{className:"space-y-2",children:e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx(wa,{className:"w-4 h-4 text-green-600"}),e.jsx("span",{className:"text-sm",children:"All systems operational"})]})})})},X={render:()=>e.jsx(I,{title:"Outlined Card",description:"Minimal styling",variant:"outlined",children:e.jsx("p",{className:"text-sm text-gray-600",children:"This is an outlined card with minimal styling."})})},J={render:()=>e.jsx(I,{title:"Elevated Card",description:"Enhanced shadow",variant:"elevated",children:e.jsx("p",{className:"text-sm text-gray-600",children:"This card has an elevated appearance with a stronger shadow."})})},Q={render:()=>{const[r,t]=c.useState(!1);return e.jsxs(I,{title:"Clickable Card",clickable:!0,onClick:()=>t(!r),className:r?"border-blue-500":"",children:[e.jsx("p",{className:"text-sm text-gray-600",children:"Click this card to interact with it"}),r&&e.jsx("p",{className:"text-xs text-blue-600 mt-3",children:"Card was clicked!"})]})}},ee={render:()=>e.jsx(k,{title:"Acme Corporation",icon:e.jsx(M,{className:"w-6 h-6 text-gray-600"}),variant:"default"})},re={render:()=>e.jsx(k,{title:"Account Details",subtitle:"Acme Corporation",description:"Enterprise account with full service package",icon:e.jsx(M,{className:"w-6 h-6 text-gray-600"}),variant:"default"})},te={render:()=>e.jsx(k,{title:"Account Status",subtitle:"Acme Corporation",icon:e.jsx(M,{className:"w-6 h-6 text-gray-600"}),status:e.jsxs("div",{className:"flex items-center gap-2 px-3 py-1 bg-green-50 border border-green-200 rounded-full",children:[e.jsx(wa,{className:"w-4 h-4 text-green-600"}),e.jsx("span",{className:"text-xs font-medium text-green-700",children:"Active"})]}),variant:"default"})},ae={render:()=>e.jsx(k,{title:"Account Dashboard",subtitle:"Acme Corporation",icon:e.jsx(M,{className:"w-6 h-6 text-gray-600"}),actions:e.jsxs("div",{className:"flex gap-2",children:[e.jsx("button",{className:"px-3 py-2 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50",children:"Edit"}),e.jsx("button",{className:"px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700",children:"Save"})]}),variant:"default"})},ne={render:()=>e.jsx(k,{title:"Compact Header",subtitle:"Sub heading",variant:"compact"})},se={render:()=>e.jsx(k,{title:"Large Header",subtitle:"Sub heading",description:"With full description and plenty of space",variant:"large"})},ie={render:()=>e.jsx(l,{variant:"primary",children:"Primary Button"})},oe={render:()=>e.jsx(l,{variant:"secondary",children:"Secondary Button"})},le={render:()=>e.jsx(l,{variant:"destructive",children:"Delete"})},ce={render:()=>e.jsx(l,{variant:"ghost",children:"Ghost Button"})},de={render:()=>e.jsx(l,{variant:"outline",children:"Outline Button"})},me={render:()=>e.jsx(l,{variant:"primary",size:"sm",children:"Small Button"})},ue={render:()=>e.jsx(l,{variant:"primary",size:"md",children:"Medium Button"})},pe={render:()=>e.jsx(l,{variant:"primary",size:"lg",children:"Large Button"})},he={render:()=>e.jsx(l,{variant:"primary",icon:e.jsx(Ca,{className:"w-4 h-4"}),iconPosition:"left",children:"Add New"})},xe={render:()=>e.jsx(l,{variant:"primary",icon:e.jsx(Ca,{className:"w-4 h-4"}),iconPosition:"right",children:"Add New"})},ye={render:()=>e.jsx(l,{variant:"primary",loading:!0,children:"Processing"})},ge={render:()=>e.jsx(l,{variant:"primary",disabled:!0,children:"Disabled"})},fe={render:()=>e.jsxs("div",{className:"flex flex-wrap gap-3",children:[e.jsx(l,{variant:"primary",children:"Primary"}),e.jsx(l,{variant:"secondary",children:"Secondary"}),e.jsx(l,{variant:"destructive",children:"Destructive"}),e.jsx(l,{variant:"ghost",children:"Ghost"}),e.jsx(l,{variant:"outline",children:"Outline"})]})},be={render:()=>e.jsxs("div",{className:"flex flex-wrap gap-3 items-center",children:[e.jsx(l,{variant:"primary",size:"sm",children:"Small"}),e.jsx(l,{variant:"primary",size:"md",children:"Medium"}),e.jsx(l,{variant:"primary",size:"lg",children:"Large"})]})},ve={render:()=>{const[r,t]=c.useState(!0);return e.jsxs(e.Fragment,{children:[e.jsx(l,{onClick:()=>t(!0),children:"Open Small Modal"}),e.jsx(B,{isOpen:r,onClose:()=>t(!1),title:"Confirm Action",size:"sm",children:e.jsx("p",{className:"text-sm text-gray-600",children:"Are you sure you want to proceed with this action?"})})]})}},je={render:()=>{const[r,t]=c.useState(!0);return e.jsxs(e.Fragment,{children:[e.jsx(l,{onClick:()=>t(!0),children:"Open Medium Modal"}),e.jsx(B,{isOpen:r,onClose:()=>t(!1),title:"Create New Account",description:"Fill in the details below to create a new account",size:"md",children:e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{children:[e.jsx("label",{className:"text-sm font-medium",children:"Account Name"}),e.jsx(o,{placeholder:"Enter account name"})]}),e.jsxs("div",{children:[e.jsx("label",{className:"text-sm font-medium",children:"Type"}),e.jsxs(ke,{children:[e.jsx(Ae,{children:e.jsx(Be,{placeholder:"Select type"})}),e.jsxs(qe,{children:[e.jsx(v,{value:"enterprise",children:"Enterprise"}),e.jsx(v,{value:"mid-market",children:"Mid-Market"}),e.jsx(v,{value:"smb",children:"SMB"})]})]})]})]})})]})}},Ee={render:()=>{const[r,t]=c.useState(!0);return e.jsxs(e.Fragment,{children:[e.jsx(l,{onClick:()=>t(!0),children:"Open Large Modal"}),e.jsx(B,{isOpen:r,onClose:()=>t(!1),title:"Account Details",description:"View and edit all account information",size:"lg",children:e.jsx("div",{className:"space-y-6",children:e.jsxs("div",{className:"grid grid-cols-2 gap-4",children:[e.jsxs("div",{children:[e.jsx("label",{className:"text-sm font-medium",children:"Company Name"}),e.jsx(o,{placeholder:"Enter company name"})]}),e.jsxs("div",{children:[e.jsx("label",{className:"text-sm font-medium",children:"Industry"}),e.jsx(o,{placeholder:"Enter industry"})]}),e.jsxs("div",{children:[e.jsx("label",{className:"text-sm font-medium",children:"Email"}),e.jsx(o,{placeholder:"Enter email"})]}),e.jsxs("div",{children:[e.jsx("label",{className:"text-sm font-medium",children:"Phone"}),e.jsx(o,{placeholder:"Enter phone"})]})]})})})]})}},Ne={render:()=>{const[r,t]=c.useState(!0);return e.jsxs(e.Fragment,{children:[e.jsx(l,{onClick:()=>t(!0),children:"Open XL Modal"}),e.jsx(B,{isOpen:r,onClose:()=>t(!1),title:"Comprehensive Form",size:"xl",children:e.jsx("div",{className:"space-y-6",children:e.jsxs("div",{className:"grid grid-cols-3 gap-4",children:[e.jsxs("div",{children:[e.jsx("label",{className:"text-sm font-medium",children:"First Name"}),e.jsx(o,{placeholder:"Enter first name"})]}),e.jsxs("div",{children:[e.jsx("label",{className:"text-sm font-medium",children:"Last Name"}),e.jsx(o,{placeholder:"Enter last name"})]}),e.jsxs("div",{children:[e.jsx("label",{className:"text-sm font-medium",children:"Email"}),e.jsx(o,{placeholder:"Enter email"})]}),e.jsxs("div",{children:[e.jsx("label",{className:"text-sm font-medium",children:"Phone"}),e.jsx(o,{placeholder:"Enter phone"})]}),e.jsxs("div",{children:[e.jsx("label",{className:"text-sm font-medium",children:"Company"}),e.jsx(o,{placeholder:"Enter company"})]}),e.jsxs("div",{children:[e.jsx("label",{className:"text-sm font-medium",children:"Position"}),e.jsx(o,{placeholder:"Enter position"})]})]})})})]})}},Se={render:()=>{const[r,t]=c.useState(!0);return e.jsxs(e.Fragment,{children:[e.jsx(l,{onClick:()=>t(!0),children:"Open Modal with Footer"}),e.jsx(B,{isOpen:r,onClose:()=>t(!1),title:"Confirm Changes",description:"Are you sure you want to save these changes?",size:"md",footer:e.jsxs("div",{className:"flex gap-3 justify-end",children:[e.jsx(l,{variant:"outline",onClick:()=>t(!1),children:"Cancel"}),e.jsx(l,{variant:"primary",onClick:()=>t(!1),children:"Save Changes"})]}),children:e.jsx("p",{className:"text-sm text-gray-600",children:"All changes will be saved and cannot be undone."})})]})}},Fe={render:()=>e.jsxs(A,{className:"max-w-2xl",onSubmit:r=>{r.preventDefault(),alert("Form submitted!")},children:[e.jsxs(N,{title:"Contact Information",description:"Enter your contact details",children:[e.jsx(d,{label:"Full Name",required:!0,children:e.jsx(o,{placeholder:"Enter your full name"})}),e.jsx(d,{label:"Email",required:!0,children:e.jsx(o,{type:"email",placeholder:"Enter your email"})})]}),e.jsxs("div",{className:"flex gap-3 justify-end",children:[e.jsx(l,{variant:"outline",children:"Cancel"}),e.jsx(l,{variant:"primary",type:"submit",children:"Save"})]})]})},we={render:()=>e.jsxs(A,{className:"max-w-4xl",children:[e.jsxs(N,{title:"Account Information",description:"Basic details about the account",children:[e.jsxs(j,{columns:2,children:[e.jsx(d,{label:"Account Name",required:!0,children:e.jsx(o,{placeholder:"Enter account name"})}),e.jsx(d,{label:"Account Type",required:!0,children:e.jsxs(ke,{children:[e.jsx(Ae,{children:e.jsx(Be,{placeholder:"Select type"})}),e.jsxs(qe,{children:[e.jsx(v,{value:"enterprise",children:"Enterprise"}),e.jsx(v,{value:"mid-market",children:"Mid-Market"}),e.jsx(v,{value:"smb",children:"SMB"})]})]})})]}),e.jsx(j,{columns:1,children:e.jsx(d,{label:"Description",children:e.jsx(o,{placeholder:"Enter description"})})})]}),e.jsxs("div",{className:"flex gap-3 justify-end",children:[e.jsx(l,{variant:"outline",children:"Cancel"}),e.jsx(l,{variant:"primary",children:"Save"})]})]})},Ce={render:()=>e.jsxs(A,{className:"max-w-4xl",children:[e.jsxs(N,{title:"Contact Details",description:"Contact information for the account",children:[e.jsxs(j,{columns:3,children:[e.jsx(d,{label:"First Name",required:!0,children:e.jsx(o,{placeholder:"Enter first name"})}),e.jsx(d,{label:"Last Name",required:!0,children:e.jsx(o,{placeholder:"Enter last name"})}),e.jsx(d,{label:"Email",required:!0,children:e.jsx(o,{type:"email",placeholder:"Enter email"})})]}),e.jsxs(j,{columns:3,children:[e.jsx(d,{label:"Phone",children:e.jsx(o,{placeholder:"Enter phone"})}),e.jsx(d,{label:"Title",children:e.jsx(o,{placeholder:"Enter title"})}),e.jsx(d,{label:"Department",children:e.jsx(o,{placeholder:"Enter department"})})]})]}),e.jsxs("div",{className:"flex gap-3 justify-end",children:[e.jsx(l,{variant:"outline",children:"Cancel"}),e.jsx(l,{variant:"primary",children:"Save"})]})]})},Te={render:()=>e.jsxs(A,{className:"max-w-4xl",children:[e.jsx(N,{title:"Company Information",description:"Details about your company",children:e.jsxs(j,{columns:2,children:[e.jsx(d,{label:"Company Name",required:!0,children:e.jsx(o,{placeholder:"Enter company name"})}),e.jsx(d,{label:"Industry",required:!0,children:e.jsx(o,{placeholder:"Enter industry"})})]})}),e.jsx(N,{title:"Contact Information",description:"Primary contact details",children:e.jsxs(j,{columns:2,children:[e.jsx(d,{label:"Email",required:!0,children:e.jsx(o,{type:"email",placeholder:"Enter email"})}),e.jsx(d,{label:"Phone",required:!0,children:e.jsx(o,{placeholder:"Enter phone"})})]})}),e.jsxs(N,{title:"Address",description:"Company location",children:[e.jsx(j,{columns:1,children:e.jsx(d,{label:"Street Address",required:!0,children:e.jsx(o,{placeholder:"Enter street address"})})}),e.jsxs(j,{columns:3,children:[e.jsx(d,{label:"City",required:!0,children:e.jsx(o,{placeholder:"Enter city"})}),e.jsx(d,{label:"State",required:!0,children:e.jsx(o,{placeholder:"Enter state"})}),e.jsx(d,{label:"ZIP Code",required:!0,children:e.jsx(o,{placeholder:"Enter ZIP code"})})]})]}),e.jsxs("div",{className:"flex gap-3 justify-end",children:[e.jsx(l,{variant:"outline",children:"Cancel"}),e.jsx(l,{variant:"primary",children:"Save Changes"})]})]})},Ie={render:()=>{const[r,t]=c.useState({}),a=n=>{n.preventDefault(),t({email:"This email is already in use",phone:"Invalid phone number format"})};return e.jsxs(A,{className:"max-w-2xl",onSubmit:a,children:[e.jsxs(N,{title:"Account Details",children:[e.jsx(d,{label:"Email",required:!0,error:r.email,children:e.jsx(o,{type:"email",placeholder:"Enter email",className:r.email?"border-red-500":""})}),e.jsx(d,{label:"Phone",required:!0,error:r.phone,children:e.jsx(o,{placeholder:"Enter phone",className:r.phone?"border-red-500":""})}),e.jsx(d,{label:"Company Website",hint:"Optional - include https://",children:e.jsx(o,{placeholder:"https://example.com"})})]}),e.jsxs("div",{className:"flex gap-3 justify-end",children:[e.jsx(l,{variant:"outline",children:"Cancel"}),e.jsx(l,{variant:"primary",type:"submit",children:"Submit"})]})]})}},Re={render:()=>e.jsxs(A,{className:"max-w-4xl",children:[e.jsxs(N,{title:"Personal Information",description:"Tell us about yourself",children:[e.jsxs(j,{columns:2,children:[e.jsx(d,{label:"First Name",required:!0,children:e.jsx(o,{placeholder:"John"})}),e.jsx(d,{label:"Last Name",required:!0,children:e.jsx(o,{placeholder:"Doe"})})]}),e.jsx(d,{label:"Email",required:!0,hint:"We'll use this to contact you",children:e.jsx(o,{type:"email",placeholder:"john@example.com"})})]}),e.jsxs(N,{title:"Professional Details",description:"Information about your role",children:[e.jsxs(j,{columns:3,children:[e.jsx(d,{label:"Company",required:!0,children:e.jsx(o,{placeholder:"Your Company"})}),e.jsx(d,{label:"Position",required:!0,children:e.jsx(o,{placeholder:"Your Position"})}),e.jsx(d,{label:"Phone",children:e.jsx(o,{placeholder:"(555) 123-4567"})})]}),e.jsxs(j,{columns:2,children:[e.jsx(d,{label:"Industry",required:!0,children:e.jsxs(ke,{children:[e.jsx(Ae,{children:e.jsx(Be,{placeholder:"Select industry"})}),e.jsxs(qe,{children:[e.jsx(v,{value:"tech",children:"Technology"}),e.jsx(v,{value:"finance",children:"Finance"}),e.jsx(v,{value:"healthcare",children:"Healthcare"}),e.jsx(v,{value:"other",children:"Other"})]})]})}),e.jsx(d,{label:"Company Size",children:e.jsxs(ke,{children:[e.jsx(Ae,{children:e.jsx(Be,{placeholder:"Select size"})}),e.jsxs(qe,{children:[e.jsx(v,{value:"1-10",children:"1-10 employees"}),e.jsx(v,{value:"11-50",children:"11-50 employees"}),e.jsx(v,{value:"51-200",children:"51-200 employees"}),e.jsx(v,{value:"200+",children:"200+ employees"})]})]})})]})]}),e.jsxs(N,{title:"Address",description:"Your location information",children:[e.jsx(j,{columns:1,children:e.jsx(d,{label:"Street Address",required:!0,children:e.jsx(o,{placeholder:"123 Main St"})})}),e.jsxs(j,{columns:3,children:[e.jsx(d,{label:"City",required:!0,children:e.jsx(o,{placeholder:"San Francisco"})}),e.jsx(d,{label:"State/Province",required:!0,children:e.jsx(o,{placeholder:"California"})}),e.jsx(d,{label:"ZIP Code",required:!0,children:e.jsx(o,{placeholder:"94102"})})]})]}),e.jsxs("div",{className:"flex gap-3 justify-end pt-4",children:[e.jsx(l,{variant:"outline",children:"Cancel"}),e.jsx(l,{variant:"primary",type:"submit",children:"Create Account"})]})]})};var Je,Qe,er;L.parameters={...L.parameters,docs:{...(Je=L.parameters)==null?void 0:Je.docs,source:{originalSource:`{
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
}`,...(er=(Qe=L.parameters)==null?void 0:Qe.docs)==null?void 0:er.source}}};var rr,tr,ar;W.parameters={...W.parameters,docs:{...(rr=W.parameters)==null?void 0:rr.docs,source:{originalSource:`{
  render: () => {
    const [sortBy, setSortBy] = useState<string>('name');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    return <EnterpriseTable columns={[{
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
    }]} data={mockAccounts} rowKey={row => row.id} sortBy={sortBy} sortOrder={sortOrder} onSort={(key, order) => {
      setSortBy(key);
      setSortOrder(order);
    }} />;
  }
}`,...(ar=(tr=W.parameters)==null?void 0:tr.docs)==null?void 0:ar.source}}};var nr,sr,ir;z.parameters={...z.parameters,docs:{...(nr=z.parameters)==null?void 0:nr.docs,source:{originalSource:`{
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
}`,...(ir=(sr=z.parameters)==null?void 0:sr.docs)==null?void 0:ir.source}}};var or,lr,cr;H.parameters={...H.parameters,docs:{...(or=H.parameters)==null?void 0:or.docs,source:{originalSource:`{
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
}`,...(cr=(lr=H.parameters)==null?void 0:lr.docs)==null?void 0:cr.source}}};var dr,mr,ur;$.parameters={...$.parameters,docs:{...(dr=$.parameters)==null?void 0:dr.docs,source:{originalSource:`{
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
}`,...(ur=(mr=$.parameters)==null?void 0:mr.docs)==null?void 0:ur.source}}};var pr,hr,xr;V.parameters={...V.parameters,docs:{...(pr=V.parameters)==null?void 0:pr.docs,source:{originalSource:`{
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
}`,...(xr=(hr=V.parameters)==null?void 0:hr.docs)==null?void 0:xr.source}}};var yr,gr,fr;G.parameters={...G.parameters,docs:{...(yr=G.parameters)==null?void 0:yr.docs,source:{originalSource:`{
  render: () => {
    const [selectedRow, setSelectedRow] = useState<Account | null>(null);
    return <div className="space-y-4">
        <EnterpriseTable columns={[{
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
      }]} data={mockAccounts} rowKey={row => row.id} onRowClick={row => setSelectedRow(row)} />
        {selectedRow && <div className="p-4 border border-gray-200 rounded-lg bg-blue-50">
            <p className="text-sm font-medium">Selected: {selectedRow.name}</p>
          </div>}
      </div>;
  }
}`,...(fr=(gr=G.parameters)==null?void 0:gr.docs)==null?void 0:fr.source}}};var br,vr,jr;K.parameters={...K.parameters,docs:{...(br=K.parameters)==null?void 0:br.docs,source:{originalSource:`{
  render: () => <EnterpriseCard variant="default">
      <p className="text-sm text-gray-600">
        This is a default card with simple content and a subtle shadow.
      </p>
    </EnterpriseCard>
}`,...(jr=(vr=K.parameters)==null?void 0:vr.docs)==null?void 0:jr.source}}};var Er,Nr,Sr;Y.parameters={...Y.parameters,docs:{...(Er=Y.parameters)==null?void 0:Er.docs,source:{originalSource:`{
  render: () => <EnterpriseCard title="Account Overview" description="Key metrics and status" icon={<Settings className="w-5 h-5" />} variant="default">
      <p className="text-sm text-gray-600">
        Display important account information and metrics.
      </p>
    </EnterpriseCard>
}`,...(Sr=(Nr=Y.parameters)==null?void 0:Nr.docs)==null?void 0:Sr.source}}};var Fr,wr,Cr;Z.parameters={...Z.parameters,docs:{...(Fr=Z.parameters)==null?void 0:Fr.docs,source:{originalSource:`{
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
}`,...(Cr=(wr=Z.parameters)==null?void 0:wr.docs)==null?void 0:Cr.source}}};var Tr,Ir,Rr;U.parameters={...U.parameters,docs:{...(Tr=U.parameters)==null?void 0:Tr.docs,source:{originalSource:`{
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
}`,...(Rr=(Ir=U.parameters)==null?void 0:Ir.docs)==null?void 0:Rr.source}}};var kr,Ar,Br;X.parameters={...X.parameters,docs:{...(kr=X.parameters)==null?void 0:kr.docs,source:{originalSource:`{
  render: () => <EnterpriseCard title="Outlined Card" description="Minimal styling" variant="outlined">
      <p className="text-sm text-gray-600">
        This is an outlined card with minimal styling.
      </p>
    </EnterpriseCard>
}`,...(Br=(Ar=X.parameters)==null?void 0:Ar.docs)==null?void 0:Br.source}}};var qr,Dr,Or;J.parameters={...J.parameters,docs:{...(qr=J.parameters)==null?void 0:qr.docs,source:{originalSource:`{
  render: () => <EnterpriseCard title="Elevated Card" description="Enhanced shadow" variant="elevated">
      <p className="text-sm text-gray-600">
        This card has an elevated appearance with a stronger shadow.
      </p>
    </EnterpriseCard>
}`,...(Or=(Dr=J.parameters)==null?void 0:Dr.docs)==null?void 0:Or.source}}};var Mr,_r,Pr;Q.parameters={...Q.parameters,docs:{...(Mr=Q.parameters)==null?void 0:Mr.docs,source:{originalSource:`{
  render: () => {
    const [clicked, setClicked] = useState(false);
    return <EnterpriseCard title="Clickable Card" clickable={true} onClick={() => setClicked(!clicked)} className={clicked ? 'border-blue-500' : ''}>
        <p className="text-sm text-gray-600">
          Click this card to interact with it
        </p>
        {clicked && <p className="text-xs text-blue-600 mt-3">Card was clicked!</p>}
      </EnterpriseCard>;
  }
}`,...(Pr=(_r=Q.parameters)==null?void 0:_r.docs)==null?void 0:Pr.source}}};var Lr,Wr,zr;ee.parameters={...ee.parameters,docs:{...(Lr=ee.parameters)==null?void 0:Lr.docs,source:{originalSource:`{
  render: () => <EnterpriseHeader title="Acme Corporation" icon={<Settings className="w-6 h-6 text-gray-600" />} variant="default" />
}`,...(zr=(Wr=ee.parameters)==null?void 0:Wr.docs)==null?void 0:zr.source}}};var Hr,$r,Vr;re.parameters={...re.parameters,docs:{...(Hr=re.parameters)==null?void 0:Hr.docs,source:{originalSource:`{
  render: () => <EnterpriseHeader title="Account Details" subtitle="Acme Corporation" description="Enterprise account with full service package" icon={<Settings className="w-6 h-6 text-gray-600" />} variant="default" />
}`,...(Vr=($r=re.parameters)==null?void 0:$r.docs)==null?void 0:Vr.source}}};var Gr,Kr,Yr;te.parameters={...te.parameters,docs:{...(Gr=te.parameters)==null?void 0:Gr.docs,source:{originalSource:`{
  render: () => <EnterpriseHeader title="Account Status" subtitle="Acme Corporation" icon={<Settings className="w-6 h-6 text-gray-600" />} status={<div className="flex items-center gap-2 px-3 py-1 bg-green-50 border border-green-200 rounded-full">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <span className="text-xs font-medium text-green-700">Active</span>
        </div>} variant="default" />
}`,...(Yr=(Kr=te.parameters)==null?void 0:Kr.docs)==null?void 0:Yr.source}}};var Zr,Ur,Xr;ae.parameters={...ae.parameters,docs:{...(Zr=ae.parameters)==null?void 0:Zr.docs,source:{originalSource:`{
  render: () => <EnterpriseHeader title="Account Dashboard" subtitle="Acme Corporation" icon={<Settings className="w-6 h-6 text-gray-600" />} actions={<div className="flex gap-2">
          <button className="px-3 py-2 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50">
            Edit
          </button>
          <button className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
            Save
          </button>
        </div>} variant="default" />
}`,...(Xr=(Ur=ae.parameters)==null?void 0:Ur.docs)==null?void 0:Xr.source}}};var Jr,Qr,et;ne.parameters={...ne.parameters,docs:{...(Jr=ne.parameters)==null?void 0:Jr.docs,source:{originalSource:`{
  render: () => <EnterpriseHeader title="Compact Header" subtitle="Sub heading" variant="compact" />
}`,...(et=(Qr=ne.parameters)==null?void 0:Qr.docs)==null?void 0:et.source}}};var rt,tt,at;se.parameters={...se.parameters,docs:{...(rt=se.parameters)==null?void 0:rt.docs,source:{originalSource:`{
  render: () => <EnterpriseHeader title="Large Header" subtitle="Sub heading" description="With full description and plenty of space" variant="large" />
}`,...(at=(tt=se.parameters)==null?void 0:tt.docs)==null?void 0:at.source}}};var nt,st,it;ie.parameters={...ie.parameters,docs:{...(nt=ie.parameters)==null?void 0:nt.docs,source:{originalSource:`{
  render: () => <EnterpriseButton variant="primary">Primary Button</EnterpriseButton>
}`,...(it=(st=ie.parameters)==null?void 0:st.docs)==null?void 0:it.source}}};var ot,lt,ct;oe.parameters={...oe.parameters,docs:{...(ot=oe.parameters)==null?void 0:ot.docs,source:{originalSource:`{
  render: () => <EnterpriseButton variant="secondary">Secondary Button</EnterpriseButton>
}`,...(ct=(lt=oe.parameters)==null?void 0:lt.docs)==null?void 0:ct.source}}};var dt,mt,ut;le.parameters={...le.parameters,docs:{...(dt=le.parameters)==null?void 0:dt.docs,source:{originalSource:`{
  render: () => <EnterpriseButton variant="destructive">Delete</EnterpriseButton>
}`,...(ut=(mt=le.parameters)==null?void 0:mt.docs)==null?void 0:ut.source}}};var pt,ht,xt;ce.parameters={...ce.parameters,docs:{...(pt=ce.parameters)==null?void 0:pt.docs,source:{originalSource:`{
  render: () => <EnterpriseButton variant="ghost">Ghost Button</EnterpriseButton>
}`,...(xt=(ht=ce.parameters)==null?void 0:ht.docs)==null?void 0:xt.source}}};var yt,gt,ft;de.parameters={...de.parameters,docs:{...(yt=de.parameters)==null?void 0:yt.docs,source:{originalSource:`{
  render: () => <EnterpriseButton variant="outline">Outline Button</EnterpriseButton>
}`,...(ft=(gt=de.parameters)==null?void 0:gt.docs)==null?void 0:ft.source}}};var bt,vt,jt;me.parameters={...me.parameters,docs:{...(bt=me.parameters)==null?void 0:bt.docs,source:{originalSource:`{
  render: () => <EnterpriseButton variant="primary" size="sm">
      Small Button
    </EnterpriseButton>
}`,...(jt=(vt=me.parameters)==null?void 0:vt.docs)==null?void 0:jt.source}}};var Et,Nt,St;ue.parameters={...ue.parameters,docs:{...(Et=ue.parameters)==null?void 0:Et.docs,source:{originalSource:`{
  render: () => <EnterpriseButton variant="primary" size="md">
      Medium Button
    </EnterpriseButton>
}`,...(St=(Nt=ue.parameters)==null?void 0:Nt.docs)==null?void 0:St.source}}};var Ft,wt,Ct;pe.parameters={...pe.parameters,docs:{...(Ft=pe.parameters)==null?void 0:Ft.docs,source:{originalSource:`{
  render: () => <EnterpriseButton variant="primary" size="lg">
      Large Button
    </EnterpriseButton>
}`,...(Ct=(wt=pe.parameters)==null?void 0:wt.docs)==null?void 0:Ct.source}}};var Tt,It,Rt;he.parameters={...he.parameters,docs:{...(Tt=he.parameters)==null?void 0:Tt.docs,source:{originalSource:`{
  render: () => <EnterpriseButton variant="primary" icon={<Plus className="w-4 h-4" />} iconPosition="left">
      Add New
    </EnterpriseButton>
}`,...(Rt=(It=he.parameters)==null?void 0:It.docs)==null?void 0:Rt.source}}};var kt,At,Bt;xe.parameters={...xe.parameters,docs:{...(kt=xe.parameters)==null?void 0:kt.docs,source:{originalSource:`{
  render: () => <EnterpriseButton variant="primary" icon={<Plus className="w-4 h-4" />} iconPosition="right">
      Add New
    </EnterpriseButton>
}`,...(Bt=(At=xe.parameters)==null?void 0:At.docs)==null?void 0:Bt.source}}};var qt,Dt,Ot;ye.parameters={...ye.parameters,docs:{...(qt=ye.parameters)==null?void 0:qt.docs,source:{originalSource:`{
  render: () => <EnterpriseButton variant="primary" loading={true}>
      Processing
    </EnterpriseButton>
}`,...(Ot=(Dt=ye.parameters)==null?void 0:Dt.docs)==null?void 0:Ot.source}}};var Mt,_t,Pt;ge.parameters={...ge.parameters,docs:{...(Mt=ge.parameters)==null?void 0:Mt.docs,source:{originalSource:`{
  render: () => <EnterpriseButton variant="primary" disabled={true}>
      Disabled
    </EnterpriseButton>
}`,...(Pt=(_t=ge.parameters)==null?void 0:_t.docs)==null?void 0:Pt.source}}};var Lt,Wt,zt;fe.parameters={...fe.parameters,docs:{...(Lt=fe.parameters)==null?void 0:Lt.docs,source:{originalSource:`{
  render: () => <div className="flex flex-wrap gap-3">
      <EnterpriseButton variant="primary">Primary</EnterpriseButton>
      <EnterpriseButton variant="secondary">Secondary</EnterpriseButton>
      <EnterpriseButton variant="destructive">Destructive</EnterpriseButton>
      <EnterpriseButton variant="ghost">Ghost</EnterpriseButton>
      <EnterpriseButton variant="outline">Outline</EnterpriseButton>
    </div>
}`,...(zt=(Wt=fe.parameters)==null?void 0:Wt.docs)==null?void 0:zt.source}}};var Ht,$t,Vt;be.parameters={...be.parameters,docs:{...(Ht=be.parameters)==null?void 0:Ht.docs,source:{originalSource:`{
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
}`,...(Vt=($t=be.parameters)==null?void 0:$t.docs)==null?void 0:Vt.source}}};var Gt,Kt,Yt;ve.parameters={...ve.parameters,docs:{...(Gt=ve.parameters)==null?void 0:Gt.docs,source:{originalSource:`{
  render: () => {
    const [isOpen, setIsOpen] = useState(true);
    return <>
        <EnterpriseButton onClick={() => setIsOpen(true)}>
          Open Small Modal
        </EnterpriseButton>
        <EnterpriseModal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Confirm Action" size="sm">
          <p className="text-sm text-gray-600">
            Are you sure you want to proceed with this action?
          </p>
        </EnterpriseModal>
      </>;
  }
}`,...(Yt=(Kt=ve.parameters)==null?void 0:Kt.docs)==null?void 0:Yt.source}}};var Zt,Ut,Xt;je.parameters={...je.parameters,docs:{...(Zt=je.parameters)==null?void 0:Zt.docs,source:{originalSource:`{
  render: () => {
    const [isOpen, setIsOpen] = useState(true);
    return <>
        <EnterpriseButton onClick={() => setIsOpen(true)}>
          Open Medium Modal
        </EnterpriseButton>
        <EnterpriseModal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Create New Account" description="Fill in the details below to create a new account" size="md">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Account Name</label>
              <Input placeholder="Enter account name" />
            </div>
            <div>
              <label className="text-sm font-medium">Type</label>
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
            </div>
          </div>
        </EnterpriseModal>
      </>;
  }
}`,...(Xt=(Ut=je.parameters)==null?void 0:Ut.docs)==null?void 0:Xt.source}}};var Jt,Qt,ea;Ee.parameters={...Ee.parameters,docs:{...(Jt=Ee.parameters)==null?void 0:Jt.docs,source:{originalSource:`{
  render: () => {
    const [isOpen, setIsOpen] = useState(true);
    return <>
        <EnterpriseButton onClick={() => setIsOpen(true)}>
          Open Large Modal
        </EnterpriseButton>
        <EnterpriseModal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Account Details" description="View and edit all account information" size="lg">
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Company Name</label>
                <Input placeholder="Enter company name" />
              </div>
              <div>
                <label className="text-sm font-medium">Industry</label>
                <Input placeholder="Enter industry" />
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input placeholder="Enter email" />
              </div>
              <div>
                <label className="text-sm font-medium">Phone</label>
                <Input placeholder="Enter phone" />
              </div>
            </div>
          </div>
        </EnterpriseModal>
      </>;
  }
}`,...(ea=(Qt=Ee.parameters)==null?void 0:Qt.docs)==null?void 0:ea.source}}};var ra,ta,aa;Ne.parameters={...Ne.parameters,docs:{...(ra=Ne.parameters)==null?void 0:ra.docs,source:{originalSource:`{
  render: () => {
    const [isOpen, setIsOpen] = useState(true);
    return <>
        <EnterpriseButton onClick={() => setIsOpen(true)}>
          Open XL Modal
        </EnterpriseButton>
        <EnterpriseModal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Comprehensive Form" size="xl">
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium">First Name</label>
                <Input placeholder="Enter first name" />
              </div>
              <div>
                <label className="text-sm font-medium">Last Name</label>
                <Input placeholder="Enter last name" />
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input placeholder="Enter email" />
              </div>
              <div>
                <label className="text-sm font-medium">Phone</label>
                <Input placeholder="Enter phone" />
              </div>
              <div>
                <label className="text-sm font-medium">Company</label>
                <Input placeholder="Enter company" />
              </div>
              <div>
                <label className="text-sm font-medium">Position</label>
                <Input placeholder="Enter position" />
              </div>
            </div>
          </div>
        </EnterpriseModal>
      </>;
  }
}`,...(aa=(ta=Ne.parameters)==null?void 0:ta.docs)==null?void 0:aa.source}}};var na,sa,ia;Se.parameters={...Se.parameters,docs:{...(na=Se.parameters)==null?void 0:na.docs,source:{originalSource:`{
  render: () => {
    const [isOpen, setIsOpen] = useState(true);
    return <>
        <EnterpriseButton onClick={() => setIsOpen(true)}>
          Open Modal with Footer
        </EnterpriseButton>
        <EnterpriseModal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Confirm Changes" description="Are you sure you want to save these changes?" size="md" footer={<div className="flex gap-3 justify-end">
              <EnterpriseButton variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </EnterpriseButton>
              <EnterpriseButton variant="primary" onClick={() => setIsOpen(false)}>
                Save Changes
              </EnterpriseButton>
            </div>}>
          <p className="text-sm text-gray-600">
            All changes will be saved and cannot be undone.
          </p>
        </EnterpriseModal>
      </>;
  }
}`,...(ia=(sa=Se.parameters)==null?void 0:sa.docs)==null?void 0:ia.source}}};var oa,la,ca;Fe.parameters={...Fe.parameters,docs:{...(oa=Fe.parameters)==null?void 0:oa.docs,source:{originalSource:`{
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
}`,...(ca=(la=Fe.parameters)==null?void 0:la.docs)==null?void 0:ca.source}}};var da,ma,ua;we.parameters={...we.parameters,docs:{...(da=we.parameters)==null?void 0:da.docs,source:{originalSource:`{
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
}`,...(ua=(ma=we.parameters)==null?void 0:ma.docs)==null?void 0:ua.source}}};var pa,ha,xa;Ce.parameters={...Ce.parameters,docs:{...(pa=Ce.parameters)==null?void 0:pa.docs,source:{originalSource:`{
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
}`,...(xa=(ha=Ce.parameters)==null?void 0:ha.docs)==null?void 0:xa.source}}};var ya,ga,fa;Te.parameters={...Te.parameters,docs:{...(ya=Te.parameters)==null?void 0:ya.docs,source:{originalSource:`{
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
}`,...(fa=(ga=Te.parameters)==null?void 0:ga.docs)==null?void 0:fa.source}}};var ba,va,ja;Ie.parameters={...Ie.parameters,docs:{...(ba=Ie.parameters)==null?void 0:ba.docs,source:{originalSource:`{
  render: () => {
    const [errors, setErrors] = useState<Record<string, string>>({});
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setErrors({
        email: 'This email is already in use',
        phone: 'Invalid phone number format'
      });
    };
    return <EnterpriseForm className="max-w-2xl" onSubmit={handleSubmit}>
        <EnterpriseFormSection title="Account Details">
          <EnterpriseFormField label="Email" required error={errors.email}>
            <Input type="email" placeholder="Enter email" className={errors.email ? 'border-red-500' : ''} />
          </EnterpriseFormField>

          <EnterpriseFormField label="Phone" required error={errors.phone}>
            <Input placeholder="Enter phone" className={errors.phone ? 'border-red-500' : ''} />
          </EnterpriseFormField>

          <EnterpriseFormField label="Company Website" hint="Optional - include https://">
            <Input placeholder="https://example.com" />
          </EnterpriseFormField>
        </EnterpriseFormSection>

        <div className="flex gap-3 justify-end">
          <EnterpriseButton variant="outline">Cancel</EnterpriseButton>
          <EnterpriseButton variant="primary" type="submit">
            Submit
          </EnterpriseButton>
        </div>
      </EnterpriseForm>;
  }
}`,...(ja=(va=Ie.parameters)==null?void 0:va.docs)==null?void 0:ja.source}}};var Ea,Na,Sa;Re.parameters={...Re.parameters,docs:{...(Ea=Re.parameters)==null?void 0:Ea.docs,source:{originalSource:`{
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
}`,...(Sa=(Na=Re.parameters)==null?void 0:Na.docs)==null?void 0:Sa.source}}};const os=["TableBasic","TableWithSorting","TableLoading","TableEmptyState","TableStriped","TableNoStriped","TableWithRowClick","CardDefault","CardWithHeader","CardWithActions","CardWithFooter","CardOutlined","CardElevated","CardClickable","HeaderDefault","HeaderWithSubtitle","HeaderWithStatus","HeaderWithActions","HeaderCompact","HeaderLarge","ButtonPrimary","ButtonSecondary","ButtonDestructive","ButtonGhost","ButtonOutline","ButtonSmall","ButtonMedium","ButtonLarge","ButtonWithIconLeft","ButtonWithIconRight","ButtonLoading","ButtonDisabled","ButtonAllVariants","ButtonAllSizes","ModalSmall","ModalMedium","ModalLarge","ModalExtraLarge","ModalWithFooter","FormBasic","FormTwoColumn","FormThreeColumn","FormMultipleSections","FormWithValidation","FormComplex"];export{be as ButtonAllSizes,fe as ButtonAllVariants,le as ButtonDestructive,ge as ButtonDisabled,ce as ButtonGhost,pe as ButtonLarge,ye as ButtonLoading,ue as ButtonMedium,de as ButtonOutline,ie as ButtonPrimary,oe as ButtonSecondary,me as ButtonSmall,he as ButtonWithIconLeft,xe as ButtonWithIconRight,Q as CardClickable,K as CardDefault,J as CardElevated,X as CardOutlined,Z as CardWithActions,U as CardWithFooter,Y as CardWithHeader,Fe as FormBasic,Re as FormComplex,Te as FormMultipleSections,Ce as FormThreeColumn,we as FormTwoColumn,Ie as FormWithValidation,ne as HeaderCompact,ee as HeaderDefault,se as HeaderLarge,ae as HeaderWithActions,te as HeaderWithStatus,re as HeaderWithSubtitle,Ne as ModalExtraLarge,Ee as ModalLarge,je as ModalMedium,ve as ModalSmall,Se as ModalWithFooter,L as TableBasic,H as TableEmptyState,z as TableLoading,V as TableNoStriped,$ as TableStriped,G as TableWithRowClick,W as TableWithSorting,os as __namedExportsOrder,is as default};

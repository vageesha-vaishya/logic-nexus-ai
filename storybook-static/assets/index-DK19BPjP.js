import{c as d}from"./createLucideIcon-DapQ2WKf.js";import{r as s,a as h}from"./index-B2-qRKKC.js";import{u as C}from"./index-DRfMV7qj.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const k=d("ChevronDown",[["path",{d:"m6 9 6 6 6-6",key:"qrunsl"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const D=d("ChevronUp",[["path",{d:"m18 15-6-6-6 6",key:"153udz"}]]);var w=h[" useInsertionEffect ".trim().toString()]||C;function I({prop:o,defaultProp:u,onChange:t=()=>{},caller:i}){const[l,e,n]=E({defaultProp:u,onChange:t}),r=o!==void 0,m=r?o:l;{const c=s.useRef(o!==void 0);s.useEffect(()=>{const f=c.current;f!==r&&console.warn(`${i} is changing from ${f?"controlled":"uncontrolled"} to ${r?"controlled":"uncontrolled"}. Components should not switch from controlled to uncontrolled (or vice versa). Decide between using a controlled or uncontrolled value for the lifetime of the component.`),c.current=r},[r,i])}const v=s.useCallback(c=>{var f;if(r){const a=p(c)?c(o):c;a!==o&&((f=n.current)==null||f.call(n,a))}else e(c)},[r,o,e,n]);return[m,v]}function E({defaultProp:o,onChange:u}){const[t,i]=s.useState(o),l=s.useRef(t),e=s.useRef(u);return w(()=>{e.current=u},[u]),s.useEffect(()=>{var n;l.current!==t&&((n=e.current)==null||n.call(e,t),l.current=t)},[t,l]),[t,i,e]}function p(o){return typeof o=="function"}export{D as C,k as a,I as u};

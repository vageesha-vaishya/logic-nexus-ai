import{c as _}from"./createLucideIcon-DapQ2WKf.js";import{r as u,a as F}from"./index-B2-qRKKC.js";import"./index-CFX93qP1.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const tt=_("Maximize2",[["polyline",{points:"15 3 21 3 21 9",key:"mznyad"}],["polyline",{points:"9 21 3 21 3 15",key:"1avn1i"}],["line",{x1:"21",x2:"14",y1:"3",y2:"10",key:"ota7mn"}],["line",{x1:"3",x2:"10",y1:"21",y2:"14",key:"1atl0r"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const et=_("Minimize2",[["polyline",{points:"4 14 10 14 10 20",key:"11kfnr"}],["polyline",{points:"20 10 14 10 14 4",key:"rlmsce"}],["line",{x1:"14",x2:"21",y1:"10",y2:"3",key:"o5lafz"}],["line",{x1:"3",x2:"10",y1:"21",y2:"14",key:"1atl0r"}]]);/**
 * @remix-run/router v1.23.0
 *
 * Copyright (c) Remix Software Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.md file in the root directory of this source tree.
 *
 * @license MIT
 */function P(){return P=Object.assign?Object.assign.bind():function(t){for(var e=1;e<arguments.length;e++){var r=arguments[e];for(var n in r)Object.prototype.hasOwnProperty.call(r,n)&&(t[n]=r[n])}return t},P.apply(this,arguments)}var m;(function(t){t.Pop="POP",t.Push="PUSH",t.Replace="REPLACE"})(m||(m={}));const L="popstate";function V(t){t===void 0&&(t={});function e(n,i){let{pathname:h,search:o,hash:s}=n.location;return C("",{pathname:h,search:o,hash:s},i.state&&i.state.usr||null,i.state&&i.state.key||"default")}function r(n,i){return typeof i=="string"?i:k(i)}return W(e,r,null,t)}function A(t,e){if(t===!1||t===null||typeof t>"u")throw new Error(e)}function N(){return Math.random().toString(36).substr(2,8)}function O(t,e){return{usr:t.state,key:t.key,idx:e}}function C(t,e,r,n){return r===void 0&&(r=null),P({pathname:typeof t=="string"?t:t.pathname,search:"",hash:""},typeof e=="string"?B(e):e,{state:r,key:e&&e.key||n||N()})}function k(t){let{pathname:e="/",search:r="",hash:n=""}=t;return r&&r!=="?"&&(e+=r.charAt(0)==="?"?r:"?"+r),n&&n!=="#"&&(e+=n.charAt(0)==="#"?n:"#"+n),e}function B(t){let e={};if(t){let r=t.indexOf("#");r>=0&&(e.hash=t.substr(r),t=t.substr(0,r));let n=t.indexOf("?");n>=0&&(e.search=t.substr(n),t=t.substr(0,n)),t&&(e.pathname=t)}return e}function W(t,e,r,n){n===void 0&&(n={});let{window:i=document.defaultView,v5Compat:h=!1}=n,o=i.history,s=m.Pop,l=null,c=p();c==null&&(c=0,o.replaceState(P({},o.state,{idx:c}),""));function p(){return(o.state||{idx:null}).idx}function v(){s=m.Pop;let a=p(),f=a==null?null:a-c;c=a,l&&l({action:s,location:d.location,delta:f})}function x(a,f){s=m.Push;let y=C(d.location,a,f);c=p()+1;let b=O(y,c),S=d.createHref(y);try{o.pushState(b,"",S)}catch(E){if(E instanceof DOMException&&E.name==="DataCloneError")throw E;i.location.assign(S)}h&&l&&l({action:s,location:d.location,delta:1})}function w(a,f){s=m.Replace;let y=C(d.location,a,f);c=p();let b=O(y,c),S=d.createHref(y);o.replaceState(b,"",S),h&&l&&l({action:s,location:d.location,delta:0})}function g(a){let f=i.location.origin!=="null"?i.location.origin:i.location.href,y=typeof a=="string"?a:k(a);return y=y.replace(/ $/,"%20"),A(f,"No window.location.(origin|href) available to create URL for href: "+y),new URL(y,f)}let d={get action(){return s},get location(){return t(i,o)},listen(a){if(l)throw new Error("A history only accepts one active listener");return i.addEventListener(L,v),l=a,()=>{i.removeEventListener(L,v),l=null}},createHref(a){return e(i,a)},createURL:g,encodeLocation(a){let f=g(a);return{pathname:f.pathname,search:f.search,hash:f.hash}},push:x,replace:w,go(a){return o.go(a)}};return d}var T;(function(t){t.data="data",t.deferred="deferred",t.redirect="redirect",t.error="error"})(T||(T={}));function H(t,e){if(e==="/")return t;if(!t.toLowerCase().startsWith(e.toLowerCase()))return null;let r=e.endsWith("/")?e.length-1:e.length,n=t.charAt(r);return n&&n!=="/"?null:t.slice(r)||"/"}const j=["post","put","patch","delete"];new Set(j);const $=["get",...j];new Set($);/**
 * React Router v6.30.1
 *
 * Copyright (c) Remix Software Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.md file in the root directory of this source tree.
 *
 * @license MIT
 */function R(){return R=Object.assign?Object.assign.bind():function(t){for(var e=1;e<arguments.length;e++){var r=arguments[e];for(var n in r)Object.prototype.hasOwnProperty.call(r,n)&&(t[n]=r[n])}return t},R.apply(this,arguments)}const q=u.createContext(null),z=u.createContext(null);function K(){return u.useContext(z)!=null}function G(t,e){t==null||t.v7_startTransition,t==null||t.v7_relativeSplatPath}function J(t){let{basename:e="/",children:r=null,location:n,navigationType:i=m.Pop,navigator:h,static:o=!1,future:s}=t;K()&&A(!1);let l=e.replace(/^\/*/,"/"),c=u.useMemo(()=>({basename:l,navigator:h,static:o,future:R({v7_relativeSplatPath:!1},s)}),[l,s,h,o]);typeof n=="string"&&(n=B(n));let{pathname:p="/",search:v="",hash:x="",state:w=null,key:g="default"}=n,d=u.useMemo(()=>{let a=H(p,l);return a==null?null:{location:{pathname:a,search:v,hash:x,state:w,key:g},navigationType:i}},[l,p,v,x,w,g,i]);return d==null?null:u.createElement(q.Provider,{value:c},u.createElement(z.Provider,{children:r,value:d}))}new Promise(()=>{});/**
 * React Router DOM v6.30.1
 *
 * Copyright (c) Remix Software Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.md file in the root directory of this source tree.
 *
 * @license MIT
 */const Q="6";try{window.__reactRouterVersion=Q}catch{}const X="startTransition",U=F[X];function nt(t){let{basename:e,children:r,future:n,window:i}=t,h=u.useRef();h.current==null&&(h.current=V({window:i,v5Compat:!0}));let o=h.current,[s,l]=u.useState({action:o.action,location:o.location}),{v7_startTransition:c}=n||{},p=u.useCallback(v=>{c&&U?U(()=>l(v)):l(v)},[l,c]);return u.useLayoutEffect(()=>o.listen(p),[o,p]),u.useEffect(()=>G(n),[n]),u.createElement(J,{basename:e,children:r,location:s.location,navigationType:s.action,navigator:o,future:n})}var I;(function(t){t.UseScrollRestoration="useScrollRestoration",t.UseSubmit="useSubmit",t.UseSubmitFetcher="useSubmitFetcher",t.UseFetcher="useFetcher",t.useViewTransitionState="useViewTransitionState"})(I||(I={}));var M;(function(t){t.UseFetcher="useFetcher",t.UseFetchers="useFetchers",t.UseScrollRestoration="useScrollRestoration"})(M||(M={}));export{nt as B,et as M,tt as a};

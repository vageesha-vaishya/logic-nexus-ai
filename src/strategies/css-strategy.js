const STYLE_PREFIX = '--dx-strip';

const ensureStyleTag = (ownerDocument, scopeId) => {
  const id = `diagonal-strip-style-${scopeId}`;
  let style = ownerDocument.getElementById(id);
  if (!style) {
    style = ownerDocument.createElement('style');
    style.id = id;
    style.textContent = `
[data-diagonal-strip-id="${scopeId}"]{position:relative;isolation:isolate}
[data-diagonal-strip-id="${scopeId}"] .diagonal-strip-host{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:var(${STYLE_PREFIX}-z-index);contain:layout paint style}
[data-diagonal-strip-id="${scopeId}"] .diagonal-strip-host::before{content:"";position:absolute;left:0;top:0;width:calc(100% + var(${STYLE_PREFIX}-comp-x,0px));height:calc(100% + var(${STYLE_PREFIX}-comp-y,0px));transform-origin:0 0;transform:skewY(var(${STYLE_PREFIX}-angle));background-image:linear-gradient(to bottom,var(${STYLE_PREFIX}-color) 0%,var(${STYLE_PREFIX}-color) var(${STYLE_PREFIX}-width),transparent calc(var(${STYLE_PREFIX}-width) + 0.5px),transparent 100%);opacity:var(${STYLE_PREFIX}-opacity);will-change:transform,opacity;background-repeat:no-repeat}
[data-diagonal-strip-id="${scopeId}"] .diagonal-strip-host[data-strategy="svg"]::before{content:none}
`;
    ownerDocument.head.appendChild(style);
  }
  return style;
};

export class CssStrategy {
  constructor(container, host, scopeId) {
    this.container = container;
    this.host = host;
    this.scopeId = scopeId;
    this.ownerDocument = container.ownerDocument;
    this.styleTag = ensureStyleTag(this.ownerDocument, scopeId);
    this.host.dataset.strategy = 'css';
  }

  apply(computed) {
    const style = this.container.style;
    style.setProperty(`${STYLE_PREFIX}-angle`, `${computed.angleDeg}deg`);
    style.setProperty(`${STYLE_PREFIX}-width`, computed.stripWidthCss);
    style.setProperty(`${STYLE_PREFIX}-color`, computed.color);
    style.setProperty(`${STYLE_PREFIX}-opacity`, `${computed.opacity}`);
    style.setProperty(`${STYLE_PREFIX}-comp-x`, `${computed.compX}px`);
    style.setProperty(`${STYLE_PREFIX}-comp-y`, `${computed.compY}px`);
    style.setProperty(`${STYLE_PREFIX}-z-index`, `${computed.zIndex}`);
    this.host.dataset.strategy = 'css';
  }

  destroy() {
    if (this.styleTag && this.styleTag.parentNode) {
      this.styleTag.parentNode.removeChild(this.styleTag);
    }
  }
}

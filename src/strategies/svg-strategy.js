const SVG_NS = 'http://www.w3.org/2000/svg';

const createSvg = (ownerDocument, scopeId) => {
  const svg = ownerDocument.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('role', 'presentation');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.dataset.diagonalSvg = scopeId;
  svg.style.position = 'absolute';
  svg.style.inset = '0';
  svg.style.pointerEvents = 'none';

  const defs = ownerDocument.createElementNS(SVG_NS, 'defs');
  const gradient = ownerDocument.createElementNS(SVG_NS, 'linearGradient');
  gradient.id = `diagonal-strip-gradient-${scopeId}`;
  gradient.setAttribute('x1', '0%');
  gradient.setAttribute('y1', '0%');
  gradient.setAttribute('x2', '100%');
  gradient.setAttribute('y2', '0%');

  const stop1 = ownerDocument.createElementNS(SVG_NS, 'stop');
  stop1.setAttribute('offset', '0%');
  stop1.dataset.stop = 'start';
  const stop2 = ownerDocument.createElementNS(SVG_NS, 'stop');
  stop2.setAttribute('offset', '100%');
  stop2.dataset.stop = 'end';
  gradient.appendChild(stop1);
  gradient.appendChild(stop2);
  defs.appendChild(gradient);

  const pattern = ownerDocument.createElementNS(SVG_NS, 'pattern');
  pattern.id = `diagonal-strip-pattern-${scopeId}`;
  pattern.setAttribute('patternUnits', 'userSpaceOnUse');
  pattern.setAttribute('width', '100');
  pattern.setAttribute('height', '100');

  const patternRect = ownerDocument.createElementNS(SVG_NS, 'rect');
  patternRect.setAttribute('x', '0');
  patternRect.setAttribute('y', '0');
  patternRect.setAttribute('width', '100');
  patternRect.setAttribute('height', '100');
  patternRect.setAttribute('fill', `url(#${gradient.id})`);
  pattern.appendChild(patternRect);
  defs.appendChild(pattern);
  svg.appendChild(defs);

  const rect = ownerDocument.createElementNS(SVG_NS, 'rect');
  rect.setAttribute('x', '0');
  rect.setAttribute('y', '0');
  rect.setAttribute('width', '100');
  rect.setAttribute('height', '100');
  rect.setAttribute('fill', `url(#${pattern.id})`);
  rect.dataset.stripRect = 'true';
  svg.appendChild(rect);

  return { svg, gradient, stop1, stop2, rect, pattern };
};

export class SvgStrategy {
  constructor(container, host, scopeId) {
    this.container = container;
    this.host = host;
    this.scopeId = scopeId;
    this.ownerDocument = container.ownerDocument;
    this.svgParts = createSvg(this.ownerDocument, scopeId);
    this.host.appendChild(this.svgParts.svg);
    this.host.dataset.strategy = 'svg';
  }

  apply(computed) {
    const { svg, stop1, stop2, rect, pattern } = this.svgParts;
    stop1.setAttribute('stop-color', computed.color);
    stop1.setAttribute('stop-opacity', String(computed.opacity));
    stop2.setAttribute('stop-color', 'transparent');
    stop2.setAttribute('stop-opacity', '0');
    rect.setAttribute('transform', `skewY(${computed.angleDeg})`);
    pattern.setAttribute('patternTransform', `skewY(${computed.angleDeg})`);
    svg.style.zIndex = String(computed.zIndex);
    svg.style.opacity = String(computed.opacity);
    this.host.dataset.strategy = 'svg';
    this.host.style.clipPath = `polygon(0 0, 100% 0, 100% ${computed.normalizedWidthPercent}%, 0 calc(${computed.normalizedWidthPercent}% + 0.1px))`;
  }

  destroy() {
    if (this.svgParts?.svg?.parentNode) {
      this.svgParts.svg.parentNode.removeChild(this.svgParts.svg);
    }
  }
}

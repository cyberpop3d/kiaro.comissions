'use client';

import { useEffect } from 'react';

const replaceBrand = (value: string) =>
  value
    .replace(/portfolio\.kiarostudio\.com/gi, 'portfolio.yontuk.com')
    .replace(/commissions\.kiarostudio\.com/gi, 'commissions.yontuk.com')
    .replace(/live\.kiarostudio\.com/gi, 'live.yontuk.com')
    .replace(/www\.kiarostudio\.com/gi, 'www.yontuk.com')
    .replace(/kiarostudio\.com/gi, 'yontuk.com')
    .replace(/Kiaro Studio/gi, 'Yontuk')
    .replace(/KiaroStudio/gi, 'Yontuk')
    .replace(/\bKiaro\b/gi, 'Yontuk');

function rewriteVisibleText(root: Node) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let node = walker.nextNode();
  while (node) {
    if (node instanceof Text && /kiaro/i.test(node.data)) nodes.push(node);
    node = walker.nextNode();
  }
  nodes.forEach((textNode) => {
    const next = replaceBrand(textNode.data);
    if (next !== textNode.data) textNode.data = next;
  });
}

function rewriteLinkAttributes(root: Node) {
  const elements: Element[] = [];
  if (root instanceof Element) elements.push(root);
  if ('querySelectorAll' in root) {
    elements.push(...Array.from((root as ParentNode).querySelectorAll?.('[href], [action]') || []));
  }
  elements.forEach((element) => {
    ['href', 'action'].forEach((name) => {
      const value = element.getAttribute(name);
      if (!value || !/kiarostudio/i.test(value)) return;
      const next = replaceBrand(value);
      if (next !== value) element.setAttribute(name, next);
    });
  });
}

function rewriteBrand(root: Node) {
  rewriteVisibleText(root);
  rewriteLinkAttributes(root);
}

export function YontukBrandBridge() {
  useEffect(() => {
    rewriteBrand(document.body);
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'characterData' && mutation.target instanceof Text) {
          const next = replaceBrand(mutation.target.data);
          if (next !== mutation.target.data) mutation.target.data = next;
          return;
        }
        if (mutation.type === 'attributes' && mutation.target instanceof Element) {
          rewriteLinkAttributes(mutation.target);
          return;
        }
        mutation.addedNodes.forEach((node) => rewriteBrand(node));
      });
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['href', 'action']
    });
    return () => observer.disconnect();
  }, []);
  return null;
}

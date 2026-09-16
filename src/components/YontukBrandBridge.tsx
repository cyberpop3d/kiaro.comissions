'use client';

import { useEffect } from 'react';

const replaceBrand = (value: string) =>
  value.replace(/Kiaro Studio/gi, 'Yontuk').replace(/\bKiaro\b/gi, 'Yontuk');

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

export function YontukBrandBridge() {
  useEffect(() => {
    rewriteVisibleText(document.body);
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'characterData' && mutation.target instanceof Text) {
          const next = replaceBrand(mutation.target.data);
          if (next !== mutation.target.data) mutation.target.data = next;
          return;
        }
        mutation.addedNodes.forEach((node) => rewriteVisibleText(node));
      });
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, []);
  return null;
}

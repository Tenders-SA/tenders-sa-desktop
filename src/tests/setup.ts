import "@testing-library/jest-dom/vitest";

// ProseMirror asks the browser for caret geometry while editing. jsdom does
// not implement these layout APIs, so provide inert geometry for interaction
// tests; production continues to use the webview's native implementations.
if (!document.elementFromPoint) {
  document.elementFromPoint = () => document.body;
}
if (!Range.prototype.getClientRects) {
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
}
if (!Range.prototype.getBoundingClientRect) {
  Range.prototype.getBoundingClientRect = () => new DOMRect();
}
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});

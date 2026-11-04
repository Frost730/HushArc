/**
 * Mathematical and Architectural Oracles for Mobile Viewports,
 * Virtual Keyboard Geometries, and Touch Target Accessibility Standards.
 */

export interface SafeInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ViewportDimensions {
  width: number;
  height: number;
}

export interface LayoutBounds {
  totalWidth: number;
  totalHeight: number;
  safeContentWidth: number;
  safeContentHeight: number;
}

/**
 * Computes the safe usable content box given viewport dimensions and safe area insets.
 */
export function computeSafeContentBounds(
  viewport: ViewportDimensions,
  insets: SafeInsets
): LayoutBounds {
  const safeContentWidth = Math.max(0, viewport.width - (insets.left + insets.right));
  const safeContentHeight = Math.max(0, viewport.height - (insets.top + insets.bottom));

  return {
    totalWidth: viewport.width,
    totalHeight: viewport.height,
    safeContentWidth,
    safeContentHeight,
  };
}

/**
 * Computes available chat message scroll height when a virtual keyboard appears or changes.
 * Incorporates safe-area insets, fixed header, dynamic composer height, and keyboard offset.
 */
export function calculateAvailableChatHeight(options: {
  viewportHeight: number;
  keyboardHeight: number;
  headerHeight: number;
  composerHeight: number;
  insets: SafeInsets;
}): number {
  const { viewportHeight, keyboardHeight, headerHeight, composerHeight, insets } = options;

  // On mobile when keyboard is open, the bottom inset is typically absorbed by the keyboard
  const effectiveBottomInset = keyboardHeight > 0 ? 0 : insets.bottom;
  const effectiveTopInset = insets.top;

  const totalChrome = headerHeight + composerHeight + effectiveTopInset + effectiveBottomInset + keyboardHeight;
  return Math.max(0, viewportHeight - totalChrome);
}

/**
 * Checks whether an interactive control meets WCAG 2.1 SC 2.5.5 minimum touch target size (44x44 CSS px).
 */
export function isWcagCompliantTouchTarget(widthPx: number, heightPx: number): boolean {
  return widthPx >= 44 && heightPx >= 44;
}

/**
 * Checks whether an input element's font size prevents iOS Safari automatic page zooming.
 * iOS Safari triggers automatic zoom-in if font size is less than 16px (1rem).
 */
export function isSafariZoomPrevented(fontSizePx: number): boolean {
  return fontSizePx >= 16;
}

/**
 * Checks whether horizontal elements fit inside a container without causing horizontal overflow.
 */
export function fitsHorizontalViewport(
  containerWidth: number,
  paddingHorizontal: number,
  elementWidths: number[],
  gapPx: number
): { fits: boolean; requiredWidth: number; availableWidth: number } {
  const availableWidth = Math.max(0, containerWidth - paddingHorizontal);
  const elementsTotal = elementWidths.reduce((sum, w) => sum + w, 0);
  const gapsTotal = elementWidths.length > 1 ? (elementWidths.length - 1) * gapPx : 0;
  const requiredWidth = elementsTotal + gapsTotal;

  return {
    fits: requiredWidth <= availableWidth,
    requiredWidth,
    availableWidth,
  };
}

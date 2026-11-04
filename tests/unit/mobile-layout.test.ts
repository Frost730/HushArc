import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  computeSafeContentBounds,
  calculateAvailableChatHeight,
  isWcagCompliantTouchTarget,
  isSafariZoomPrevented,
  fitsHorizontalViewport,
} from '../helpers/mobile-viewport-oracle.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');

describe('Mobile Responsive Layout & Viewport Geometry (F10, F11, F12, F13, F14)', () => {
  const globalsCssPath = path.join(projectRoot, 'src/styles/globals.css');
  const indexHtmlPath = path.join(projectRoot, 'index.html');
  const globalsCss = fs.readFileSync(globalsCssPath, 'utf8');
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

  // Tier 1: Feature Coverage (>=5 tests)
  it('defines CSS safe-area classes using env(safe-area-inset-*) in globals.css', () => {
    expect(globalsCss).toContain('.safe-top');
    expect(globalsCss).toContain('.safe-bottom');
    expect(globalsCss).toContain('env(safe-area-inset-top');
    expect(globalsCss).toContain('env(safe-area-inset-bottom');
  });

  it('computes safe content bounds on standard modern mobile devices (iPhone 14)', () => {
    const bounds = computeSafeContentBounds(
      { width: 390, height: 844 },
      { top: 47, right: 0, bottom: 34, left: 0 }
    );
    expect(bounds.totalWidth).toBe(390);
    expect(bounds.totalHeight).toBe(844);
    expect(bounds.safeContentWidth).toBe(390);
    expect(bounds.safeContentHeight).toBe(844 - (47 + 34)); // 763px
    expect(bounds.safeContentHeight).toBeGreaterThan(600);
  });

  it('validates WCAG 2.1 minimum touch target compliance (>=44x44px)', () => {
    expect(isWcagCompliantTouchTarget(44, 44)).toBe(true);
    expect(isWcagCompliantTouchTarget(48, 48)).toBe(true);
    expect(isWcagCompliantTouchTarget(32, 32)).toBe(false);
    expect(isWcagCompliantTouchTarget(22, 22)).toBe(false);
    expect(isWcagCompliantTouchTarget(44, 40)).toBe(false);
  });

  it('validates iOS Safari 16px font-size requirement to prevent automatic page zoom', () => {
    expect(isSafariZoomPrevented(16)).toBe(true);
    expect(isSafariZoomPrevented(18)).toBe(true);
    expect(isSafariZoomPrevented(14)).toBe(false);
    expect(isSafariZoomPrevented(12)).toBe(false);
  });

  it('computes chat message list height correctly under normal closed-keyboard mobile state', () => {
    const chatHeight = calculateAvailableChatHeight({
      viewportHeight: 844,
      keyboardHeight: 0,
      headerHeight: 64,
      composerHeight: 72,
      insets: { top: 47, right: 0, bottom: 34, left: 0 },
    });
    // 844 - (64 + 72 + 47 + 34) = 627px
    expect(chatHeight).toBe(627);
    expect(chatHeight).toBeGreaterThan(500);
  });

  // Tier 2: Boundary & Corner Cases (>=5 tests)
  it('maintains non-overflowing horizontal fit on extreme 320px narrow mobile screens', () => {
    // 320px screen width, 16px horizontal padding (px-2 on each side = 16px total)
    // Left: HushArc icon (24px) + title/badge (~120px) = 144px
    // Right: 4 compact action buttons (each 28px + gap 6px = 130px)
    const fit = fitsHorizontalViewport(320, 16, [144, 130], 8);
    expect(fit.fits).toBe(true);
    expect(fit.availableWidth).toBe(304);
    expect(fit.requiredWidth).toBeLessThanOrEqual(304);
  });

  it('handles zero safe-area insets without negative dimensions or layout clipping', () => {
    const bounds = computeSafeContentBounds(
      { width: 1024, height: 768 },
      { top: 0, right: 0, bottom: 0, left: 0 }
    );
    expect(bounds.safeContentWidth).toBe(1024);
    expect(bounds.safeContentHeight).toBe(768);

    const chatHeight = calculateAvailableChatHeight({
      viewportHeight: 768,
      keyboardHeight: 0,
      headerHeight: 64,
      composerHeight: 64,
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    expect(chatHeight).toBe(640);
  });

  it('handles extreme notch insets (Dynamic Island / large sensor bar: 59px top inset)', () => {
    const bounds = computeSafeContentBounds(
      { width: 393, height: 852 },
      { top: 59, right: 0, bottom: 34, left: 0 }
    );
    expect(bounds.safeContentHeight).toBe(852 - 93);
    expect(bounds.safeContentHeight).toBe(759);
  });

  it('maintains positive chat view height under maximum virtual keyboard expansion (350px keyboard)', () => {
    const chatHeight = calculateAvailableChatHeight({
      viewportHeight: 667, // iPhone SE / 8
      keyboardHeight: 350,
      headerHeight: 56,
      composerHeight: 60,
      insets: { top: 20, right: 0, bottom: 0, left: 0 },
    });
    // 667 - (56 + 60 + 20 + 0 + 350) = 181px
    expect(chatHeight).toBe(181);
    expect(chatHeight).toBeGreaterThan(150);
  });

  it('supports landscape mobile orientation with asymmetrical horizontal safe-area insets', () => {
    const bounds = computeSafeContentBounds(
      { width: 844, height: 390 },
      { top: 0, right: 47, bottom: 21, left: 47 }
    );
    expect(bounds.safeContentWidth).toBe(844 - (47 + 47)); // 750px
    expect(bounds.safeContentHeight).toBe(390 - 21); // 369px
  });

  // Tier 3: Cross-Feature Combinations (pairwise coverage)
  it('combines virtual keyboard offset with dynamic multi-line composer expansion', () => {
    // Single line composer: 60px; Multi-line composer: 120px
    const singleLineHeight = calculateAvailableChatHeight({
      viewportHeight: 844,
      keyboardHeight: 300,
      headerHeight: 64,
      composerHeight: 60,
      insets: { top: 47, right: 0, bottom: 34, left: 0 },
    });
    const multiLineHeight = calculateAvailableChatHeight({
      viewportHeight: 844,
      keyboardHeight: 300,
      headerHeight: 64,
      composerHeight: 120,
      insets: { top: 47, right: 0, bottom: 34, left: 0 },
    });

    expect(singleLineHeight - multiLineHeight).toBe(60);
    expect(multiLineHeight).toBeGreaterThan(250);
  });

  it('verifies reduced-motion media query disables orbital animations for accessibility', () => {
    expect(globalsCss).toContain('prefers-reduced-motion: reduce');
    expect(globalsCss).toContain('animation-duration: 0.01ms');
    expect(globalsCss).toContain('.animate-orbital');
  });

  it('verifies index.html specifies viewport-fit=cover for safe-area insets compatibility', () => {
    expect(indexHtml).toContain('viewport-fit=cover');
    expect(indexHtml).toContain('width=device-width');
  });
});

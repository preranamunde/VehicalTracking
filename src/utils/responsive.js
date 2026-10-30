import { Dimensions, PixelRatio, Platform } from 'react-native';

// ============================================
// Base design guideline (standard mid-size phone)
// Change these ONLY if your Figma/design file uses different dims.
// ============================================
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const guidelineBaseWidth = 375;   // iPhone 11/X-ish width
const guidelineBaseHeight = 812;  // iPhone 11/X-ish height

// Horizontal scaling - for widths, horizontal padding/margin, icon sizes
export const scale = (size) => (SCREEN_WIDTH / guidelineBaseWidth) * size;

// Vertical scaling - for heights, vertical padding/margin
export const verticalScale = (size) => (SCREEN_HEIGHT / guidelineBaseHeight) * size;

// Moderate scaling - for font sizes & things that shouldn't scale as
// aggressively as raw width (factor 0.5 = 50% influence from screen size)
export const moderateScale = (size, factor = 0.5) =>
  size + (scale(size) - size) * factor;

export const moderateVerticalScale = (size, factor = 0.5) =>
  size + (verticalScale(size) - size) * factor;

// ============================================
// Device size buckets — handy for conditional layout decisions
// (e.g. show 2 columns instead of 3 on small phones)
// ============================================
export const isSmallDevice = SCREEN_WIDTH < 360;
export const isMediumDevice = SCREEN_WIDTH >= 360 && SCREEN_WIDTH < 400;
export const isLargeDevice = SCREEN_WIDTH >= 400 && SCREEN_WIDTH < 600;
export const isTablet = SCREEN_WIDTH >= 600;

// ============================================
// Font scaling that also respects the user's OS accessibility
// text-size setting, capped so huge OS settings don't break layout.
// ============================================
export const normalizeFont = (size) => {
  const newSize = moderateScale(size);
  const fontScale = PixelRatio.getFontScale();
  const capped = Math.min(fontScale, 1.3); // cap runaway OS font scaling
  return Math.round(newSize * capped);
};

// ============================================
// Safe top/bottom spacing without hardcoding 50 vs 40.
// Pair this with react-native-safe-area-context's useSafeAreaInsets
// when available; this is a reasonable fallback if you don't have it.
// ============================================
export const statusBarHeight = Platform.select({
  ios: verticalScale(44),
  android: verticalScale(24),
  default: verticalScale(24),
});

export { SCREEN_WIDTH, SCREEN_HEIGHT };
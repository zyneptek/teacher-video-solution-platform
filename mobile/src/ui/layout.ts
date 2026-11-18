// Geniş ekran (tablet, yatay): web'deki gibi iki sütunlu düzen kullanılır; telefonda tek sütun kalır.
import { useWindowDimensions } from 'react-native';

export const WIDE_BREAKPOINT = 820;

export function useWide(): boolean {
  return useWindowDimensions().width >= WIDE_BREAKPOINT;
}

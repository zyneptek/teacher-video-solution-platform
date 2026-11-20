// Geniş ekran (tablet, yatay): web'deki gibi iki sütunlu düzen kullanılır; telefonda tek sütun kalır.
import { useWindowDimensions } from 'react-native';

export const WIDE_BREAKPOINT = 820;

export function useWide(): boolean {
  return useWindowDimensions().width >= WIDE_BREAKPOINT;
}

// Dikey tutulan tablet: geniş ama yüksekliği genişliğinden büyük. Bu durumda yan yana iki sütun yerine
// geniş bir üst alan ve altına yayılan kontroller kullanılır.
export function useWidePortrait(): boolean {
  const { width, height } = useWindowDimensions();
  return width >= WIDE_BREAKPOINT && height > width;
}

// Mobil çözüm tahtası (Skia). Web tahtasıyla aynı çizim modelini kullanır:
// kalem yumuşatılmış çizgi çizer, silgi değdiği çizgiyi tamamen siler.
// Çizgiler, 1280x720 mantıksal boyutlu ekran dışı bir Skia yüzeyine çizilir ve ekrana görüntü olarak
// verilir; etkileşim mantığı `shared/` içindeki InkController'dadır.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { GestureResponderEvent, LayoutChangeEvent, NativeTouchEvent } from 'react-native';
import { Canvas, Fill, Image as SkiaImage, Skia, useImage, type DataSourceParam, type SkImage } from '@shopify/react-native-skia';
import { useSharedValue } from 'react-native-reanimated';
import { BOARD, InkController, InkPainter, questionImageRect, type DrawingEvent, type InkSample, type Tool } from '@app/shared';
import { SkiaDrawingContext } from './skiaContext';

type Props = {
  imageSource: DataSourceParam;
  tool: Tool;
  // Kayıt saati (ms). Duraklatılmışsa donmuş değeri döner.
  getTimeMs: () => number;
  // Biten her çizgi ve her silme için çağrılır; olaylar gerçekleşme sırasıyla gelir.
  onEvent: (event: DrawingEvent) => void;
  // Denetleyici hazır olunca çağrılır (geliştirici denemeleri için).
  onReady?: (controller: InkController) => void;
  // true iken çizim yapılamaz (kayıt başlamadan önce ve bittikten sonra).
  disabled?: boolean;
  // Tahtanın üstünde (dokunmaları engellemeden) gösterilecek içerik; boyut ve konum için tahta ölçeği verilir.
  renderOverlay?: (k: number) => ReactNode;
};

// Kalem kalktıktan sonra bu süre boyunca parmak dokunuşları yok sayılır (avuç içi reddi).
const PALM_REJECTION_MS = 1200;

export function Board({ imageSource, tool, getTimeMs, onEvent, onReady, disabled = false, renderOverlay }: Props) {
  // Tahta, bulunduğu alana oranını koruyarak sığar (ekran dönse de taşmaz, kaydırma gerekmez).
  const [area, setArea] = useState({ width: 0, height: 0 });
  const width = Math.min(area.width, (area.height * BOARD.width) / BOARD.height);
  const height = (width * BOARD.height) / BOARD.width;
  const scale = width > 0 ? BOARD.width / width : 1; // ekran pikselinden tahta koordinatına

  const questionImage = useImage(imageSource);
  // Çizim yüzeyinin son görüntüsü. Paylaşılan değer olduğu için güncellenince React yeniden çizilmez.
  const inkImage = useSharedValue<SkImage | null>(null);
  const controllerRef = useRef<InkController | null>(null);
  const touchIdRef = useRef<number | null>(null);
  const touchIsStylusRef = useRef(false);
  // Kalemin en son ne zaman görüldüğü: kalem kullanılırken avuç içi / parmak dokunuşları yok sayılır.
  const lastStylusAtRef = useRef(0);

  // Olay işleyicilerinin her çizimde yeniden kurulmaması için en güncel değerler burada tutulur.
  const latest = useRef({ tool, getTimeMs, onEvent, onReady, disabled, scale });
  useEffect(() => {
    latest.current = { tool, getTimeMs, onEvent, onReady, disabled, scale };
  }, [tool, getTimeMs, onEvent, onReady, disabled, scale]);

  // Çizim yüzeyi ve denetleyici bileşen ömrü boyunca bir kez kurulur.
  useEffect(() => {
    // CPU yüzeyi kullanılır: GPU (MakeOffscreen) yüzeyinden alınan görüntü, iOS simülatöründe
    // (Expo Go) ekrandaki canvas'ta görünmedi; çizim yüzeyde vardı ama ekrana yansımadı.
    const surface = Skia.Surface.Make(BOARD.width, BOARD.height);
    if (!surface) throw new Error('Çizim yüzeyi oluşturulamadı');
    const canvas = surface.getCanvas();

    // Çizimler hemen yüzeye yapılır; ekrana görüntü, her ekran karesinde en fazla bir kez alınır.
    let frame: number | null = null;
    const requestRender = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        inkImage.value = surface.makeImageSnapshot();
      });
    };

    const events: DrawingEvent[] = [];
    const painter = new InkPainter(new SkiaDrawingContext(canvas, requestRender), events, () => {
      canvas.clear(Skia.Color('transparent'));
      requestRender();
    });
    const controller = new InkController({
      painter,
      events,
      getTimeMs: () => latest.current.getTimeMs(),
      onEvent: (event) => latest.current.onEvent(event),
    });
    controllerRef.current = controller;
    latest.current.onReady?.(controller);

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      controllerRef.current = null;
    };
  }, [inkImage]);

  // Ekran koordinatını tahta koordinatına çevirir.
  function toSample(touch: NativeTouchEvent): InkSample {
    return { x: touch.locationX * latest.current.scale, y: touch.locationY * latest.current.scale };
  }

  function handleTouchStart(event: GestureResponderEvent) {
    if (latest.current.disabled) return;
    const touch = event.nativeEvent.changedTouches[0];
    if (!touch) return;
    // iOS dokunuşun türünü bildirir ('stylus' = Apple Pencil). Türü bilmeyen cihazlarda parmak sayılır.
    const isStylus = (touch as NativeTouchEvent & { touchType?: string }).touchType === 'stylus';
    const now = Date.now();
    if (isStylus) {
      lastStylusAtRef.current = now;
      // Çizim sırasında avuç içi/parmak çizgisi başlamışsa kalem öncelik alır.
      if (touchIdRef.current !== null && !touchIsStylusRef.current) {
        controllerRef.current?.end();
        touchIdRef.current = null;
      }
    } else if (now - lastStylusAtRef.current < PALM_REJECTION_MS) {
      return; // kalem kullanılırken parmak/avuç dokunuşu
    }
    if (touchIdRef.current !== null) return; // tek işaretçi
    touchIdRef.current = touch.identifier;
    touchIsStylusRef.current = isStylus;
    controllerRef.current?.begin(latest.current.tool, toSample(touch));
  }

  function handleTouchMove(event: GestureResponderEvent) {
    const id = touchIdRef.current;
    if (id === null) return;
    const samples = event.nativeEvent.changedTouches.filter((touch) => touch.identifier === id).map(toSample);
    if (samples.length > 0) controllerRef.current?.move(samples);
  }

  function handleTouchEnd(event: GestureResponderEvent) {
    const id = touchIdRef.current;
    if (id === null || !event.nativeEvent.changedTouches.some((touch) => touch.identifier === id)) return;
    touchIdRef.current = null;
    if (touchIsStylusRef.current) lastStylusAtRef.current = Date.now();
    controllerRef.current?.end();
  }

  const k = 1 / scale; // tahta koordinatından ekran pikseline
  const rect = questionImage ? questionImageRect(questionImage.width(), questionImage.height()) : null;

  return (
    <View
      style={styles.area}
      onLayout={(event: LayoutChangeEvent) => setArea(event.nativeEvent.layout)}
    >
      {width > 0 && (
        <View style={{ width, height }}>
          <Canvas style={{ width, height }}>
            <Fill color="white" />
            {questionImage && rect && (
              <SkiaImage image={questionImage} x={rect.x * k} y={rect.y * k} width={rect.width * k} height={rect.height * k} fit="fill" />
            )}
            <SkiaImage image={inkImage} x={0} y={0} width={width} height={height} fit="fill" />
          </Canvas>
          {renderOverlay?.(k)}
          {/* Dokunmaları alan saydam katman: dokunma konumu bu katmana göre gelir. */}
          <View
            style={StyleSheet.absoluteFill}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Üst alanı doldurur; tahta bu alanın ortasında durur.
  area: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

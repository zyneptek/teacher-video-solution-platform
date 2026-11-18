import type { AssignmentStatus } from '@app/shared';
// Basit ekran yığını (ek yönlendirme kütüphanesi olmadan): uygulama küçük olduğundan durum içinde tutulur.
export type Route =
  | { name: 'home' }
  | { name: 'list'; status: AssignmentStatus }
  | { name: 'question'; id: string }
  | { name: 'record'; id: string }
  | { name: 'trim'; id: string }
  | { name: 'report'; id: string };

export type Nav = {
  push: (route: Route) => void;
  pop: () => void;
  reset: (route: Route) => void;
};

// Sunucunun bildirim adresini (#/sorularim/<id>) ekrana çevirir.
export function routeFromHref(href: string): Route | null {
  const match = /^#\/sorularim\/([0-9a-f-]{36})/.exec(href);
  return match ? { name: 'question', id: match[1] as string } : null;
}

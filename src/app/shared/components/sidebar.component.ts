import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Subject, combineLatest } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Holiday, Member, Vacation, VacationType } from '../../core/models/models';
import { DataService } from '../../core/services/data.service';

interface NavTile {
  route: string;
  label: string;
  icon: string;
  bg: string;
  border: string;
  text: string;
}

type UpcomingItem =
  | { kind: 'vacation'; date: string; type: VacationType; monthAbbr: string; dayNum: number }
  | { kind: 'holiday';  date: string; name: string; monthAbbr: string; dayNum: number; proximity: string; isUrgent: boolean }
  | { kind: 'birthday'; date: string; name: string; avatarUrl: string; monthAbbr: string; dayNum: number; proximity: string; isUrgent: boolean };

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <div class="w-52 flex-shrink-0 flex flex-col bg-white border-r border-gray-200 h-full shadow-sm">

      <!-- Brand header -->
      <a routerLink="/home"
         class="bg-white border-b border-gray-100 px-4 py-2.5 flex items-center justify-center flex-shrink-0 cursor-pointer">
        <img src="images/bestmed_logo.png"
             class="h-[42px] w-auto object-contain" alt="BESTMED">
      </a>

      <!-- Scrollable middle -->
      <div class="flex-1 overflow-y-auto">

        <!-- Nav tiles — 2×2 for logged-in, 1×2 for guests -->
        <nav class="p-3 grid grid-cols-2 gap-2">
          <a *ngFor="let t of visibleNavTiles"
             [routerLink]="t.route"
             routerLinkActive
             #rla="routerLinkActive"
             class="flex flex-col items-center justify-center py-3.5 rounded-xl transition-all cursor-pointer select-none"
             [style.background-color]="t.bg"
             [style.box-shadow]="rla.isActive ? '0 0 0 2.5px ' + t.border : 'none'">
            <img [src]="'images/' + t.icon + '.png'" class="w-7 h-7 object-contain mb-1.5" alt="">
            <span class="text-[11px] font-bold" [style.color]="t.text">{{ t.label }}</span>
          </a>
        </nav>

        <!-- Upcoming: vacations + VN holidays + birthdays merged, sorted by date -->
        <div *ngIf="currentUser && upcomingItems.length > 0"
             class="border-t border-gray-100 px-3 py-3">
          <p class="text-[10px] font-bold uppercase tracking-widest text-[#94a3b8] mb-2.5">Upcoming</p>
          <div class="space-y-2">

            <ng-container *ngFor="let item of upcomingItems">

              <!-- Holiday card -->
              <div *ngIf="item.kind === 'holiday'"
                   class="flex items-center gap-2.5 rounded-lg p-2"
                   [class.bg-red-50]="!asHoliday(item).isUrgent"
                   [class.bg-red-100]="asHoliday(item).isUrgent">
                <div class="w-9 h-9 rounded-lg flex flex-col items-center justify-center flex-shrink-0"
                     [class.bg-red-400]="!asHoliday(item).isUrgent"
                     [class.bg-red-600]="asHoliday(item).isUrgent">
                  <span class="text-[8px] font-bold text-red-100 uppercase leading-none tracking-wider">{{ item.monthAbbr }}</span>
                  <span class="text-sm font-bold text-white leading-tight">{{ item.dayNum }}</span>
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-[11px] font-semibold text-[#1E293B] leading-tight"
                     style="overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2">
                    {{ item.name }}
                  </p>
                  <p class="text-[9px] font-semibold leading-tight mt-0.5"
                     [class.text-red-600]="asHoliday(item).isUrgent"
                     [class.text-red-400]="!asHoliday(item).isUrgent">
                    {{ asHoliday(item).proximity }}
                  </p>
                </div>
              </div>

              <!-- Vacation card -->
              <div *ngIf="item.kind === 'vacation'"
                   class="flex items-center gap-2.5 rounded-lg p-2"
                   [style.background-color]="vacTypeBgLight(asVacation(item).type)">
                <div class="w-9 h-9 rounded-lg flex flex-col items-center justify-center flex-shrink-0"
                     [style.background-color]="vacTypeChip(asVacation(item).type)">
                  <span class="text-[8px] font-bold text-white/70 uppercase leading-none tracking-wider">{{ item.monthAbbr }}</span>
                  <span class="text-sm font-bold text-white leading-tight">{{ item.dayNum }}</span>
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-[11px] font-semibold leading-tight"
                     [style.color]="vacTypeTextColor(asVacation(item).type)">
                    {{ vacTypeLabel(asVacation(item).type) }}
                  </p>
                  <p class="text-[9px] text-[#94a3b8] leading-tight mt-0.5">Your day off</p>
                </div>
              </div>

              <!-- Birthday card -->
              <div *ngIf="item.kind === 'birthday'"
                   class="flex items-center gap-2.5 rounded-lg p-2"
                   [class.bg-amber-50]="!asBirthday(item).isUrgent"
                   [class.bg-amber-100]="asBirthday(item).isUrgent">
                <div class="w-9 h-9 rounded-lg flex flex-col items-center justify-center flex-shrink-0"
                     [class.bg-amber-400]="!asBirthday(item).isUrgent"
                     [class.bg-amber-500]="asBirthday(item).isUrgent">
                  <span class="text-[8px] font-bold text-amber-100 uppercase leading-none tracking-wider">{{ item.monthAbbr }}</span>
                  <span class="text-sm font-bold text-white leading-tight">{{ item.dayNum }}</span>
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-[11px] font-semibold text-[#1E293B] leading-tight flex items-center gap-1">
                    <span class="text-sm leading-none select-none">{{ asBirthday(item).avatarUrl }}</span>
                    <span class="truncate">{{ asBirthday(item).name }}</span>
                  </p>
                  <p class="text-[9px] font-semibold leading-tight mt-0.5"
                     [class.text-amber-600]="asBirthday(item).isUrgent"
                     [class.text-amber-400]="!asBirthday(item).isUrgent">
                    &#127874; {{ asBirthday(item).proximity }}
                  </p>
                </div>
              </div>

            </ng-container>
          </div>

          <p *ngIf="moreItems > 0" class="text-[10px] text-[#94a3b8] mt-2 text-center">
            +{{ moreItems }} more
          </p>
        </div>

      </div>

    </div>
  `,
})
export class SidebarComponent implements OnInit, OnDestroy {
  private readonly ALL_TILES: NavTile[] = [
    { route: '/home',     label: 'Home',     icon: 'home',     bg: '#EFF6FF', border: '#3B82F6', text: '#1D4ED8' },
    { route: '/holidays', label: 'Holidays', icon: 'holidays', bg: '#FFF1F2', border: '#F43F5E', text: '#BE123C' },
    { route: '/history',  label: 'History',  icon: 'history',  bg: '#FDF4FF', border: '#A855F7', text: '#7E22CE' },
    { route: '/members',  label: 'Members',  icon: 'members',  bg: '#F0FDF4', border: '#22C55E', text: '#15803D' },
  ];

  currentUser: Member | null = null;
  upcomingItems: UpcomingItem[] = [];
  moreItems = 0;

  private destroy$ = new Subject<void>();
  private readonly MAX_ITEMS = 8;
  private readonly BIRTHDAY_WINDOW_DAYS = 30;

  constructor(private dataService: DataService) {}

  get visibleNavTiles(): NavTile[] {
    if (!this.currentUser) {
      return this.ALL_TILES.filter(t => t.route === '/home' || t.route === '/holidays');
    }
    return this.ALL_TILES;
  }

  ngOnInit(): void {
    this.dataService.authenticatedUser$.pipe(takeUntil(this.destroy$)).subscribe(u => {
      this.currentUser = u;
    });

    combineLatest([
      this.dataService.vacations$,
      this.dataService.holidays$,
      this.dataService.authenticatedUser$,
      this.dataService.members$,
    ]).pipe(takeUntil(this.destroy$)).subscribe(([vacations, holidays, user, members]) => {
      this.buildUpcomingItems(vacations, holidays, user, members);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private buildUpcomingItems(
    vacations: Vacation[],
    holidays: Holiday[],
    user: Member | null,
    members: Member[],
  ): void {
    const todayStr = this.todayStr();
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const vacItems: UpcomingItem[] = user
      ? vacations
          .filter(v => v.username === user.username && v.date >= todayStr)
          .sort((a, b) => a.date.localeCompare(b.date))
          .map(v => {
            const [, m, d] = v.date.split('-').map(Number);
            const dt = new Date(Number(v.date.split('-')[0]), m - 1, d);
            return {
              kind: 'vacation' as const,
              date: v.date,
              type: v.type,
              monthAbbr: dt.toLocaleDateString('en-AU', { month: 'short' }),
              dayNum: d,
            };
          })
      : [];

    const holItems: UpcomingItem[] = holidays
      .filter(h => h.date >= todayStr && this.isVn(h.country))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(h => {
        const [y, m, d] = h.date.split('-').map(Number);
        const hDate = new Date(y, m - 1, d);
        const days = Math.round((hDate.getTime() - todayMidnight) / 86_400_000);
        return {
          kind: 'holiday' as const,
          date: h.date,
          name: h.name,
          monthAbbr: hDate.toLocaleDateString('en-AU', { month: 'short' }),
          dayNum: d,
          proximity: this.proximity(days),
          isUrgent: days <= 1,
        };
      });

    const bdayItems: UpcomingItem[] = user
      ? members
          .map(m => {
            const md = this.parseBirthdayMD(m.birthday);
            if (!md) return null;
            const next = this.nextBirthdayOccurrence(md, now, todayMidnight);
            if (!next || next.daysUntil > this.BIRTHDAY_WINDOW_DAYS) return null;
            return {
              kind: 'birthday' as const,
              date: next.dateStr,
              name: m.name,
              avatarUrl: m.avatarUrl,
              monthAbbr: next.monthAbbr,
              dayNum: md.day,
              proximity: next.daysUntil === 0 ? 'Happy Birthday!' : this.proximity(next.daysUntil),
              isUrgent: next.daysUntil <= 1,
            } satisfies UpcomingItem;
          })
          .filter((x): x is Extract<UpcomingItem, { kind: 'birthday' }> => x !== null)
      : [];

    const merged = [...vacItems, ...holItems, ...bdayItems].sort((a, b) => a.date.localeCompare(b.date));
    this.moreItems = Math.max(0, merged.length - this.MAX_ITEMS);
    this.upcomingItems = merged.slice(0, this.MAX_ITEMS);
  }

  // ── Birthday helpers ──────────────────────────────────────────────────────

  /**
   * Parses a birthday string (any common format) to { month, day }.
   * Treats slash-separated 3-part dates as DD/MM/YYYY (Vietnamese convention).
   */
  private parseBirthdayMD(birthday: string | undefined): { month: number; day: number } | null {
    const s = (birthday ?? '').trim();
    if (!s) return null;

    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [, m, d] = s.split('-').map(Number);
      return (m >= 1 && m <= 12 && d >= 1 && d <= 31) ? { month: m, day: d } : null;
    }

    const parts = s.split('/');

    // DD/MM — primary sheet format (no year stored)
    if (parts.length === 2) {
      const [day, month] = parts.map(Number);
      return (month >= 1 && month <= 12 && day >= 1 && day <= 31) ? { month, day } : null;
    }

    // DD/MM/YYYY — treat as DD/MM/YYYY (VN convention)
    if (parts.length === 3) {
      const [day, month, c] = parts.map(Number);
      if (c > 1000) {
        return (month >= 1 && month <= 12 && day >= 1 && day <= 31) ? { month, day } : null;
      }
    }

    return null;
  }

  private nextBirthdayOccurrence(
    md: { month: number; day: number },
    now: Date,
    todayMidnight: number,
  ): { dateStr: string; monthAbbr: string; daysUntil: number } | null {
    const tryYear = (y: number) => {
      try {
        const d = new Date(y, md.month - 1, md.day);
        // Validate (e.g. Feb 29 on non-leap year shifts to Mar 1 — skip those)
        if (d.getMonth() !== md.month - 1) return null;
        return d;
      } catch { return null; }
    };

    let target = tryYear(now.getFullYear());
    if (!target || target.getTime() < todayMidnight) {
      target = tryYear(now.getFullYear() + 1);
    }
    if (!target) return null;

    const daysUntil = Math.round((target.getTime() - todayMidnight) / 86_400_000);
    const dateStr = `${target.getFullYear()}-${String(md.month).padStart(2, '0')}-${String(md.day).padStart(2, '0')}`;
    const monthAbbr = target.toLocaleDateString('en-AU', { month: 'short' });
    return { dateStr, monthAbbr, daysUntil };
  }

  // ── Cast helpers (template can't narrow union types) ──────────────────────

  asHoliday(item: UpcomingItem)  { return item as Extract<UpcomingItem, { kind: 'holiday' }>; }
  asVacation(item: UpcomingItem) { return item as Extract<UpcomingItem, { kind: 'vacation' }>; }
  asBirthday(item: UpcomingItem) { return item as Extract<UpcomingItem, { kind: 'birthday' }>; }

  // ── Vacation card helpers ─────────────────────────────────────────────────

  vacTypeChip(type: VacationType): string {
    if (type === 'Compensation') return '#0E7490';
    if (type === 'Special Leave') return '#C2410C';
    return '#7E22CE';
  }

  vacTypeBgLight(type: VacationType): string {
    if (type === 'Compensation') return '#ECFEFF';
    if (type === 'Special Leave') return '#FFF7ED';
    return '#FAF5FF';
  }

  vacTypeTextColor(type: VacationType): string {
    if (type === 'Compensation') return '#0E7490';
    if (type === 'Special Leave') return '#C2410C';
    return '#7E22CE';
  }

  vacTypeLabel(type: VacationType): string {
    if (type === 'Compensation') return 'Comp Day';
    if (type === 'Special Leave') return 'Special Leave';
    return 'Vacation Day';
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  private proximity(days: number): string {
    if (days === 0) return 'Today!';
    if (days === 1) return 'Tomorrow';
    if (days < 7)  return `In ${days} days`;
    if (days < 14) return 'Next week';
    if (days < 30) return `In ${Math.round(days / 7)} weeks`;
    if (days < 60) return 'Next month';
    return `In ~${Math.round(days / 30)} months`;
  }

  private isVn(country?: string): boolean {
    const c = (country ?? '').toLowerCase();
    return c.includes('viet') || c === 'vn';
  }

  private todayStr(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

}

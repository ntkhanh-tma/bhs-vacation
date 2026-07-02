import { Component, NgZone, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { DataService } from '../../core/services/data.service';
import { Holiday, Member, Vacation, VacationType } from '../../core/models/models';

interface GanttBar {
  offset: number; // % from left within the track
  width:  number; // % width within the track
}

interface HistoryEntry {
  member: Member;
  vacations: Vacation[];
  dateRange: string;
  dayCount: number;
  ganttBars: GanttBar[]; // one per consecutive date run
  color: string;
}

interface CalendarCell {
  dayNum: number | null;
  dateStr: string;
  entries: HistoryEntry[];
  isWeekend: boolean;
}

interface MonthGroup {
  label: string;
  year: number;
  month: number;
  entries: HistoryEntry[];
  daysInMonth: number;
  calendarCells: CalendarCell[];
}

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div>
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-[#1E293B]">History</h1>
        <p class="text-[#64748B] text-sm mt-1">View past and current vacation registrations.</p>
      </div>

      <!-- Filters -->
      <div class="flex items-center gap-3 mb-6 flex-wrap">
        <select [(ngModel)]="filterMonth" (ngModelChange)="applyFilter()"
                class="border border-gray-200 rounded-lg px-3 py-2 text-sm text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#003bc4]">
          <option value="">All Months</option>
          <option *ngFor="let m of availableMonths" [value]="m.key">{{ m.label }}</option>
        </select>
        <div class="relative flex-1 max-w-xs">
          <input [(ngModel)]="searchQuery" (ngModelChange)="applyFilter()"
                 type="text" placeholder="Search member..."
                 class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003bc4] pl-8">
          <span class="absolute left-2.5 top-2.5 text-gray-400 text-sm">&#128269;</span>
        </div>
        <div class="ml-auto flex gap-2">
          <button (click)="viewMode = 'calendar'" [class]="viewMode === 'calendar' ? activeBtn : inactiveBtn">
            &#128197; Calendar
          </button>
          <button (click)="viewMode = 'timeline'" [class]="viewMode === 'timeline' ? activeBtn : inactiveBtn">
            &#9646; Timeline
          </button>
        </div>
      </div>

      <!-- Month groups -->
      <div *ngFor="let group of filteredGroups" class="mb-8">

        <!-- Month header + export button -->
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-base font-semibold text-[#1E293B]">{{ group.label }}</h3>
          <button (click)="exportMonth(group)"
                  title="Export month as image"
                  class="flex items-center gap-1.5 bg-green-600 text-white px-3.5 py-2 rounded-lg text-sm font-medium hover:bg-green-700 whitespace-nowrap flex-shrink-0 transition-colors">
            &#128247; Export
          </button>
        </div>

        <div class="bg-white rounded-xl border border-gray-100 overflow-hidden">

          <!-- ── Timeline view ─────────────────────────────────────────────── -->
          <div *ngIf="viewMode === 'timeline'" class="overflow-x-auto">
          <div class="flex min-w-[540px]">

            <!-- Left: member info panel -->
            <div class="w-52 flex-shrink-0 border-r border-gray-100">
              <!-- Spacer matching tick-header height -->
              <div class="h-9 border-b border-gray-100 bg-gray-50/80"></div>
              <div *ngFor="let entry of group.entries; let last = last"
                   class="flex items-center gap-2.5 px-3 h-[52px]"
                   [class.border-b]="!last"
                   [class.border-gray-50]="!last">
                <div class="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-lg flex-shrink-0 select-none">
                  {{ entry.member.avatarUrl }}
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-semibold text-[#1E293B] truncate">{{ entry.member.name }}</p>
                  <p class="text-xs text-[#94a3b8]">
                    {{ entry.dayCount }} day{{ entry.dayCount !== 1 ? 's' : '' }}
                    · {{ entry.dateRange }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Right: Gantt track -->
            <div class="flex-1 min-w-0">
              <!-- Day tick headers -->
              <div class="h-9 flex items-end border-b border-gray-100 bg-gray-50/80 px-3 pb-1.5">
                <div *ngFor="let tick of getMonthTicks(group)"
                     class="text-xs text-[#94a3b8] select-none"
                     [style.width.%]="tick.widthPct">
                  {{ tick.label }}
                </div>
              </div>

              <!-- One row per member -->
              <div *ngFor="let entry of group.entries; let last = last"
                   class="relative h-[52px] flex items-center"
                   [class.border-b]="!last"
                   [class.border-gray-50]="!last">
                <!-- Track container (accounts for left/right padding) -->
                <div class="absolute inset-y-0 left-3 right-3 flex items-center">
                  <!-- Vertical grid lines -->
                  <div *ngFor="let tick of getMonthTicks(group)"
                       class="absolute inset-y-0 w-px bg-gray-100"
                       [style.left.%]="tick.leftPct">
                  </div>
                  <!-- Bars: one per consecutive date run, so scattered days render separately -->
                  <div *ngFor="let bar of entry.ganttBars"
                       class="absolute rounded-full h-[14px]"
                       [ngStyle]="{
                         left:             bar.offset + '%',
                         width:            bar.width + '%',
                         minWidth:         '8px',
                         backgroundColor:  entry.color,
                         opacity:          '0.9'
                       }">
                  </div>
                </div>
              </div>
            </div>

          </div><!-- /min-w flex -->
          </div><!-- /overflow-x-auto -->

          <!-- ── Calendar view ─────────────────────────────────────────────── -->
          <div *ngIf="viewMode === 'calendar'" class="p-4">
            <!-- Day-of-week headers -->
            <div class="grid grid-cols-7 mb-1">
              <div *ngFor="let h of dayHeaders; let i = index"
                   class="text-center text-sm font-semibold py-1.5 rounded"
                   [class.text-slate-400]="i >= 5"
                   [class.text-[#64748B]]="i < 5"
                   [class.bg-slate-50]="i >= 5">
                {{ h }}
              </div>
            </div>

            <!-- Calendar cells -->
            <div class="grid grid-cols-7 gap-0.5">
              <div *ngFor="let cell of group.calendarCells"
                   class="min-h-[92px] rounded-lg border text-left overflow-hidden"
                   [class.border-transparent]="!cell.dayNum"
                   [class.invisible]="!cell.dayNum"
                   [class.border-gray-100]="!!cell.dayNum && !cell.isWeekend"
                   [class.bg-white]="!!cell.dayNum && !cell.isWeekend"
                   [class.border-slate-200]="!!cell.dayNum && cell.isWeekend"
                   [class.bg-slate-100]="!!cell.dayNum && cell.isWeekend">
                <ng-container *ngIf="cell.dayNum">
                  <div class="flex flex-col gap-1 h-full p-1.5">
                    <span class="text-sm font-semibold leading-none mb-0.5"
                          [class.text-slate-400]="cell.isWeekend"
                          [class.text-[#64748B]]="!cell.isWeekend">
                      {{ cell.dayNum }}
                    </span>
                    <div *ngFor="let entry of cell.entries.slice(0, 3)"
                         class="flex items-center gap-1 rounded px-1 py-0.5 w-full overflow-hidden"
                         [style.background-color]="entry.color">
                      <span class="text-xs leading-none flex-shrink-0 select-none">{{ entry.member.avatarUrl }}</span>
                      <span class="text-[11px] font-semibold text-white truncate leading-tight">{{ entry.member.name }}</span>
                    </div>
                    <span *ngIf="cell.entries.length > 3"
                          class="text-[11px] text-[#64748B] font-medium px-1 leading-tight">
                      +{{ cell.entries.length - 3 }} more
                    </span>
                  </div>
                </ng-container>
              </div>
            </div>

            <!-- Legend -->
            <div *ngIf="group.entries.length > 0" class="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-x-3 gap-y-1.5">
              <div *ngFor="let entry of group.entries"
                   class="flex items-center gap-1.5 text-sm text-[#64748B]">
                <span class="text-lg leading-none select-none">{{ entry.member.avatarUrl }}</span>
                <span class="font-medium">{{ entry.member.name }}</span>
                <span class="text-[#94a3b8]">{{ entry.dayCount }}d</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      <div *ngIf="filteredGroups.length === 0" class="text-center py-16 text-[#64748B]">
        <img src="images/history.png" class="w-12 h-12 object-contain mb-3 mx-auto opacity-40" alt="">
        <p>No vacation history found.</p>
      </div>

      <!-- Export preview modal -->
      <div *ngIf="previewImageUrl"
           class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
           (click)="closePreview()">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-3xl p-6" (click)="$event.stopPropagation()">
          <div class="flex justify-between items-start mb-4">
            <div>
              <h2 class="text-xl font-bold text-[#1E293B]">Export Preview</h2>
              <p class="text-[#64748B] text-sm mt-1">{{ previewFilename }}</p>
            </div>
            <button (click)="closePreview()"
                    class="text-[#64748B] hover:text-[#1E293B] text-xl leading-none">&times;</button>
          </div>

          <div class="border border-gray-100 rounded-xl overflow-auto max-h-[65vh] bg-gray-50 p-3">
            <img [src]="previewImageUrl" class="max-w-full h-auto mx-auto block" alt="Vacation report preview">
          </div>

          <p *ngIf="copyFeedback"
             class="text-xs text-center mt-3"
             [class.text-green-600]="copyFeedback.startsWith('Copied')"
             [class.text-red-600]="!copyFeedback.startsWith('Copied')">
            {{ copyFeedback }}
          </p>

          <div class="flex gap-3 mt-4">
            <button (click)="copyPreviewImage()"
                    class="flex-1 border border-gray-200 text-[#1E293B] rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50">
              &#128203; Copy Image
            </button>
            <button (click)="downloadPreview()"
                    class="flex-1 bg-[#003bc4] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#002da3]">
              &#11015; Download
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class HistoryComponent implements OnInit, OnDestroy {
  dayHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  allGroups: MonthGroup[] = [];
  filteredGroups: MonthGroup[] = [];
  availableMonths: { key: string; label: string }[] = [];
  filterMonth = '';
  searchQuery = '';
  viewMode: 'calendar' | 'timeline' = 'timeline';
  currentUserUsername: string | null = null;
  private holidays: Holiday[] = [];
  private destroy$ = new Subject<void>();

  // ── Export preview state ─────────────────────────────────────────────────
  previewImageUrl: string | null = null;
  previewFilename = '';
  copyFeedback: string | null = null;
  private previewBlob: Blob | null = null;

  // ── Export report palette — soft pastel chips on a neutral card ──────────
  private readonly EXPORT_CARD_BG    = '#FFFFFF';
  private readonly EXPORT_PAGE_BG    = '#F1F5F9';
  private readonly EXPORT_HEADER_BG  = '#003bc4';
  private readonly EXPORT_HEADER_SUB = '#BFDBFE';
  private readonly EXPORT_WEEKEND_BG = '#E2E8F0';
  private readonly EXPORT_DIVIDER    = '#E2E8F0';
  private readonly EXPORT_TYPE_STYLE: Record<VacationType, { bg: string; fg: string; letter: string }> = {
    Vacation:     { bg: '#DCFCE7', fg: '#16A34A', letter: 'V' },
    Compensation: { bg: '#FFEDD5', fg: '#EA580C', letter: 'C' },
    Event:        { bg: '#F3E8FF', fg: '#9333EA', letter: 'E' },
  };
  private readonly EXPORT_HOLIDAY_STYLE = { bg: '#DBEAFE', fg: '#2563EB', letter: 'P' };
  // Deterministic per-team row tint — same djb2-style hash used for team colors elsewhere in the app.
  private readonly EXPORT_TEAM_ROW_COLORS = [
    '#EFF6FF', '#F0FDF4', '#FFF7ED', '#FDF4FF', '#FFF1F2',
    '#ECFEFF', '#FFFBEB', '#F0F9FF', '#F7FEE7', '#FFF0F0',
  ];

  activeBtn   = 'px-3 py-1.5 text-sm rounded-lg bg-[#003bc4] text-white font-medium';
  inactiveBtn = 'px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-[#64748B] hover:bg-gray-50';

  constructor(private dataService: DataService, private router: Router, private ngZone: NgZone) {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.previewImageUrl) URL.revokeObjectURL(this.previewImageUrl);
  }

  ngOnInit(): void {
    this.dataService.authenticatedUser$.pipe(takeUntil(this.destroy$)).subscribe(u => {
      this.currentUserUsername = u?.username ?? null;
      if (!u && !this.dataService.loading) this.router.navigate(['/home']);
      this.buildHistory();
    });
    this.dataService.vacations$.pipe(takeUntil(this.destroy$)).subscribe(() => this.buildHistory());
    this.dataService.holidays$.pipe(takeUntil(this.destroy$)).subscribe(h => this.holidays = h);
  }

  buildHistory(): void {
    const raw = this.dataService.getVacationsGroupedByMonth();
    this.allGroups = raw.map(group => {
      const daysInMonth = new Date(group.year, group.month, 0).getDate();

      const entries: HistoryEntry[] = group.entries.map(e => {
        const dates = e.vacations.map(v => v.date).sort();
        const isYou  = e.member.username === (this.currentUserUsername ?? '');
        const color  = isYou ? '#B48CF2' : (e.member.avatarColor ?? '#7CC9A7');

        const dateRange = dates.length === 1
          ? this.formatShortDate(dates[0])
          : `${this.formatShortDate(dates[0])} – ${this.formatShortDate(dates[dates.length - 1])}`;

        const runs = this.groupConsecutiveRuns(dates);
        const ganttBars: GanttBar[] = runs.map(run => ({
          offset: ((run.startDay - 1) / daysInMonth) * 100,
          width:  ((run.endDay - run.startDay + 1) / daysInMonth) * 100,
        }));

        return { member: e.member, vacations: e.vacations, dateRange, dayCount: dates.length, ganttBars, color };
      });

      return {
        label: group.label,
        year:  group.year,
        month: group.month,
        entries,
        daysInMonth,
        calendarCells: this.buildCalendarCells(group.year, group.month, entries),
      };
    });

    this.availableMonths = this.allGroups.map(g => ({ key: `${g.year}-${g.month}`, label: g.label }));
    this.applyFilter();
  }

  /**
   * Groups sorted YYYY-MM-DD date strings into runs of consecutive calendar days.
   * E.g. ["2026-07-01","2026-07-02","2026-07-05"] → [{1,2},{5,5}]
   */
  private groupConsecutiveRuns(dates: string[]): { startDay: number; endDay: number }[] {
    if (!dates.length) return [];
    const days = dates.map(d => parseInt(d.split('-')[2], 10)).sort((a, b) => a - b);
    const runs: { startDay: number; endDay: number }[] = [];
    let start = days[0], end = days[0];
    for (let i = 1; i < days.length; i++) {
      if (days[i] === end + 1) {
        end = days[i];
      } else {
        runs.push({ startDay: start, endDay: end });
        start = days[i];
        end = days[i];
      }
    }
    runs.push({ startDay: start, endDay: end });
    return runs;
  }

  private buildCalendarCells(year: number, month: number, entries: HistoryEntry[]): CalendarCell[] {
    const cells: CalendarCell[] = [];
    const firstDay  = new Date(year, month - 1, 1);
    const daysInMon = new Date(year, month, 0).getDate();
    const leadingBlanks = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

    for (let i = 0; i < leadingBlanks; i++) {
      cells.push({ dayNum: null, dateStr: '', entries: [], isWeekend: false });
    }

    for (let d = 1; d <= daysInMon; d++) {
      const date    = new Date(year, month - 1, d);
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dow     = date.getDay();
      cells.push({
        dayNum: d,
        dateStr,
        entries: entries.filter(e => e.vacations.some(v => v.date === dateStr)),
        isWeekend: dow === 0 || dow === 6,
      });
    }

    const trailing = (7 - (cells.length % 7)) % 7;
    for (let i = 0; i < trailing; i++) {
      cells.push({ dayNum: null, dateStr: '', entries: [], isWeekend: false });
    }
    return cells;
  }

  applyFilter(): void {
    let groups = this.allGroups;
    if (this.filterMonth) {
      const [y, m] = this.filterMonth.split('-').map(Number);
      groups = groups.filter(g => g.year === y && g.month === m);
    }
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      groups = groups.map(g => ({
        ...g,
        entries: g.entries.filter(e => e.member.name.toLowerCase().includes(q)),
        calendarCells: g.calendarCells.map(c => ({
          ...c,
          entries: c.entries.filter(e => e.member.name.toLowerCase().includes(q)),
        })),
      })).filter(g => g.entries.length > 0);
    }
    this.filteredGroups = groups;
  }

  getMonthTicks(group: MonthGroup): { label: string; widthPct: number; leftPct: number }[] {
    const d = group.daysInMonth;
    const ticks = [1, 5, 10, 15, 20, 25, 30].filter(n => n <= d);
    return ticks.map((n, i, arr) => ({
      label:    String(n),
      widthPct: i < arr.length - 1 ? ((arr[i + 1] - n) / d) * 100 : ((d - n + 1) / d) * 100,
      leftPct:  ((n - 1) / d) * 100,
    }));
  }

  formatShortDate(dateStr: string): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' });
  }

  // ── PNG export ────────────────────────────────────────────────────────────
  //
  // Renders an elegant report card (team | member | one column per day) straight
  // to a <canvas>, then shows it in a preview modal with Copy/Download actions.
  // No server round-trip, no library — the report is just rounded rects + text.

  exportMonth(group: MonthGroup): void {
    const rows = [...group.entries].sort((a, b) =>
      a.member.department.localeCompare(b.member.department) ||
      a.member.position.localeCompare(b.member.position) ||
      a.member.name.localeCompare(b.member.name)
    );

    const vnHolidayDates = new Set(
      this.holidays
        .filter(h => {
          const c = (h.country ?? '').toLowerCase();
          return c.includes('viet') || c === 'vn';
        })
        .map(h => h.date)
    );

    const typeByDate = rows.map(entry => {
      const map = new Map<string, VacationType>();
      entry.vacations.forEach(v => map.set(v.date, v.type));
      return map;
    });

    // ── Layout ──────────────────────────────────────────────────────────────
    const teamColW = 90, nameColW = 170, dayColW = 27;
    const dayNumH = 22, weekdayH = 18, headerH = dayNumH + weekdayH;
    const rowH = 28;
    const pad = 22, margin = 20, cardRadius = 18;
    const gapAfterGrid = 18, legendH = 16;

    const gridW = teamColW + nameColW + group.daysInMonth * dayColW;
    const cardW = gridW + pad * 2;
    const cardH = pad + headerH + rowH * rows.length + gapAfterGrid + legendH + pad;
    const canvasW = cardW + margin * 2;
    const canvasH = cardH + margin * 2;

    const dpr = window.devicePixelRatio || 1;
    const canvas = document.createElement('canvas');
    canvas.width = canvasW * dpr;
    canvas.height = canvasH * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = this.EXPORT_PAGE_BG;
    ctx.fillRect(0, 0, canvasW, canvasH);

    const cardX = margin, cardY = margin;

    ctx.save();
    this.roundedRectPath(ctx, cardX, cardY, cardW, cardH, cardRadius);
    ctx.clip();
    ctx.fillStyle = this.EXPORT_CARD_BG;
    ctx.fillRect(cardX, cardY, cardW, cardH);

    const gridLeft = cardX + pad;
    const gridTop = cardY + pad;

    // Header band — month/year sits over the frozen team+member columns, like a corner label
    ctx.fillStyle = this.EXPORT_HEADER_BG;
    ctx.fillRect(gridLeft, gridTop, gridW, headerH);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(group.label, gridLeft + (teamColW + nameColW) / 2, gridTop + headerH / 2);

    const weekdayAbbrev = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    for (let d = 1; d <= group.daysInMonth; d++) {
      const dx = gridLeft + teamColW + nameColW + (d - 1) * dayColW;
      const dow = new Date(group.year, group.month - 1, d).getDay();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px Arial, sans-serif';
      ctx.fillText(String(d), dx + dayColW / 2, gridTop + dayNumH / 2);
      ctx.fillStyle = this.EXPORT_HEADER_SUB;
      ctx.font = '9px Arial, sans-serif';
      ctx.fillText(weekdayAbbrev[dow], dx + dayColW / 2, gridTop + dayNumH + weekdayH / 2);
    }

    // Data rows
    const gridBodyTop = gridTop + headerH;
    rows.forEach((entry, i) => {
      const y = gridBodyTop + i * rowH;

      ctx.fillStyle = this.teamRowColor(entry.member.department);
      ctx.fillRect(gridLeft, y, gridW, rowH);

      for (let d = 1; d <= group.daysInMonth; d++) {
        const dow = new Date(group.year, group.month - 1, d).getDay();
        if (dow === 0 || dow === 6) {
          const dx = gridLeft + teamColW + nameColW + (d - 1) * dayColW;
          ctx.fillStyle = this.EXPORT_WEEKEND_BG;
          ctx.fillRect(dx, y, dayColW, rowH);
        }
      }

      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#334155';
      ctx.font = '600 11.5px Arial, sans-serif';
      ctx.fillText(entry.member.department, gridLeft + 10, y + rowH / 2, teamColW - 16);
      ctx.fillStyle = '#0F172A';
      ctx.fillText(`${entry.member.avatarUrl}  ${entry.member.name}`, gridLeft + teamColW + 10, y + rowH / 2, nameColW - 16);

      for (let d = 1; d <= group.daysInMonth; d++) {
        const dx = gridLeft + teamColW + nameColW + (d - 1) * dayColW;
        const dateStr = `${group.year}-${String(group.month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const type = typeByDate[i].get(dateStr);
        const style = type ? this.EXPORT_TYPE_STYLE[type]
          : vnHolidayDates.has(dateStr) ? this.EXPORT_HOLIDAY_STYLE
          : null;
        if (!style) continue;

        const chipW = dayColW - 6, chipH = rowH - 8;
        this.roundedRectPath(ctx, dx + 3, y + 4, chipW, chipH, 5);
        ctx.fillStyle = style.bg;
        ctx.fill();
        ctx.fillStyle = style.fg;
        ctx.font = 'bold 11px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(style.letter, dx + dayColW / 2, y + rowH / 2 + 0.5);
      }
    });

    // Column dividers + bottom border
    const gridBodyBottom = gridBodyTop + rowH * rows.length;
    ctx.strokeStyle = this.EXPORT_DIVIDER;
    ctx.lineWidth = 1;
    [teamColW, teamColW + nameColW].forEach(offset => {
      const lx = gridLeft + offset + 0.5;
      ctx.beginPath();
      ctx.moveTo(lx, gridTop);
      ctx.lineTo(lx, gridBodyBottom);
      ctx.stroke();
    });
    ctx.beginPath();
    ctx.moveTo(gridLeft, gridBodyBottom + 0.5);
    ctx.lineTo(gridLeft + gridW, gridBodyBottom + 0.5);
    ctx.stroke();

    const legendY = gridBodyBottom + gapAfterGrid;

    // Legend
    const legendItems: { bg: string; fg: string; label: string }[] = [
      { bg: this.EXPORT_WEEKEND_BG, fg: '#64748B', label: 'Weekend' },
      { bg: this.EXPORT_TYPE_STYLE.Vacation.bg, fg: this.EXPORT_TYPE_STYLE.Vacation.fg, label: 'Vacation (V)' },
      { bg: this.EXPORT_TYPE_STYLE.Compensation.bg, fg: this.EXPORT_TYPE_STYLE.Compensation.fg, label: 'Compensation (C)' },
      { bg: this.EXPORT_HOLIDAY_STYLE.bg, fg: this.EXPORT_HOLIDAY_STYLE.fg, label: 'VN Holiday (P)' },
      { bg: this.EXPORT_TYPE_STYLE.Event.bg, fg: this.EXPORT_TYPE_STYLE.Event.fg, label: 'Event (E)' },
    ];
    let lx = gridLeft;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '11px Arial, sans-serif';
    legendItems.forEach(item => {
      this.roundedRectPath(ctx, lx, legendY + 1, 14, 14, 4);
      ctx.fillStyle = item.bg;
      ctx.fill();
      ctx.fillStyle = '#475569';
      ctx.fillText(item.label, lx + 20, legendY + 8);
      lx += 20 + ctx.measureText(item.label).width + 18;
    });

    ctx.restore(); // drop the rounded-card clip

    ctx.strokeStyle = this.EXPORT_DIVIDER;
    ctx.lineWidth = 1;
    this.roundedRectPath(ctx, cardX + 0.5, cardY + 0.5, cardW - 1, cardH - 1, cardRadius);
    ctx.stroke();

    canvas.toBlob(blob => {
      // canvas.toBlob's callback isn't patched by zone.js, so re-enter Angular's
      // zone explicitly — otherwise these updates never trigger change detection.
      this.ngZone.run(() => {
        if (!blob) return;
        if (this.previewImageUrl) URL.revokeObjectURL(this.previewImageUrl);
        this.previewBlob = blob;
        this.previewImageUrl = URL.createObjectURL(blob);
        this.previewFilename = `vacation-report-${group.year}-${String(group.month).padStart(2, '0')}.png`;
        this.copyFeedback = null;
      });
    });
  }

  private roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    const rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }

  private teamRowColor(team: string): string {
    let h = 0;
    for (let i = 0; i < team.length; i++) h = (Math.imul(31, h) + team.charCodeAt(i)) | 0;
    return this.EXPORT_TEAM_ROW_COLORS[Math.abs(h) % this.EXPORT_TEAM_ROW_COLORS.length];
  }

  // ── Preview modal actions ─────────────────────────────────────────────────

  closePreview(): void {
    if (this.previewImageUrl) URL.revokeObjectURL(this.previewImageUrl);
    this.previewImageUrl = null;
    this.previewBlob = null;
    this.previewFilename = '';
    this.copyFeedback = null;
  }

  downloadPreview(): void {
    if (!this.previewImageUrl) return;
    const a = document.createElement('a');
    a.href = this.previewImageUrl;
    a.download = this.previewFilename;
    a.click();
  }

  async copyPreviewImage(): Promise<void> {
    if (!this.previewBlob) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': this.previewBlob })]);
      this.copyFeedback = 'Copied to clipboard!';
    } catch {
      this.copyFeedback = 'Copy failed — use Download instead.';
    }
    setTimeout(() => { this.copyFeedback = null; }, 2500);
  }
}

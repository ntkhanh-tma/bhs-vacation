import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { DataService } from '../../core/services/data.service';
import { Member, Vacation } from '../../core/models/models';

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
                  class="flex items-center gap-1.5 text-xs text-[#64748B] hover:text-[#1E293B] border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50 transition-colors">
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
                  <p class="text-xs font-semibold text-[#1E293B] truncate">{{ entry.member.name }}</p>
                  <p class="text-[10px] text-[#94a3b8]">
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
                     class="text-[10px] text-[#94a3b8] select-none"
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
                   class="text-center text-[11px] font-semibold py-1.5 rounded"
                   [class.text-slate-400]="i >= 5"
                   [class.text-[#64748B]]="i < 5"
                   [class.bg-slate-50]="i >= 5">
                {{ h }}
              </div>
            </div>

            <!-- Calendar cells -->
            <div class="grid grid-cols-7 gap-0.5">
              <div *ngFor="let cell of group.calendarCells"
                   class="min-h-[80px] rounded-lg border text-left overflow-hidden"
                   [class.border-transparent]="!cell.dayNum"
                   [class.invisible]="!cell.dayNum"
                   [class.border-gray-100]="!!cell.dayNum && !cell.isWeekend"
                   [class.bg-white]="!!cell.dayNum && !cell.isWeekend"
                   [class.border-slate-200]="!!cell.dayNum && cell.isWeekend"
                   [class.bg-slate-100]="!!cell.dayNum && cell.isWeekend">
                <ng-container *ngIf="cell.dayNum">
                  <div class="flex flex-col gap-0.5 h-full p-1">
                    <span class="text-[10px] font-medium leading-none mb-0.5"
                          [class.text-slate-400]="cell.isWeekend"
                          [class.text-[#64748B]]="!cell.isWeekend">
                      {{ cell.dayNum }}
                    </span>
                    <div *ngFor="let entry of cell.entries.slice(0, 3)"
                         class="flex items-center gap-0.5 rounded px-1 py-px w-full overflow-hidden"
                         [style.background-color]="entry.color">
                      <span class="text-[9px] leading-none flex-shrink-0 select-none">{{ entry.member.avatarUrl }}</span>
                      <span class="text-[8px] font-semibold text-white truncate leading-tight">{{ entry.member.name }}</span>
                    </div>
                    <span *ngIf="cell.entries.length > 3"
                          class="text-[8px] text-[#64748B] font-medium px-1 leading-tight">
                      +{{ cell.entries.length - 3 }} more
                    </span>
                  </div>
                </ng-container>
              </div>
            </div>

            <!-- Legend -->
            <div *ngIf="group.entries.length > 0" class="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-x-3 gap-y-1.5">
              <div *ngFor="let entry of group.entries"
                   class="flex items-center gap-1.5 text-xs text-[#64748B]">
                <span class="text-base leading-none select-none">{{ entry.member.avatarUrl }}</span>
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
  private destroy$ = new Subject<void>();

  activeBtn   = 'px-3 py-1.5 text-sm rounded-lg bg-[#003bc4] text-white font-medium';
  inactiveBtn = 'px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-[#64748B] hover:bg-gray-50';

  constructor(private dataService: DataService, private router: Router) {}

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  ngOnInit(): void {
    this.dataService.authenticatedUser$.pipe(takeUntil(this.destroy$)).subscribe(u => {
      this.currentUserUsername = u?.username ?? null;
      if (!u && !this.dataService.loading) this.router.navigate(['/home']);
      this.buildHistory();
    });
    this.dataService.vacations$.pipe(takeUntil(this.destroy$)).subscribe(() => this.buildHistory());
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

  // Placeholder — image export to be implemented once design is ready
  exportMonth(_group: MonthGroup): void {}
}

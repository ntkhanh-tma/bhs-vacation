import { Component, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { DataService } from '../../core/services/data.service';
import { Holiday, Vacation, VacationType } from '../../core/models/models';

interface DialogDay {
  date: Date | null;
  dateStr: string;
  isCurrentMonth: boolean;
  isWeekend: boolean;
  isPast: boolean;
  isHoliday: boolean;
  isSelected: boolean;
  isToday: boolean;
}

interface TypeOption {
  value: VacationType;
  label: string;
  activeClass: string;
}

@Component({
  selector: 'app-register-vacation-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
         (click)="onBackdropClick($event)">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8"
           (click)="$event.stopPropagation()">

        <!-- Header -->
        <div class="flex justify-between items-start mb-4">
          <div>
            <h2 class="text-xl font-bold text-[#1E293B]">Register {{ selectedType }}</h2>
            <p class="text-[#64748B] text-sm mt-1">
              Select or deselect days — blue dots are already registered.
            </p>
          </div>
          <button (click)="close.emit()"
                  [disabled]="submitting"
                  class="text-[#64748B] hover:text-[#1E293B] text-xl leading-none disabled:opacity-40 disabled:cursor-not-allowed">&times;</button>
        </div>

        <!-- Type selector -->
        <div class="flex gap-2 mb-4">
          <button *ngFor="let t of typeOptions"
                  (click)="selectedType = t.value"
                  [class]="getTypeButtonClass(t)">
            {{ t.label }}
          </button>
        </div>

        <!-- Month navigation -->
        <div class="flex items-center justify-between mb-4">
          <button (click)="prevMonth()"
                  [disabled]="!canGoPrev"
                  class="p-1 rounded text-xl leading-none"
                  [class]="canGoPrev ? 'hover:bg-gray-100 text-[#64748B]' : 'text-gray-200 cursor-not-allowed'">&#8249;</button>
          <span class="font-semibold text-[#1E293B]">{{ monthLabel }}</span>
          <button (click)="nextMonth()"
                  class="p-1 rounded hover:bg-gray-100 text-[#64748B] text-xl leading-none">&#8250;</button>
        </div>

        <!-- Lock banner for closed months -->
        <div *ngIf="isViewingLockedMonth"
             class="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 text-center">
          Registration closed for this month — earliest available is
          <strong>{{ earliestMonthLabel }}</strong>.
        </div>

        <!-- Day-of-week headers -->
        <div class="grid grid-cols-7 mb-1">
          <div *ngFor="let d of dayHeaders"
               class="text-center text-xs font-medium text-[#64748B] py-1">{{ d }}</div>
        </div>

        <!-- Calendar grid -->
        <div class="grid grid-cols-7 gap-1">
          <div *ngFor="let day of calendarDays"
               (click)="toggleDay(day)"
               [class]="getDayClass(day)">
            <ng-container *ngIf="day.date">
              {{ day.date.getDate() }}
              <!-- blue dot = already registered in this month -->
              <span *ngIf="isOriginal(day.dateStr) && !day.isSelected"
                    class="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#003bc4]">
              </span>
            </ng-container>
          </div>
        </div>

        <!-- Selected chips + diff indicator -->
        <div class="mt-4">
          <div class="flex items-center justify-between mb-2">
            <p class="text-xs font-medium text-[#64748B]">Selected Dates</p>
            <span *ngIf="hasChanges" class="text-xs font-medium text-[#003bc4]">
              <span *ngIf="addDates.length">+{{ addDates.length }} added</span>
              <span *ngIf="addDates.length && removeDates.length">, </span>
              <span *ngIf="removeDates.length" class="text-red-500">-{{ removeDates.length }} removed</span>
            </span>
          </div>
          <div class="flex flex-wrap gap-2 min-h-8">
            <span *ngFor="let d of selectedDates"
                  class="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full"
                  [class]="isNewlyAdded(d)
                    ? 'bg-green-100 text-green-700'
                    : 'bg-[#e8eefb] text-[#003bc4]'">
              {{ formatChipDate(d) }}
              <button (click)="removeDate(d)"
                      class="hover:opacity-70 leading-none">&times;</button>
            </span>
            <span *ngIf="selectedDates.length === 0"
                  class="text-xs text-[#64748B] self-center">No days selected for this month.</span>
          </div>
        </div>

        <!-- 5-minute lock warning -->
        <div *ngIf="lockRemainingMs > 0"
             class="mt-3 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg text-xs text-orange-700 text-center">
          Submission locked — next available in
          <span class="font-semibold tabular-nums">{{ lockRemainingDisplay }}</span>
        </div>

        <!-- Error message -->
        <div *ngIf="submitError"
             class="mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          {{ submitError }}
        </div>

        <!-- Actions -->
        <div class="flex gap-3 mt-4">
          <button (click)="close.emit()"
                  [disabled]="submitting"
                  class="flex-1 border border-gray-200 text-[#1E293B] rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
            Cancel
          </button>
          <button (click)="onSubmit()"
                  [disabled]="!hasChanges || submitting || lockRemainingMs > 0 || isViewingLockedMonth"
                  class="flex-1 bg-[#003bc4] text-white rounded-lg py-2.5 text-sm font-medium
                         hover:bg-[#002da3] disabled:opacity-50 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2">
            <ng-container *ngIf="!submitting">
              {{ hasChanges ? 'Save changes' : 'No changes' }}
            </ng-container>
            <ng-container *ngIf="submitting">
              <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle class="opacity-25" cx="12" cy="12" r="10"
                        stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              Saving…
            </ng-container>
          </button>
        </div>

      </div>
    </div>
  `,
})
export class RegisterVacationDialogComponent implements OnInit, OnDestroy {
  @Output() close = new EventEmitter<void>();
  @Output() submitted = new EventEmitter<void>();

  dayHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  calendarDays: DialogDay[] = [];

  selectedType: VacationType = 'Vacation';

  readonly typeOptions: TypeOption[] = [
    { value: 'Vacation',      label: 'Vacation',      activeClass: 'bg-[#003bc4] text-white border-[#003bc4]' },
    { value: 'Compensation',  label: 'Compensation',  activeClass: 'bg-[#06B6D4] text-white border-[#06B6D4]' },
    { value: 'Special Leave', label: 'Special Leave', activeClass: 'bg-[#F97316] text-white border-[#F97316]' },
  ];

  /** Dates the user has currently selected in the dialog. */
  selectedDates: string[] = [];
  /** Dates already persisted in the sheet when this month was loaded. */
  originalDates: string[] = [];

  viewYear = 0;
  viewMonth = 0;

  submitting = false;
  submitError: string | null = null;
  lockRemainingMs = 0;

  private holidays: Holiday[] = [];
  private allVacations: Vacation[] = [];
  private lockInterval: ReturnType<typeof setInterval> | null = null;
  private destroy$ = new Subject<void>();

  get monthLabel(): string {
    return new Date(this.viewYear, this.viewMonth - 1, 1)
      .toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
  }

  get monthKey(): string {
    return `${String(this.viewMonth).padStart(2, '0')}/${this.viewYear}`;
  }

  /** Dates in selectedDates that were NOT in originalDates (newly added). */
  get addDates(): string[] {
    const orig = new Set(this.originalDates);
    return this.selectedDates.filter(d => !orig.has(d));
  }

  /** Dates in originalDates that are no longer in selectedDates (to remove). */
  get removeDates(): string[] {
    const sel = new Set(this.selectedDates);
    return this.originalDates.filter(d => !sel.has(d));
  }

  get hasChanges(): boolean {
    return this.addDates.length > 0 || this.removeDates.length > 0;
  }

  constructor(private dataService: DataService) {}

  ngOnInit(): void {
    const earliest = this.getEarliestAllowedMonth();
    this.viewYear = earliest.year;
    this.viewMonth = earliest.month;

    this.dataService.vacations$.pipe(takeUntil(this.destroy$)).subscribe(v => {
      this.allVacations = v;
      // Do NOT call loadMonthDates() here — that would wipe the user's
      // current selections whenever the vacations stream emits (e.g. after
      // the optimistic update in submitVacation). Month dates are loaded
      // once on open and again on month navigation.
    });

    this.dataService.holidays$.pipe(takeUntil(this.destroy$)).subscribe(h => {
      this.holidays = h;
      this.buildCalendar();
    });

    this.loadMonthDates();
    this.startLockTimer();
  }

  ngOnDestroy(): void {
    this.stopLockTimer();
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Type selector ─────────────────────────────────────────────────────────

  getTypeButtonClass(t: TypeOption): string {
    const base = 'flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors';
    return this.selectedType === t.value
      ? `${base} ${t.activeClass}`
      : `${base} border-gray-200 text-[#64748B] hover:bg-gray-50`;
  }

  // ── Lock timer ────────────────────────────────────────────────────────────

  private startLockTimer(): void {
    const user = this.dataService.currentUser;
    if (!user) return;
    this.lockRemainingMs = this.dataService.getLockRemainingMs(user.username);
    if (this.lockRemainingMs > 0) {
      this.lockInterval = setInterval(() => {
        this.lockRemainingMs = this.dataService.getLockRemainingMs(user.username);
        if (this.lockRemainingMs <= 0) this.stopLockTimer();
      }, 1000);
    }
  }

  private stopLockTimer(): void {
    if (this.lockInterval !== null) {
      clearInterval(this.lockInterval);
      this.lockInterval = null;
    }
  }

  get lockRemainingDisplay(): string {
    const secs = Math.ceil(this.lockRemainingMs / 1000);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  // ── Calendar ──────────────────────────────────────────────────────────────

  private loadMonthDates(): void {
    const user = this.dataService.currentUser;
    const ym = `${this.viewYear}-${String(this.viewMonth).padStart(2, '0')}`;

    const userDates = user
      ? this.allVacations
          .filter(v => v.username === user.username && v.date.startsWith(ym))
          .map(v => v.date)
          .sort()
      : [];

    this.originalDates = [...userDates];
    this.selectedDates = [...userDates];
    this.buildCalendar();
  }

  buildCalendar(): void {
    const today = new Date();
    const firstDay = new Date(this.viewYear, this.viewMonth - 1, 1);
    const lastDay = new Date(this.viewYear, this.viewMonth, 0);
    const days: DialogDay[] = [];

    const leadingBlanks = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    for (let i = 0; i < leadingBlanks; i++) {
      days.push({ date: null, dateStr: '', isCurrentMonth: false, isWeekend: false, isPast: false, isHoliday: false, isSelected: false, isToday: false });
    }

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(this.viewYear, this.viewMonth - 1, d);
      const dateStr = this.dataService.formatDate(date);
      const dow = date.getDay();
      days.push({
        date,
        dateStr,
        isCurrentMonth: true,
        isWeekend: dow === 0 || dow === 6,
        isPast: date < new Date(today.getFullYear(), today.getMonth(), today.getDate()),
        isHoliday: this.holidays.some(h => h.date === dateStr),
        isSelected: this.selectedDates.includes(dateStr),
        isToday: dateStr === this.dataService.formatDate(today),
      });
    }

    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 0; i < remaining; i++) {
      days.push({ date: null, dateStr: '', isCurrentMonth: false, isWeekend: false, isPast: false, isHoliday: false, isSelected: false, isToday: false });
    }
    this.calendarDays = days;
  }

  getDayClass(day: DialogDay): string {
    const base = 'relative flex items-center justify-center h-9 w-9 mx-auto rounded-full text-sm select-none';
    if (!day.date) return `${base} invisible`;
    if (day.isPast || day.isWeekend || day.isHoliday) {
      return `${base} text-gray-300 cursor-not-allowed`;
    }
    if (this.isViewingLockedMonth) {
      return day.isSelected
        ? `${base} bg-[#e8eefb] text-[#003bc4] cursor-not-allowed`
        : `${base} text-gray-300 cursor-not-allowed`;
    }
    if (day.isSelected) {
      const isNew = this.isNewlyAdded(day.dateStr);
      return `${base} cursor-pointer font-semibold ${isNew ? 'bg-green-500 text-white' : 'bg-[#003bc4] text-white'}`;
    }
    if (day.isToday) {
      return `${base} cursor-pointer border-2 border-[#003bc4] text-[#003bc4] font-semibold hover:bg-[#e8eefb]`;
    }
    return `${base} cursor-pointer text-[#1E293B] hover:bg-[#e8eefb]`;
  }

  toggleDay(day: DialogDay): void {
    if (!day.date || day.isPast || day.isWeekend || day.isHoliday || this.isViewingLockedMonth) return;
    if (this.selectedDates.includes(day.dateStr)) {
      this.selectedDates = this.selectedDates.filter(d => d !== day.dateStr);
    } else {
      this.selectedDates = [...this.selectedDates, day.dateStr].sort();
    }
    this.submitError = null;
    this.buildCalendar();
  }

  removeDate(dateStr: string): void {
    this.selectedDates = this.selectedDates.filter(d => d !== dateStr);
    this.submitError = null;
    this.buildCalendar();
  }

  isOriginal(dateStr: string): boolean {
    return this.originalDates.includes(dateStr);
  }

  isNewlyAdded(dateStr: string): boolean {
    return !this.originalDates.includes(dateStr);
  }

  formatChipDate(dateStr: string): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' });
  }

  // ── Lock period helpers ───────────────────────────────────────────────────
  //
  // Rule: before the 20th of month M → earliest allowed = M+1
  //       on/after the 20th of month M → earliest allowed = M+2

  getEarliestAllowedMonth(): { year: number; month: number } {
    const today = new Date();
    let month = today.getMonth() + 1 + (today.getDate() >= 20 ? 2 : 1);
    let year = today.getFullYear();
    if (month > 12) { month -= 12; year++; }
    return { year, month };
  }

  get isViewingLockedMonth(): boolean {
    const e = this.getEarliestAllowedMonth();
    return this.viewYear < e.year || (this.viewYear === e.year && this.viewMonth < e.month);
  }

  get canGoPrev(): boolean {
    const e = this.getEarliestAllowedMonth();
    const prevMonth = this.viewMonth === 1 ? 12 : this.viewMonth - 1;
    const prevYear  = this.viewMonth === 1 ? this.viewYear - 1 : this.viewYear;
    return prevYear > e.year || (prevYear === e.year && prevMonth >= e.month);
  }

  get earliestMonthLabel(): string {
    const e = this.getEarliestAllowedMonth();
    return new Date(e.year, e.month - 1, 1).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
  }

  prevMonth(): void {
    if (!this.canGoPrev) return;
    if (this.viewMonth === 1) { this.viewMonth = 12; this.viewYear--; }
    else this.viewMonth--;
    this.submitError = null;
    this.loadMonthDates();
  }

  nextMonth(): void {
    if (this.viewMonth === 12) { this.viewMonth = 1; this.viewYear++; }
    else this.viewMonth++;
    this.submitError = null;
    this.loadMonthDates();
  }

  // ── Submission ────────────────────────────────────────────────────────────

  onSubmit(): void {
    if (!this.hasChanges || this.submitting || this.lockRemainingMs > 0 || this.isViewingLockedMonth) return;
    this.submitting = true;
    this.submitError = null;

    this.dataService.submitVacation(this.addDates, this.removeDates, this.monthKey, this.selectedType)
      .subscribe({
        next: result => {
          this.submitting = false;
          if (result.success) {
            this.submitted.emit();
            this.close.emit();
          } else {
            this.submitError = result.error ?? 'Submission failed. Please try again.';
            this.startLockTimer();
          }
        },
        error: () => {
          this.submitting = false;
          this.submitError = 'Network error. Please try again.';
        },
      });
  }

  onBackdropClick(_event: MouseEvent): void {
    if (this.submitting) return;
    this.close.emit();
  }
}

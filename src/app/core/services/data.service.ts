import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, combineLatest } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { Member, Holiday, Vacation, VacationType, ReleasePlan, EventPlan } from '../models/models';
import { ApiService, ProfileUpdatePayload } from './api.service';

const LOCK_KEY    = 'vacation_submission_lock';
const SESSION_KEY = 'bhs_vacation_user';
const LOCK_DURATION_MS = 5 * 60 * 1000; // 5 minutes

@Injectable({ providedIn: 'root' })
export class DataService {
  private membersSubject      = new BehaviorSubject<Member[]>([]);
  private holidaysSubject     = new BehaviorSubject<Holiday[]>([]);
  private vacationsSubject    = new BehaviorSubject<Vacation[]>([]);
  private releasePlansSubject = new BehaviorSubject<ReleasePlan[]>([]);
  private eventPlansSubject   = new BehaviorSubject<EventPlan[]>([]);
  private authenticatedUser$$ = new BehaviorSubject<Member | null>(null);
  private loading$$           = new BehaviorSubject<boolean>(true);

  readonly members$           = this.membersSubject.asObservable();
  readonly holidays$          = this.holidaysSubject.asObservable();
  readonly vacations$         = this.vacationsSubject.asObservable();
  readonly releasePlans$      = this.releasePlansSubject.asObservable();
  readonly eventPlans$        = this.eventPlansSubject.asObservable();
  readonly authenticatedUser$ = this.authenticatedUser$$.asObservable();
  readonly loading$           = this.loading$$.asObservable();

  constructor(private api: ApiService) {
    this.loadRemoteData();
  }

  // ── Data loading ──────────────────────────────────────────────────────────

  private loadRemoteData(): void {
    this.loading$$.next(true);
    combineLatest([
      this.api.fetchMembers(),
      this.api.fetchHolidays(),
      this.api.fetchVacations(),
      this.api.fetchReleasePlans(),
      this.api.fetchEventPlans(),
    ]).subscribe({
      next: ([members, holidays, vacations, releasePlans, eventPlans]) => {
        this.membersSubject.next(members);
        this.holidaysSubject.next(holidays);
        this.vacationsSubject.next(vacations);
        this.releasePlansSubject.next(releasePlans);
        this.eventPlansSubject.next(eventPlans);
        this.loading$$.next(false);
        // Auto-login from saved session
        try {
          const saved = localStorage.getItem(SESSION_KEY);
          if (saved) {
            const member = members.find(m => m.username === saved);
            if (member) this.authenticatedUser$$.next(member);
          }
        } catch {}
      },
      error: () => this.loading$$.next(false),
    });
  }

  // ── Auth ──────────────────────────────────────────────────────────────────

  get currentUser(): Member | null { return this.authenticatedUser$$.value; }
  get loading(): boolean { return this.loading$$.value; }

  login(username: string): boolean {
    const member = this.membersSubject.value
      .find(m => m.username === username.trim().toLowerCase());
    if (member) {
      this.authenticatedUser$$.next(member);
      try { localStorage.setItem(SESSION_KEY, member.username); } catch {}
      return true;
    }
    return false;
  }

  logout(): void {
    this.authenticatedUser$$.next(null);
    try { localStorage.removeItem(SESSION_KEY); } catch {}
  }

  // ── Vacation submission ───────────────────────────────────────────────────

  getLockRemainingMs(username: string): number {
    try {
      const ts = parseInt(localStorage.getItem(`${LOCK_KEY}_${username}`) || '0', 10);
      return Math.max(0, LOCK_DURATION_MS - (Date.now() - ts));
    } catch {
      return 0;
    }
  }

  private setLock(username: string): void {
    try {
      localStorage.setItem(`${LOCK_KEY}_${username}`, Date.now().toString());
    } catch {}
  }

  submitVacation(
    addDates: string[],
    removeDates: string[],
    month: string,
    type: VacationType,
  ): Observable<{ success: boolean; error?: string }> {
    const user = this.authenticatedUser$$.value;
    if (!user) return of({ success: false, error: 'You must be logged in to submit.' });

    if (addDates.length === 0 && removeDates.length === 0) {
      return of({ success: false, error: 'No changes to submit.' });
    }

    const remaining = this.getLockRemainingMs(user.username);
    if (remaining > 0) {
      const secs = Math.ceil(remaining / 1000);
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      return of({
        success: false,
        error: `Please wait ${m}:${String(s).padStart(2, '0')} before submitting again.`,
      });
    }

    return this.api.submitVacationChanges({
      username: user.username,
      month,
      type,
      addDates,
      removeDates,
    }).pipe(
      tap(success => {
        if (!success) return;

        const existing = this.vacationsSubject.value;
        const afterRemove = existing.filter(
          v => !(v.username === user.username && removeDates.includes(v.date)),
        );
        const newVacs: Vacation[] = addDates.map(date => ({
          id: `${user.username}_${date}`,
          username: user.username,
          date,
          type,
        }));
        this.vacationsSubject.next([...afterRemove, ...newVacs]);

        const delta = addDates.length - removeDates.length;
        if (delta !== 0) {
          const updated = this.membersSubject.value.map(m => {
            if (m.username !== user.username) return m;
            return {
              ...m,
              daysUsed: Math.max(0, m.daysUsed + delta),
              daysLeft: Math.max(0, m.daysLeft - delta),
            };
          });
          this.membersSubject.next(updated);
          const refreshed = updated.find(m => m.username === user.username);
          if (refreshed) this.authenticatedUser$$.next(refreshed);
        }

        this.setLock(user.username);
      }),
      map(success => ({
        success,
        error: success ? undefined : 'Failed to save. Check your connection and try again.',
      })),
      catchError(() => of({ success: false, error: 'Network error. Please try again.' })),
    );
  }

  // ── Profile update ────────────────────────────────────────────────────────

  updateMemberProfile(
    updates: ProfileUpdatePayload['updates'],
  ): Observable<{ success: boolean; error?: string }> {
    const user = this.authenticatedUser$$.value;
    if (!user) return of({ success: false, error: 'Not logged in.' });

    return this.api.updateMemberProfile({
      action: 'updateProfile',
      id: user.id,
      authUsername: user.username,
      updates,
    }).pipe(
      tap(success => {
        if (!success) return;

        const newUsername = updates.username ?? user.username;
        const updated = this.membersSubject.value.map(m => {
          if (m.username !== user.username) return m;
          return {
            ...m,
            department: updates.department  ?? m.department,
            position:   updates.role        !== undefined ? (updates.role || m.position)      : m.position,
            username:   newUsername,
            dc:         updates.dc          !== undefined ? (updates.dc || undefined)         : m.dc,
            ip:         updates.ip          !== undefined ? (updates.ip || undefined)         : m.ip,
            publicIp:   updates.publicIp    !== undefined ? (updates.publicIp || undefined)   : m.publicIp,
            pcName:     updates.pcName      !== undefined ? (updates.pcName || undefined)     : m.pcName,
            macAddress: updates.macAddress  !== undefined ? (updates.macAddress || undefined) : m.macAddress,
            email:      updates.email       !== undefined ? (updates.email || undefined)      : m.email,
            mobile:     updates.mobile      !== undefined ? (updates.mobile || undefined)     : m.mobile,
            birthday:   updates.birthday    !== undefined ? (updates.birthday || undefined)   : m.birthday,
          };
        });

        this.membersSubject.next(updated);
        const refreshed = updated.find(m => m.username === newUsername);
        if (refreshed) {
          this.authenticatedUser$$.next(refreshed);
          try { localStorage.setItem(SESSION_KEY, refreshed.username); } catch {}
        }
      }),
      map(success => ({
        success,
        error: success ? undefined : 'Failed to update profile. Check your connection and try again.',
      })),
      catchError(() => of({ success: false, error: 'Network error. Please try again.' })),
    );
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  getMemberByUsername(username: string): Member | undefined {
    return this.membersSubject.value.find(m => m.username === username);
  }

  getTodayAbsentees(): { member: Member; vacation: Vacation }[] {
    const today = this.formatDate(new Date());
    return this.vacationsSubject.value
      .filter(v => v.date === today)
      .map(v => ({ vacation: v, member: this.getMemberByUsername(v.username)! }))
      .filter(x => !!x.member);
  }

  getVacationsGroupedByMonth(): {
    label: string; year: number; month: number;
    entries: { member: Member; vacations: Vacation[] }[];
  }[] {
    const today = new Date();
    const monthMap = new Map<string, { year: number; month: number; entries: Map<string, Vacation[]> }>();

    this.vacationsSubject.value.forEach(v => {
      const [year, month] = v.date.split('-').map(Number);
      const key = `${year}-${month}`;
      if (!monthMap.has(key)) monthMap.set(key, { year, month, entries: new Map() });
      const md = monthMap.get(key)!;
      if (!md.entries.has(v.username)) md.entries.set(v.username, []);
      md.entries.get(v.username)!.push(v);
    });

    return Array.from(monthMap.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([, data]) => {
        const d = new Date(data.year, data.month - 1, 1);
        const isCurrent = data.year === today.getFullYear() && data.month === today.getMonth() + 1;
        return {
          label: d.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' }) + (isCurrent ? ' (Current)' : ''),
          year: data.year,
          month: data.month,
          entries: Array.from(data.entries.entries())
            .map(([username, vacations]) => ({
              member: this.getMemberByUsername(username)!,
              vacations: vacations.sort((a, b) => a.date.localeCompare(b.date)),
            }))
            .filter(e => !!e.member),
        };
      });
  }

  formatDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}

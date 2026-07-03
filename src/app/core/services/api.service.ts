import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Member, Holiday, Vacation, VacationType, ReleasePlan, EventPlan } from '../models/models';

interface SheetsResponse {
  range: string;
  majorDimension: string;
  values: string[][];
}

interface AppsScriptResponse {
  success: boolean;
  data?: unknown[];
  error?: string;
}

export interface VacationSubmitPayload {
  username: string;
  month: string;      // MM/YYYY
  type: string;       // VacationType
  addDates: string[]; // YYYY-MM-DD
  removeDates: string[];
}

export interface DatabaseLookups {
  teams: string[];
  roles: string[];
  dcs: string[];
}

export interface ProfileUpdatePayload {
  action: 'updateProfile';
  id: string;
  authUsername: string;
  updates: {
    dc?: string;
    department?: string;
    role?: string;
    username?: string;
    ip?: string;
    publicIp?: string;
    pcName?: string;
    macAddress?: string;
    email?: string;
    mobile?: string;
    birthday?: string;
  };
}

const AVATAR_COLORS = [
  '#003bc4', '#7CC9A7', '#F7C873', '#B48CF2',
  '#F97316', '#EC4899', '#06B6D4', '#84CC16',
  '#8B5CF6', '#EF4444', '#14B8A6', '#F59E0B',
];

const ANIMAL_EMOJIS = [
  '🐶', '🐱', '🐻', '🦊', '🐼', '🐨', '🐯', '🦁',
  '🐸', '🐧', '🦉', '🦅', '🦋', '🐙', '🦄', '🦝',
  '🦘', '🦦', '🦥', '🐿️', '🦔', '🐇', '🦜', '🦩',
  '🐳', '🦭', '🐆', '🦏', '🦒', '🐘',
];

const animalEmoji = (username: string): string => {
  let h = 0;
  for (let i = 0; i < username.length; i++) {
    h = (Math.imul(31, h) + username.charCodeAt(i)) | 0;
  }
  return ANIMAL_EMOJIS[Math.abs(h) % ANIMAL_EMOJIS.length];
};

const VALID_TYPES: VacationType[] = ['Vacation', 'Compensation', 'Special Leave'];

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly base = `https://sheets.googleapis.com/v4/spreadsheets/${environment.googleSheetId}/values`;
  private readonly key = environment.googleApiKey;

  constructor(private http: HttpClient) {}

  // ── Readers ───────────────────────────────────────────────────────────────

  fetchMembers(): Observable<Member[]> {
    // A:M — all 13 columns including private profile fields
    const url = `${this.base}/Team-Info!A:M?key=${this.key}`;
    return this.http.get<SheetsResponse>(url).pipe(
      map(res => this.parseMembers(res.values ?? [])),
      catchError(err => {
        console.error('[ApiService] fetchMembers failed:', err?.error?.error?.message ?? err.message);
        return of([]);
      })
    );
  }

  fetchHolidays(): Observable<Holiday[]> {
    const url = `${this.base}/Database!Holidays?key=${this.key}`;
    return this.http.get<SheetsResponse>(url).pipe(
      map(res => this.parseHolidays(res.values ?? [])),
      catchError(err => {
        console.error('[ApiService] fetchHolidays failed:', err?.error?.error?.message ?? err.message);
        return of([]);
      })
    );
  }

  fetchDatabaseLookups(): Observable<DatabaseLookups> {
    const url = `${this.base}/Database!A:C?key=${this.key}`;
    return this.http.get<SheetsResponse>(url).pipe(
      map(res => this.parseDatabaseLookups(res.values ?? [])),
      catchError(() => of({ teams: [], roles: [], dcs: [] }))
    );
  }

  fetchVacations(): Observable<Vacation[]> {
    const url = `${this.base}/Vacation-Plan!A:D?key=${this.key}`;
    return this.http.get<SheetsResponse>(url).pipe(
      map(res => this.parseVacations(res.values ?? [])),
      catchError(err => {
        console.error('[ApiService] fetchVacations failed:', err?.error?.error?.message ?? err.message);
        return of([]);
      })
    );
  }

  fetchReleasePlans(): Observable<ReleasePlan[]> {
    const url = `${this.base}/Database!ReleasePlan?key=${this.key}`;
    return this.http.get<SheetsResponse>(url).pipe(
      map(res => this.parseReleasePlans(res.values ?? [])),
      catchError(err => {
        console.error('[ApiService] fetchReleasePlans failed:', err?.error?.error?.message ?? err.message);
        return of([]);
      })
    );
  }

  fetchEventPlans(): Observable<EventPlan[]> {
    const url = `${this.base}/Database!EventPlan?key=${this.key}`;
    return this.http.get<SheetsResponse>(url).pipe(
      map(res => this.parseEventPlans(res.values ?? [])),
      catchError(err => {
        console.error('[ApiService] fetchEventPlans failed:', err?.error?.error?.message ?? err.message);
        return of([]);
      })
    );
  }

  // ── Writers (Apps Script Web App) ─────────────────────────────────────────

  submitVacationChanges(payload: VacationSubmitPayload): Observable<boolean> {
    return this.postToScript(payload);
  }

  updateMemberProfile(payload: ProfileUpdatePayload): Observable<boolean> {
    return this.postToScript(payload);
  }

  private postToScript(payload: object): Observable<boolean> {
    const url = environment.vacationApiUrl;
    if (!url) {
      console.warn('[ApiService] VACATION_API_URL not configured — request skipped.');
      return of(false);
    }
    return this.http.post(url, JSON.stringify(payload), {
      headers: new HttpHeaders({ 'Content-Type': 'text/plain' }),
      responseType: 'text',
    }).pipe(
      map(text => {
        try {
          const res: AppsScriptResponse = JSON.parse(text);
          if (!res.success) console.error('[ApiService] script error:', res.error);
          return res.success === true;
        } catch {
          return false;
        }
      }),
      catchError(err => {
        console.error('[ApiService] script request failed:', err);
        return of(false);
      })
    );
  }

  // ── Parsers ───────────────────────────────────────────────────────────────

  private parseDatabaseLookups(rows: string[][]): DatabaseLookups {
    if (rows.length < 2) return { teams: [], roles: [], dcs: [] };
    const data = rows.slice(1);
    return {
      teams: [...new Set(data.map(r => (r[0] ?? '').trim()).filter(Boolean))],
      roles: [...new Set(data.map(r => (r[1] ?? '').trim()).filter(Boolean))],
      dcs:   [...new Set(data.map(r => (r[2] ?? '').trim()).filter(Boolean))],
    };
  }

  private parseMembers(rows: string[][]): Member[] {
    if (!rows.length) return [];
    // A=ID | B=Origin | C=Team | D=Role | E=Name | F=Username |
    // G=IP | H=Public IP | I=PC Name | J=MAC Address | K=BHS Email | L=Mobile | M=Birthday
    return rows.slice(1)
      .filter(r => r[5]?.trim())
      .map((row, i) => ({
        id:         (row[0]  ?? '').trim(),
        username:   (row[5]  ?? '').trim().toLowerCase(),
        name:       (row[4]  ?? '').trim(),
        department: (row[2]  ?? '').trim(),
        position:   (row[3]  ?? '').trim(),
        dc:         (row[1]  ?? '').trim() || undefined,
        ip:         (row[6]  ?? '').trim() || undefined,
        publicIp:   (row[7]  ?? '').trim() || undefined,
        pcName:     (row[8]  ?? '').trim() || undefined,
        macAddress: (row[9]  ?? '').trim() || undefined,
        email:      (row[10] ?? '').trim() || undefined,
        mobile:     (row[11] ?? '').trim() || undefined,
        birthday:   (row[12] ?? '').trim() || undefined,
        daysUsed:   0,
        daysLeft:   0,
        avatarUrl:  animalEmoji((row[5] ?? '').trim().toLowerCase()),
        avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
      }));
  }

  private parseHolidays(rows: string[][]): Holiday[] {
    if (!rows.length) return [];
    // Header: Date | Name | Holiday-Country
    return rows.slice(1)
      .filter(r => r[0]?.trim())
      .map(row => ({
        date:    this.normalizeDate(row[0]),
        name:    (row[1] ?? 'Holiday').trim(),
        country: (row[2] ?? '').trim() || undefined,
      }))
      .filter(h => !!h.date);
  }

  private parseReleasePlans(rows: string[][]): ReleasePlan[] {
    if (!rows.length) return [];
    // Header: ReleaseDate | Release
    return rows.slice(1)
      .filter(r => r[0]?.trim())
      .map(row => ({
        date:    this.normalizeDate(row[0]),
        release: (row[1] ?? '').trim(),
      }))
      .filter(r => !!r.date && !!r.release);
  }

  private parseEventPlans(rows: string[][]): EventPlan[] {
    if (!rows.length) return [];
    // Header: EventDate | EventDesc
    return rows.slice(1)
      .filter(r => r[0]?.trim())
      .map(row => ({
        date:        this.normalizeDate(row[0]),
        description: (row[1] ?? '').trim(),
      }))
      .filter(e => !!e.date && !!e.description);
  }

  private parseVacations(rows: string[][]): Vacation[] {
    if (!rows.length) return [];
    // Header: Month | Username | Date | Type
    return rows.slice(1)
      .filter(r => r[1]?.trim() && r[2]?.trim() && (r[3] ?? '').trim().toLowerCase() !== 'deleted')
      .map(row => {
        const username = row[1].trim().toLowerCase();
        const date     = row[2].trim();
        const rawType  = (row[3] ?? '').trim() as VacationType;
        const type: VacationType = VALID_TYPES.includes(rawType) ? rawType : 'Vacation';
        return { id: `${username}_${date}`, username, date, type };
      });
  }

  /**
   * Converts various date string formats to YYYY-MM-DD.
   * Handles: M/D/YYYY, DD/MM/YYYY, YYYY-MM-DD, and serial numbers (Google Sheets default).
   */
  private normalizeDate(raw: string): string {
    const s = (raw ?? '').trim();
    if (!s) return '';

    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    if (/^\d{5}$/.test(s)) {
      const epoch = new Date(1899, 11, 30);
      epoch.setDate(epoch.getDate() + parseInt(s, 10));
      return this.toIso(epoch);
    }

    const slash = s.split('/');
    if (slash.length === 3) {
      const [a, b, c] = slash.map(Number);
      if (c > 1000) return this.toIso(new Date(c, a - 1, b));
      if (a > 12)   return this.toIso(new Date(c, b - 1, a));
      return this.toIso(new Date(c, a - 1, b));
    }

    const parsed = new Date(s);
    return isNaN(parsed.getTime()) ? '' : this.toIso(parsed);
  }

  private toIso(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}

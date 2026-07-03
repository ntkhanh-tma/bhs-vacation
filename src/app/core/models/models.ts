export type VacationType = 'Vacation' | 'Compensation' | 'Special Leave';

export interface Member {
  id: string;            // A — row identifier, never displayed
  username: string;      // F — owner only
  name: string;          // E — display name, not editable
  department: string;    // C — Team
  position: string;      // D — Role, not editable
  dc?: string;           // B — owner only
  ip?: string;           // G — owner only
  publicIp?: string;     // H — owner only
  pcName?: string;       // I — owner only
  macAddress?: string;   // J — owner only
  email?: string;        // K — BHS email, owner only
  mobile?: string;       // L — owner only
  birthday?: string;     // M — owner only
  daysUsed: number;
  daysLeft: number;
  avatarUrl: string;
  avatarColor?: string;
}

export interface Holiday {
  date: string; // YYYY-MM-DD
  name: string;
  country?: string;
}

export interface Vacation {
  id: string;
  username: string;
  date: string; // YYYY-MM-DD
  type: VacationType;
}

export interface ReleasePlan {
  date: string; // YYYY-MM-DD
  release: string;
}

export interface EventPlan {
  date: string; // YYYY-MM-DD
  description: string;
}

export interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isWeekend: boolean;
  isToday: boolean;
  isPast: boolean;
  holidays: Holiday[];
  releases: ReleasePlan[];
  events: EventPlan[];
  yourVacation?: Vacation;
  othersVacations: { vacation: Vacation; member: Member }[];
}

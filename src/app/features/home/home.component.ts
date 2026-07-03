import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CalendarComponent } from './calendar.component';
import { DataService } from '../../core/services/data.service';
import { Member, Vacation } from '../../core/models/models';
import { RegisterVacationDialogComponent } from '../../shared/components/register-vacation-dialog.component';
import { LeaveReminderDialogComponent } from '../../shared/components/leave-reminder-dialog.component';
import { combineLatest } from 'rxjs';

interface TeamColor {
  bg: string;
  border: string;
  text: string;
}

const TEAM_COLORS: TeamColor[] = [
  { bg: '#EFF6FF', border: '#3B82F6', text: '#1D4ED8' },  // blue
  { bg: '#F0FDF4', border: '#22C55E', text: '#15803D' },  // green
  { bg: '#FFF7ED', border: '#F97316', text: '#C2410C' },  // orange
  { bg: '#FDF4FF', border: '#A855F7', text: '#7E22CE' },  // purple
  { bg: '#FFF1F2', border: '#F43F5E', text: '#BE123C' },  // rose
  { bg: '#ECFEFF', border: '#06B6D4', text: '#0E7490' },  // cyan
  { bg: '#FFFBEB', border: '#F59E0B', text: '#B45309' },  // amber
  { bg: '#F0F9FF', border: '#0EA5E9', text: '#0369A1' },  // sky
  { bg: '#F7FEE7', border: '#84CC16', text: '#4D7C0F' },  // lime
  { bg: '#FFF0F0', border: '#EF4444', text: '#B91C1C' },  // red
];

const teamColorOf = (name: string): TeamColor => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (Math.imul(31, h) + name.charCodeAt(i)) | 0;
  return TEAM_COLORS[Math.abs(h) % TEAM_COLORS.length];
};

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, CalendarComponent, RegisterVacationDialogComponent, LeaveReminderDialogComponent],
  template: `
    <div class="flex flex-col lg:flex-row gap-6">
      <!-- Main calendar area -->
      <div class="flex-1 min-w-0">
        <div class="mb-6">
          <div class="flex items-center gap-3 flex-wrap">
            <h1 class="text-2xl font-bold text-[#1E293B]">Welcome! Plan your time, track releases and events.</h1>
            <button
              *ngIf="currentUser"
              (click)="showRegisterDialog = true"
              class="btn-glow flex items-center gap-1.5 bg-[#003bc4] text-white px-3.5 py-2 rounded-lg text-sm font-medium hover:bg-[#002da3] whitespace-nowrap flex-shrink-0 transition-colors"
            >
              <img src="images/holidays.png" class="w-4 h-4 object-contain brightness-0 invert" alt="">
              Register Vacation
            </button>
          </div>
          <p class="text-[#64748B] text-sm mt-1">View team availability, upcoming releases and events, and register your vacation.</p>
        </div>
        <app-calendar></app-calendar>
      </div>

      <!-- Right stats panel: full-width on mobile, fixed width on desktop -->
      <div class="w-full lg:w-56 flex-shrink-0">
        <div class="flex lg:flex-col gap-4">
        <!-- This Month stats -->
        <div class="bg-white rounded-xl border border-gray-100 p-4">
          <p class="text-sm font-semibold text-[#1E293B] mb-3">This Month</p>
          <div class="space-y-3">
            <div class="flex items-center gap-3">
              <img src="images/members.png" class="w-8 h-8 object-contain flex-shrink-0" alt="">
              <div>
                <p class="text-xl font-bold text-[#1E293B]">{{ memberCount }}</p>
                <p class="text-xs text-[#64748B]">Members</p>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <img src="images/vacation.png" class="w-8 h-8 object-contain flex-shrink-0" alt="">
              <div>
                <p class="text-xl font-bold text-[#1E293B]">{{ vacationCount }}</p>
                <p class="text-xs text-[#64748B]">Vacations</p>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <img src="images/calendar.png" class="w-8 h-8 object-contain flex-shrink-0" alt="">
              <div>
                <p class="text-xl font-bold text-[#1E293B]">{{ holidayCount }}</p>
                <p class="text-xs text-[#64748B]">Holidays</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Today section -->
        <div class="bg-white rounded-xl border border-gray-100 p-4">
          <p class="text-sm font-semibold text-[#1E293B] mb-1">Today</p>
          <p class="text-xs text-[#64748B] mb-3">{{ todayAbsentees.length }} members absent</p>
          <div class="flex flex-col gap-2">
            <div
              *ngFor="let a of todayAbsentees"
              class="flex items-center gap-2 rounded-lg border p-2"
              [style.background-color]="getTeamColor(a.member.department).bg"
              [style.border-color]="getTeamColor(a.member.department).border"
            >
              <div
                class="w-7 h-7 rounded-full flex items-center justify-center text-base flex-shrink-0 select-none bg-white/60"
              >
                {{ a.member.avatarUrl }}
              </div>
              <div class="min-w-0">
                <p class="text-xs font-semibold truncate" [style.color]="getTeamColor(a.member.department).text">{{ a.member.name }}</p>
                <p class="text-[11px] truncate" [style.color]="getTeamColor(a.member.department).text">{{ a.member.department }}</p>
              </div>
            </div>
          </div>
          <p *ngIf="todayAbsentees.length === 0" class="text-xs text-[#64748B]">Everyone is in today!</p>
        </div>

        </div><!-- /flex lg:flex-col -->
      </div><!-- /stats panel -->
    </div><!-- /main flex -->

    <!-- Register Vacation Dialog -->
    <app-register-vacation-dialog
      *ngIf="showRegisterDialog"
      (close)="showRegisterDialog = false"
      (submitted)="onVacationRegistered()"
    ></app-register-vacation-dialog>

    <!-- Leave Reminder Dialog -->
    <app-leave-reminder-dialog
      *ngIf="showLeaveReminder"
      (close)="showLeaveReminder = false"
    ></app-leave-reminder-dialog>
  `,
})
export class HomeComponent implements OnInit {
  showRegisterDialog = false;
  showLeaveReminder = false;
  currentUser: Member | null = null;
  memberCount = 0;
  vacationCount = 0;
  holidayCount = 0;
  todayAbsentees: { member: Member; vacation: Vacation }[] = [];

  constructor(private dataService: DataService) {}

  ngOnInit(): void {
    this.dataService.authenticatedUser$.subscribe(u => this.currentUser = u);
    this.dataService.members$.subscribe(m => this.memberCount = m.length);

    combineLatest([this.dataService.vacations$, this.dataService.holidays$]).subscribe(([vacations, holidays]) => {
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth() + 1;
      const prefix = `${year}-${String(month).padStart(2, '0')}`;
      this.vacationCount = [...new Set(vacations.filter(v => v.date.startsWith(prefix)).map(v => v.username))].length;
      this.holidayCount = holidays.filter(h => h.date.startsWith(prefix)).length;
      this.todayAbsentees = this.dataService.getTodayAbsentees();
    });
  }

  onVacationRegistered(): void {
    this.todayAbsentees = this.dataService.getTodayAbsentees();
    this.showLeaveReminder = true;
  }

  getTeamColor(team: string): TeamColor {
    return teamColorOf(team);
  }
}

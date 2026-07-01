import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { DataService } from '../../core/services/data.service';
import { Member } from '../../core/models/models';

interface TeamColor {
  bg: string;
  border: string;
  text: string;
}

interface TeamGroup {
  name: string;
  members: Member[];
  color: TeamColor;
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

const FALLBACK_COLOR: TeamColor = { bg: '#F1F5F9', border: '#94A3B8', text: '#64748B' };

const teamColorOf = (name: string): TeamColor => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (Math.imul(31, h) + name.charCodeAt(i)) | 0;
  return TEAM_COLORS[Math.abs(h) % TEAM_COLORS.length];
};

@Component({
  selector: 'app-members',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div>
      <!-- Page header -->
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-[#1E293B]">Members</h1>
        <p class="text-[#64748B] text-sm mt-1">
          {{ teamGroups.length }} team{{ teamGroups.length !== 1 ? 's' : '' }}
          &nbsp;·&nbsp;
          {{ allMembers.length }} member{{ allMembers.length !== 1 ? 's' : '' }} total
        </p>
      </div>

      <!-- Team cards grid -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
        <div *ngFor="let team of teamGroups"
             (click)="toggleTeam(team.name)"
             [class]="teamCardClass(team.name)"
             [style.border-color]="selectedTeamName === team.name ? team.color.border : null"
             [style.background-color]="selectedTeamName === team.name ? team.color.bg : null">

          <!-- Colored icon -->
          <div class="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
               [style.background-color]="team.color.border">
            <img src="images/members.png" class="w-5 h-5 object-contain brightness-0 invert" alt="">
          </div>

          <p class="text-sm font-semibold text-[#1E293B] truncate">{{ team.name }}</p>
          <p class="text-xs text-[#64748B] mt-0.5">
            {{ team.members.length }} member{{ team.members.length !== 1 ? 's' : '' }}
          </p>

          <!-- Avatar stack with team-color ring -->
          <div class="flex items-center mt-3 -space-x-1">
            <div *ngFor="let m of team.members.slice(0, 4)"
                 class="w-6 h-6 rounded-full flex items-center justify-center bg-gray-100 text-sm ring-2 ring-white select-none"
                 [title]="m.name">
              {{ m.avatarUrl }}
            </div>
            <div *ngIf="team.members.length > 4"
                 class="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[9px] text-[#64748B] font-medium ring-2 ring-white">
              +{{ team.members.length - 4 }}
            </div>
          </div>

          <p class="mt-3 text-xs font-medium"
             [style.color]="selectedTeamName === team.name ? team.color.border : '#94a3b8'">
            {{ selectedTeamName === team.name ? '× Clear filter' : 'Filter ↓' }}
          </p>
        </div>
      </div>

      <!-- All Members table -->
      <div class="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <!-- Toolbar -->
        <div class="flex items-center justify-between gap-2 flex-wrap px-4 py-3 border-b border-gray-100">
          <div class="flex items-center gap-2">
            <p class="text-sm font-semibold text-[#1E293B]">
              {{ selectedTeamName ? selectedTeamName : 'All Members' }}
            </p>
            <span class="text-xs text-[#64748B] bg-gray-100 px-2 py-0.5 rounded-full">
              {{ tableMembers.length }}
            </span>
            <button *ngIf="selectedTeamName"
                    (click)="selectedTeamName = null; showAll = false"
                    class="text-xs text-[#003bc4] hover:underline ml-1">
              × Clear
            </button>
          </div>
          <div class="relative">
            <input [(ngModel)]="memberSearch"
                   type="text" placeholder="Search members..."
                   class="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003bc4] pl-7 w-36 sm:w-44">
            <span class="absolute left-2.5 top-[7px] text-gray-400 text-xs leading-none">&#128269;</span>
          </div>
        </div>

        <!-- Table -->
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="border-b border-gray-100 bg-gray-50/50">
                <th class="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Name</th>
                <th class="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Team</th>
                <th class="text-left text-xs font-semibold text-[#64748B] px-4 py-3">Role</th>
                <th class="text-right text-xs font-semibold text-[#64748B] px-4 py-3">Vacation Used</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let m of displayedMembers"
                  class="border-b border-gray-50 hover:bg-blue-50/30 last:border-0 transition-colors cursor-default"
                  (mouseenter)="onRowEnter($event, m)"
                  (mouseleave)="onRowLeave()">
                <td class="px-4 py-2.5">
                  <div class="flex items-center gap-2.5">
                    <div class="w-7 h-7 rounded-full flex items-center justify-center bg-gray-100 text-lg flex-shrink-0 select-none">
                      {{ m.avatarUrl }}
                    </div>
                    <span class="text-base font-medium text-[#1E293B]">{{ m.name }}</span>
                  </div>
                </td>
                <td class="px-4 py-2.5">
                  <span class="inline-flex text-sm font-semibold px-2.5 py-0.5 rounded-full"
                        [style.background-color]="getTeamColor(m.department).bg"
                        [style.color]="getTeamColor(m.department).text">
                    {{ m.department || '—' }}
                  </span>
                </td>
                <td class="px-4 py-2.5 text-base text-[#64748B]">{{ m.position }}</td>
                <td class="px-4 py-2.5 text-right">
                  <span *ngIf="getVacationCount(m.username) > 0"
                        class="inline-flex items-center justify-center text-sm font-semibold bg-[#e8eefb] text-[#003bc4] px-2.5 py-0.5 rounded-full">
                    {{ getVacationCount(m.username) }}
                  </span>
                  <span *ngIf="getVacationCount(m.username) === 0" class="text-sm text-[#94a3b8]">&#8212;</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Member hover card — fixed so it escapes overflow containers -->
        <div *ngIf="tooltipMember"
             class="fixed z-[200] pointer-events-none w-56 transition-opacity duration-100"
             [style.top.px]="tooltipTop"
             [style.left.px]="tooltipLeft">
          <div class="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
            <!-- Header -->
            <div class="px-4 py-3 flex items-center gap-3"
                 style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%)">
              <div class="w-10 h-10 rounded-xl flex items-center justify-center text-2xl select-none flex-shrink-0"
                   [style.background-color]="(tooltipMember.avatarColor ?? '#94a3b8') + '33'">
                {{ tooltipMember.avatarUrl }}
              </div>
              <p class="text-base font-bold text-white leading-tight">{{ tooltipMember.name }}</p>
            </div>
            <!-- Info rows -->
            <div class="px-4 py-3 space-y-2">
              <div class="flex items-center gap-2.5">
                <span class="text-xs w-3.5 text-center flex-shrink-0">&#128101;</span>
                <span class="inline-flex text-xs font-semibold px-2 py-0.5 rounded-full"
                      [style.background-color]="getTeamColor(tooltipMember.department).bg"
                      [style.color]="getTeamColor(tooltipMember.department).text">
                  {{ tooltipMember.department || '—' }}
                </span>
              </div>
              <div class="flex items-center gap-2.5">
                <span class="text-xs w-3.5 text-center flex-shrink-0">&#127991;</span>
                <span class="text-sm text-[#475569]">{{ tooltipMember.position || '—' }}</span>
              </div>
              <div class="flex items-center gap-2.5">
                <span class="text-xs w-3.5 text-center flex-shrink-0">&#128187;</span>
                <span class="text-sm font-mono text-[#475569]">{{ tooltipMember.ip || '—' }}</span>
              </div>
              <div class="flex items-center gap-2.5">
                <span class="text-xs w-3.5 text-center flex-shrink-0">&#128241;</span>
                <span class="text-sm text-[#475569]">{{ tooltipMember.mobile || '—' }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty state -->
        <div *ngIf="tableMembers.length === 0" class="text-center py-10 text-[#64748B]">
          <img src="images/members.png" class="w-10 h-10 object-contain mb-2 mx-auto opacity-30" alt="">
          <p class="text-sm">No members found.</p>
        </div>

        <!-- Show more -->
        <div *ngIf="!showAll && tableMembers.length > tableLimit"
             class="px-4 py-3 border-t border-gray-100 text-center">
          <button (click)="showAll = true"
                  class="text-sm text-[#003bc4] font-medium hover:underline">
            View all {{ tableMembers.length }} members &#8594;
          </button>
        </div>
      </div>
    </div>
  `,
})
export class MembersComponent implements OnInit, OnDestroy {
  allMembers: Member[] = [];
  teamGroups: TeamGroup[] = [];
  vacationCounts = new Map<string, number>();
  private teamColorMap = new Map<string, TeamColor>();
  private destroy$ = new Subject<void>();

  currentUser: Member | null = null;
  selectedTeamName: string | null = null;
  memberSearch = '';
  showAll = false;
  readonly tableLimit = 10;

  tooltipMember: Member | null = null;
  tooltipTop = 0;
  tooltipLeft = 0;

  get tableMembers(): Member[] {
    let members = this.allMembers;
    if (this.selectedTeamName) {
      members = members.filter(m => m.department === this.selectedTeamName);
    }
    const q = this.memberSearch.trim().toLowerCase();
    if (q) {
      members = members.filter(m =>
        m.name.toLowerCase().includes(q) ||
        m.department.toLowerCase().includes(q) ||
        m.position.toLowerCase().includes(q)
      );
    }
    return members.slice().sort((a, b) => a.name.localeCompare(b.name));
  }

  get displayedMembers(): Member[] {
    return this.showAll ? this.tableMembers : this.tableMembers.slice(0, this.tableLimit);
  }

  constructor(private dataService: DataService, private router: Router) {}

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  ngOnInit(): void {
    this.dataService.authenticatedUser$.pipe(takeUntil(this.destroy$)).subscribe(u => {
      this.currentUser = u;
      if (!u && !this.dataService.loading) this.router.navigate(['/home']);
    });
    this.dataService.members$.subscribe(members => {
      this.allMembers = members;
      this.buildTeams();
    });
    this.dataService.vacations$.subscribe(vacations => {
      const counts = new Map<string, number>();
      for (const v of vacations) {
        counts.set(v.username, (counts.get(v.username) ?? 0) + 1);
      }
      this.vacationCounts = counts;
    });
  }

  private buildTeams(): void {
    const teamMap = new Map<string, Member[]>();
    for (const m of this.allMembers) {
      const team = m.department.trim() || 'Unassigned';
      if (!teamMap.has(team)) teamMap.set(team, []);
      teamMap.get(team)!.push(m);
    }
    this.teamGroups = Array.from(teamMap.entries())
      .map(([name, members]) => ({ name, members, color: teamColorOf(name) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    this.teamColorMap = new Map(this.teamGroups.map(t => [t.name, t.color]));
  }

  toggleTeam(teamName: string): void {
    this.selectedTeamName = this.selectedTeamName === teamName ? null : teamName;
    this.showAll = false;
  }

  getTeamColor(teamName: string): TeamColor {
    return this.teamColorMap.get(teamName) ?? FALLBACK_COLOR;
  }

  getVacationCount(username: string): number {
    return this.vacationCounts.get(username) ?? 0;
  }

  onRowEnter(event: MouseEvent, member: Member): void {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.tooltipMember = member;
    this.tooltipTop = rect.top;
    this.tooltipLeft = rect.right + 8 <= window.innerWidth - 224
      ? rect.right + 8
      : rect.left - 224 - 8;
  }

  onRowLeave(): void {
    this.tooltipMember = null;
  }

  teamCardClass(teamName: string): string {
    const base = 'rounded-xl p-4 cursor-pointer transition-all group';
    return this.selectedTeamName === teamName
      ? `${base} border-2`
      : `${base} bg-white border border-gray-100 hover:shadow-md`;
  }
}

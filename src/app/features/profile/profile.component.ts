import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Member } from '../../core/models/models';
import { DataService } from '../../core/services/data.service';
import { ApiService, DatabaseLookups, ProfileUpdatePayload } from '../../core/services/api.service';

interface ProfileForm {
  department: string;
  role: string;
  dc: string;
  ip: string;
  publicIp: string;
  pcName: string;
  macAddress: string;
  email: string;
  mobile: string;
  birthday: string;
  username: string;
}

const CHEVRON_SVG = `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`;
const SELECT_STYLE = `background-image:${CHEVRON_SVG};background-repeat:no-repeat;background-position:right 0.5rem center;background-size:1.2em 1.2em;padding-right:2.2rem;`;

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="min-h-full bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 p-5 sm:p-6">
      <div class="max-w-5xl">

        <!-- Back -->
        <a routerLink="/home"
           class="inline-flex items-center gap-1 text-sm text-[#64748B] hover:text-[#1E293B] mb-6 transition-colors group">
          <span class="group-hover:-translate-x-0.5 transition-transform inline-block">&#8249;</span>
          Back to Home
        </a>

        <!-- Not logged in -->
        <div *ngIf="!user" class="bg-white rounded-2xl p-10 shadow-sm border border-gray-100 text-left max-w-sm">
          <div class="text-4xl mb-3">&#128274;</div>
          <p class="text-[#64748B] font-medium">You must be logged in to view your profile.</p>
          <a routerLink="/home" class="mt-4 inline-block text-sm text-[#003bc4] hover:underline font-medium">Go to Home</a>
        </div>

        <ng-container *ngIf="user">
          <div class="flex flex-col lg:flex-row gap-5 items-start">

            <!-- ── LEFT: Identity sidebar ────────────────────────────────── -->
            <div class="w-full lg:w-52 flex-shrink-0 space-y-4">

              <!-- Avatar + name -->
              <div class="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div class="flex flex-row lg:flex-col items-center lg:items-start gap-4">
                  <div class="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl select-none flex-shrink-0"
                       [style.background-color]="(user.avatarColor ?? '#003bc4') + '22'">
                    {{ user.avatarUrl }}
                  </div>
                  <div class="min-w-0">
                    <h1 class="text-base font-bold text-[#1E293B] leading-tight">{{ user.name }}</h1>
                    <p class="text-xs text-[#64748B] mt-0.5 truncate">{{ user.position }}</p>
                    <span *ngIf="user.department"
                          class="inline-block mt-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700">
                      {{ user.department }}
                    </span>
                  </div>
                </div>

                <!-- Read-only identifiers -->
                <div class="mt-4 pt-4 border-t border-gray-100 space-y-2">
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">ID</span>
                    <span class="text-xs font-mono text-[#475569]">{{ user.id || '—' }}</span>
                  </div>
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">Username</span>
                    <span class="text-xs font-mono text-[#475569] truncate max-w-[90px]" [title]="user.username">{{ user.username || '—' }}</span>
                  </div>
                </div>
              </div>

              <!-- Vacation stats -->
              <div class="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <p class="text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8] mb-3">Vacation Days</p>
                <div class="grid grid-cols-2 gap-2">
                  <div class="text-center bg-blue-50 rounded-xl py-3">
                    <p class="text-xl font-bold text-[#003bc4]">{{ user.daysLeft }}</p>
                    <p class="text-[10px] text-[#64748B] mt-0.5">Remaining</p>
                  </div>
                  <div class="text-center bg-slate-50 rounded-xl py-3">
                    <p class="text-xl font-bold text-[#475569]">{{ user.daysUsed }}</p>
                    <p class="text-[10px] text-[#64748B] mt-0.5">Used</p>
                  </div>
                </div>
              </div>

            </div>

            <!-- ── RIGHT: Editable form ────────────────────────────────── -->
            <div class="flex-1 min-w-0">
              <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

                <!-- Card header -->
                <div class="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600">
                  <h2 class="text-sm font-bold text-white">Edit Profile</h2>
                  <p class="text-xs text-blue-200 mt-0.5">Keep your workspace information up to date</p>
                </div>

                <div class="p-6 space-y-6">

                  <!-- ── Organization ──────────────────────────────────── -->
                  <section>
                    <h3 class="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#94a3b8] mb-3">
                      <span class="w-1.5 h-4 bg-gradient-to-b from-blue-500 to-indigo-500 rounded-full"></span>
                      Organization
                    </h3>
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label class="block text-xs font-semibold text-[#475569] mb-1.5">Team</label>
                        <div class="relative">
                          <select [(ngModel)]="form.department"
                                  class="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none cursor-pointer text-[#1E293B]"
                                  [style]="selectStyle">
                            <option value="">Select team…</option>
                            <option *ngIf="form.department && !lookups.teams.includes(form.department)" [value]="form.department">{{ form.department }}</option>
                            <option *ngFor="let t of lookups.teams" [value]="t">{{ t }}</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label class="block text-xs font-semibold text-[#475569] mb-1.5">Role</label>
                        <div class="relative">
                          <select [(ngModel)]="form.role"
                                  class="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none cursor-pointer text-[#1E293B]"
                                  [style]="selectStyle">
                            <option value="">Select role…</option>
                            <option *ngIf="form.role && !lookups.roles.includes(form.role)" [value]="form.role">{{ form.role }}</option>
                            <option *ngFor="let r of lookups.roles" [value]="r">{{ r }}</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label class="block text-xs font-semibold text-[#475569] mb-1.5">Origin</label>
                        <div class="relative">
                          <select [(ngModel)]="form.dc"
                                  class="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none cursor-pointer text-[#1E293B]"
                                  [style]="selectStyle">
                            <option value="">Select Origin…</option>
                            <option *ngIf="form.dc && !lookups.dcs.includes(form.dc)" [value]="form.dc">{{ form.dc }}</option>
                            <option *ngFor="let d of lookups.dcs" [value]="d">{{ d }}</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </section>

                  <!-- ── Network ───────────────────────────────────────── -->
                  <section>
                    <h3 class="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#94a3b8] mb-3">
                      <span class="w-1.5 h-4 bg-gradient-to-b from-emerald-500 to-teal-500 rounded-full"></span>
                      Network
                    </h3>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label class="block text-xs font-semibold text-[#475569] mb-1.5">IP Address</label>
                        <input [value]="form.ip" (input)="maskIp($event, 'ip')"
                               placeholder="192.168.1.10"
                               class="w-full text-sm font-mono border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
                      </div>
                      <div>
                        <label class="block text-xs font-semibold text-[#475569] mb-1.5">Public IP</label>
                        <input [value]="form.publicIp" (input)="maskIp($event, 'publicIp')"
                               placeholder="203.0.113.10"
                               class="w-full text-sm font-mono border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
                      </div>
                      <div>
                        <label class="block text-xs font-semibold text-[#475569] mb-1.5">PC Name</label>
                        <input [value]="form.pcName" (input)="maskPcName($event)"
                               placeholder="BHS-PC-001"
                               class="w-full text-sm font-mono border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
                      </div>
                      <div>
                        <label class="block text-xs font-semibold text-[#475569] mb-1.5">MAC Address</label>
                        <input [value]="form.macAddress" (input)="maskMac($event)"
                               placeholder="AA:BB:CC:DD:EE:FF"
                               maxlength="17"
                               class="w-full text-sm font-mono border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
                      </div>
                    </div>
                  </section>

                  <!-- ── Contact ───────────────────────────────────────── -->
                  <section>
                    <h3 class="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#94a3b8] mb-3">
                      <span class="w-1.5 h-4 bg-gradient-to-b from-violet-500 to-purple-500 rounded-full"></span>
                      Contact
                    </h3>
                    <div class="space-y-3">
                      <div>
                        <label class="block text-xs font-semibold text-[#475569] mb-1.5">BHS Email</label>
                        <input [value]="form.email" (input)="maskEmail($event)"
                               type="email"
                               placeholder="you@bestmed.com.au"
                               class="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all" />
                      </div>
                      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label class="block text-xs font-semibold text-[#475569] mb-1.5">Mobile</label>
                          <input [value]="form.mobile" (input)="maskMobile($event)"
                                 placeholder="+84 90 000 0000"
                                 class="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all" />
                          <p class="text-[10px] text-[#94a3b8] mt-1">VN&#58; +84 &nbsp;|&nbsp; AU&#58; +61</p>
                        </div>
                        <div>
                          <label class="block text-xs font-semibold text-[#475569] mb-1.5">Birthday</label>
                          <input [value]="form.birthday" (input)="maskBirthday($event)"
                                 placeholder="DD/MM"
                                 maxlength="5"
                                 class="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all" />
                          <p class="text-[10px] text-[#94a3b8] mt-1">Format&#58; DD/MM</p>
                        </div>
                      </div>
                    </div>
                  </section>

                  <!-- ── Account ───────────────────────────────────────── -->
                  <section class="border-t border-gray-100 pt-5">
                    <h3 class="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#94a3b8] mb-3">
                      <span class="w-1.5 h-4 bg-gradient-to-b from-amber-500 to-orange-500 rounded-full"></span>
                      Account
                    </h3>
                    <div>
                      <label class="block text-xs font-semibold mb-1.5"
                             [class.text-amber-600]="usernameChanged"
                             [class.text-[#475569]]="!usernameChanged">
                        Username
                        <span *ngIf="usernameChanged" class="font-normal ml-1.5">&#9888; Changing this updates your login</span>
                      </label>
                      <input [(ngModel)]="form.username"
                             autocomplete="off"
                             class="w-full text-sm font-mono rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 transition-all border"
                             [class.border-gray-200]="!usernameChanged"
                             [class.border-amber-300]="usernameChanged"
                             [class.bg-amber-50]="usernameChanged" />
                    </div>
                  </section>

                </div>

                <!-- Status + actions -->
                <div class="px-6 pb-6">
                  <div *ngIf="statusMsg"
                       class="mb-4 rounded-xl px-4 py-3 text-sm flex items-center gap-2 border"
                       [class.bg-green-50]="statusOk"
                       [class.text-green-700]="statusOk"
                       [class.border-green-200]="statusOk"
                       [class.bg-red-50]="!statusOk"
                       [class.text-red-700]="!statusOk"
                       [class.border-red-200]="!statusOk">
                    <span class="font-bold">{{ statusOk ? '&#10003;' : '&#10007;' }}</span>
                    {{ statusMsg }}
                  </div>

                  <div class="flex gap-3">
                    <button (click)="save()"
                            [disabled]="saving"
                            class="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl
                                   hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm">
                      {{ saving ? 'Saving&#8230;' : 'Save Changes' }}
                    </button>
                    <button (click)="reset()"
                            [disabled]="saving"
                            class="px-5 py-2.5 text-sm text-[#64748B] hover:text-[#1E293B] rounded-xl border border-gray-200
                                   hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                      Reset
                    </button>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </ng-container>
      </div>
    </div>
  `,
})
export class ProfileComponent implements OnInit, OnDestroy {
  user: Member | null = null;
  form: ProfileForm = this.emptyForm();
  lookups: DatabaseLookups = { teams: [], roles: [], dcs: [] };
  saving = false;
  statusMsg = '';
  statusOk = false;

  readonly selectStyle = SELECT_STYLE;

  private destroy$ = new Subject<void>();

  constructor(
    private dataService: DataService,
    private apiService: ApiService,
  ) {}

  ngOnInit(): void {
    this.dataService.authenticatedUser$.pipe(takeUntil(this.destroy$)).subscribe(u => {
      this.user = u;
      if (u) this.populateForm(u);
    });
    this.apiService.fetchDatabaseLookups().subscribe(l => this.lookups = l);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get usernameChanged(): boolean {
    return !!this.user && this.form.username.trim().toLowerCase() !== this.user.username;
  }

  // ── Input masks ─────────────────────────────────────────────────────────────

  maskIp(event: Event, field: 'ip' | 'publicIp'): void {
    const el = event.target as HTMLInputElement;
    const cleaned = el.value.replace(/[^\d.]/g, '');
    el.value = cleaned;
    if (field === 'ip') this.form.ip = cleaned;
    else this.form.publicIp = cleaned;
  }

  maskMac(event: Event): void {
    const el = event.target as HTMLInputElement;
    const raw = el.value.replace(/[^0-9a-fA-F]/g, '').toUpperCase().slice(0, 12);
    const masked = raw.replace(/(.{2})(?=.)/g, '$1:');
    this.form.macAddress = masked;
    el.value = masked;
  }

  maskPcName(event: Event): void {
    const el = event.target as HTMLInputElement;
    const cleaned = el.value.replace(/[^a-zA-Z0-9\-_]/g, '').toUpperCase();
    this.form.pcName = cleaned;
    el.value = cleaned;
  }

  maskEmail(event: Event): void {
    const el = event.target as HTMLInputElement;
    const cleaned = el.value.replace(/\s/g, '');
    this.form.email = cleaned;
    el.value = cleaned;
  }

  maskMobile(event: Event): void {
    const el = event.target as HTMLInputElement;
    const hasPlus = el.value.startsWith('+');
    let val = el.value.replace(/[^\d ]/g, '');
    if (hasPlus) val = '+' + val;
    this.form.mobile = val;
    el.value = val;
  }

  maskBirthday(event: Event): void {
    const el = event.target as HTMLInputElement;
    const isDeleting = ((event as InputEvent).inputType ?? '').startsWith('delete');
    const digits = el.value.replace(/\D/g, '').slice(0, 4);
    let masked = digits;
    if (digits.length > 2) {
      masked = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    } else if (digits.length === 2 && !isDeleting) {
      masked = digits + '/';
    }
    this.form.birthday = masked;
    el.value = masked;
  }

  // ── Form helpers ─────────────────────────────────────────────────────────────

  private emptyForm(): ProfileForm {
    return { department: '', role: '', dc: '', ip: '', publicIp: '', pcName: '', macAddress: '', email: '', mobile: '', birthday: '', username: '' };
  }

  private populateForm(u: Member): void {
    this.form = {
      department: u.department ?? '',
      role:       u.position   ?? '',
      dc:         u.dc         ?? '',
      ip:         u.ip         ?? '',
      publicIp:   u.publicIp   ?? '',
      pcName:     u.pcName     ?? '',
      macAddress: u.macAddress ?? '',
      email:      u.email      ?? '',
      mobile:     u.mobile     ?? '',
      birthday:   u.birthday   ?? '',
      username:   u.username   ?? '',
    };
  }

  reset(): void {
    if (this.user) this.populateForm(this.user);
    this.statusMsg = '';
  }

  save(): void {
    if (!this.user || this.saving) return;
    this.saving = true;
    this.statusMsg = '';

    const updates: ProfileUpdatePayload['updates'] = {
      department: this.form.department.trim(),
      role:       this.form.role.trim(),
      dc:         this.form.dc.trim(),
      ip:         this.form.ip.trim(),
      publicIp:   this.form.publicIp.trim(),
      pcName:     this.form.pcName.trim(),
      macAddress: this.form.macAddress.trim(),
      email:      this.form.email.trim(),
      mobile:     this.form.mobile.trim(),
      birthday:   this.form.birthday.trim(),
      username:   this.form.username.trim().toLowerCase(),
    };

    this.dataService.updateMemberProfile(updates).subscribe(result => {
      this.saving = false;
      this.statusOk = result.success;
      this.statusMsg = result.success ? 'Profile saved successfully.' : (result.error ?? 'Unknown error.');
    });
  }
}

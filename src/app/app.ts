import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { catchError, filter, map } from 'rxjs/operators';
import { SidebarComponent } from './shared/components/sidebar.component';
import { LoginDialogComponent } from './shared/components/login-dialog.component';
import { DataService } from './core/services/data.service';
import { Member } from './core/models/models';
import { environment } from '../environments/environment';

interface DailyQuote {
  text: string;
  author?: string; // only present for the fallback (non-riddle) quote
  answer?: string; // only present for riddles
}

interface RiddleApiResponse {
  title: string;
  question: string;
  answer: string;
}

interface FallbackQuoteApiResponse {
  quote: string;
  author: string;
}

interface CachedQuote {
  quote: DailyQuote;
  fetchedAt: number;
}

const QUOTE_CACHE_KEY = 'dailyQuoteCache';
const QUOTE_CACHE_TTL_MS = 30 * 60 * 1000;

interface ChipColor { bg: string; text: string; }

const CHIP_COLORS: ChipColor[] = [
  { bg: '#EFF6FF', text: '#1D4ED8' },
  { bg: '#F0FDF4', text: '#15803D' },
  { bg: '#FFF7ED', text: '#C2410C' },
  { bg: '#FDF4FF', text: '#7E22CE' },
  { bg: '#FFF1F2', text: '#BE123C' },
  { bg: '#ECFEFF', text: '#0E7490' },
  { bg: '#FFFBEB', text: '#B45309' },
  { bg: '#F0F9FF', text: '#0369A1' },
  { bg: '#F7FEE7', text: '#4D7C0F' },
  { bg: '#FFF0F0', text: '#B91C1C' },
];

const chipColor = (name: string, seed = 0): ChipColor => {
  let h = seed;
  for (let i = 0; i < name.length; i++) h = (Math.imul(31, h) + name.charCodeAt(i)) | 0;
  return CHIP_COLORS[Math.abs(h) % CHIP_COLORS.length];
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, SidebarComponent, LoginDialogComponent],
  template: `
    <!-- Loading overlay -->
    <div *ngIf="loading" class="fixed inset-0 bg-white flex items-center justify-center z-50">
      <div class="text-center">
        <img src="images/vacation.png" class="w-12 h-12 object-contain mb-3" alt="">
        <p class="text-[#64748B] text-sm">Loading team data…</p>
      </div>
    </div>

    <div class="flex h-screen bg-gray-50 overflow-hidden">

      <!-- Mobile/tablet sidebar backdrop -->
      <div *ngIf="sidebarOpen"
           class="fixed inset-0 bg-black/40 z-30 lg:hidden"
           (click)="sidebarOpen = false">
      </div>

      <!-- Sidebar: overlay on mobile/tablet, inline on desktop.
           lg:translate-x-0 (responsive utility) always wins over the base
           -translate-x-full binding because responsive utilities appear later
           in Tailwind's generated stylesheet. -->
      <div class="fixed lg:static inset-y-0 left-0 z-40 lg:z-auto flex-shrink-0
                  transition-transform duration-200 lg:translate-x-0"
           [class.translate-x-0]="sidebarOpen"
           [class.-translate-x-full]="!sidebarOpen">
        <app-sidebar></app-sidebar>
      </div>

      <div class="flex-1 flex flex-col min-w-0">

        <!-- Header -->
        <header class="bg-white border-b border-gray-100 px-4 sm:px-6 py-3 flex items-center gap-2 flex-shrink-0">

          <!-- Hamburger (mobile/tablet only) -->
          <button (click)="sidebarOpen = !sidebarOpen"
                  class="lg:hidden flex-shrink-0 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label="Toggle menu">
            <div class="w-5 space-y-[5px]">
              <span class="block h-0.5 bg-gray-600 rounded-full transition-all"
                    [class.w-5]="!sidebarOpen" [class.w-3]="sidebarOpen"></span>
              <span class="block h-0.5 w-5 bg-gray-600 rounded-full"></span>
              <span class="block h-0.5 bg-gray-600 rounded-full transition-all"
                    [class.w-5]="!sidebarOpen" [class.w-3]="sidebarOpen"></span>
            </div>
          </button>

          <!-- Daily quote — center of header, visible on lg+ -->
          <div class="flex-1 min-w-0 hidden lg:flex items-center justify-center">

            <!-- Skeleton while loading -->
            <div *ngIf="quoteLoading" class="flex flex-col items-center gap-1.5">
              <div class="h-2.5 w-52 rounded-full bg-gray-100 animate-pulse"></div>
              <div class="h-2 w-32 rounded-full bg-gray-100 animate-pulse"></div>
            </div>

            <!-- Quote card -->
            <div *ngIf="!quoteLoading && quote"
                 class="relative max-w-xl text-center px-7 py-2 group rounded-xl
                        bg-gradient-to-r from-blue-50/70 via-violet-50/50 to-indigo-50/70">
              <!-- Decorative opening mark -->
              <span class="absolute top-0.5 left-2 text-4xl font-serif leading-none select-none
                           bg-gradient-to-br from-blue-400 to-violet-500 bg-clip-text text-transparent">&ldquo;</span>
              <!-- Decorative closing mark -->
              <span class="absolute bottom-0.5 right-2 text-4xl font-serif leading-none select-none
                           bg-gradient-to-br from-violet-500 to-indigo-500 bg-clip-text text-transparent">&rdquo;</span>

              <!-- Quote/riddle text — 25% bigger than original 11px -->
              <p class="font-serif italic text-[14px] leading-snug text-[#3d4f6a]">
                {{ quote.text }}
              </p>

              <!-- Attribution row — only for the fallback quote API, riddles have no author -->
              <div *ngIf="quote.author" class="flex items-center justify-center gap-1.5 mt-1">
                <span class="text-xs font-semibold bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
                  — {{ quote.author }}
                </span>
              </div>

              <!-- Riddle answer reveal -->
              <div *ngIf="quote.answer" class="mt-1.5">
                <button *ngIf="!answerRevealed"
                        (click)="answerRevealed = true"
                        class="text-[11px] font-semibold text-white px-3 py-1 rounded-full
                               bg-gradient-to-r from-violet-500 to-blue-500 hover:from-violet-600 hover:to-blue-600
                               shadow-sm transition-all">
                  &#128269; Click to Reveal Answer
                </button>
                <div *ngIf="answerRevealed"
                     class="answer-reveal inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                            bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50 border border-amber-200 shadow-sm">
                  <span class="text-[10px] font-bold uppercase tracking-wide text-amber-600">&#10024; Answer</span>
                  <span class="text-xs font-medium text-amber-900">{{ quote.answer }}</span>
                </div>
              </div>

              <!-- Hover-reveal refresh -->
              <button (click)="fetchQuote()"
                      title="New quote"
                      class="absolute -right-4 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center
                             rounded-full text-[#003bc4] text-sm opacity-0 group-hover:opacity-40
                             hover:!opacity-100 hover:bg-blue-50 transition-all duration-150">
                &#8635;
              </button>
            </div>

          </div>

          <!-- Logged-in state -->
          <div *ngIf="currentUser; else loginBtn" class="flex items-center gap-3 sm:gap-4">

            <!-- Name + chips (chips hidden on very small screens) -->
            <div class="flex items-center gap-2 flex-wrap justify-end">
              <span class="text-[15px] font-semibold text-[#1E293B] hidden sm:inline">{{ currentUser.name }}</span>
              <span *ngIf="currentUser.department"
                    class="hidden md:inline-block text-xs font-bold px-2.5 py-0.5 rounded-full select-none"
                    [style.background-color]="teamChip.bg"
                    [style.color]="teamChip.text">
                {{ currentUser.department }}
              </span>
              <span *ngIf="currentUser.position"
                    class="hidden md:inline-block text-xs font-bold px-2.5 py-0.5 rounded-full select-none"
                    [style.background-color]="roleChip.bg"
                    [style.color]="roleChip.text">
                {{ currentUser.position }}
              </span>
            </div>

            <!-- Profile / settings -->
            <a routerLink="/profile"
               class="flex items-center gap-1.5 bg-[#003bc4] text-white px-3.5 py-2 rounded-lg text-sm font-medium hover:bg-[#002da3] whitespace-nowrap flex-shrink-0 transition-colors">
              <img src="images/settings.png" class="w-4 h-4 object-contain brightness-0 invert" alt="">
              Profile
            </a>

            <!-- Logout -->
            <button (click)="logout()"
                    class="flex items-center gap-1.5 bg-red-400 text-white px-3.5 py-2 rounded-lg text-sm font-medium hover:bg-red-500 whitespace-nowrap flex-shrink-0 transition-colors">
              Logout
            </button>
          </div>

          <!-- Guest state -->
          <ng-template #loginBtn>
            <button (click)="showLoginDialog = true"
                    class="flex items-center gap-1.5 text-sm border border-[#003bc4] text-[#003bc4] px-3.5 py-2 rounded-lg hover:bg-[#e8eefb] font-medium flex-shrink-0 transition-colors whitespace-nowrap">
              Login
            </button>
          </ng-template>

        </header>

        <!-- Page content -->
        <main class="flex-1 overflow-auto p-4 sm:p-6">
          <router-outlet></router-outlet>
        </main>

      </div>
    </div>

    <app-login-dialog
      *ngIf="showLoginDialog"
      (close)="showLoginDialog = false"
      (loggedIn)="showLoginDialog = false"
    ></app-login-dialog>
  `,
  styles: [`
    @keyframes answerReveal {
      0%   { opacity: 0; transform: translateY(-4px) scale(0.96); }
      100% { opacity: 1; transform: translateY(0) scale(1); }
    }
    .answer-reveal { animation: answerReveal 0.3s ease-out; }
  `],
})
export class AppComponent implements OnInit {
  showLoginDialog = false;
  currentUser: Member | null = null;
  loading = true;
  sidebarOpen = false;

  teamChip: ChipColor = { bg: '', text: '' };
  roleChip: ChipColor = { bg: '', text: '' };

  quote: DailyQuote | null = null;
  quoteLoading = true;
  answerRevealed = false;

  constructor(private dataService: DataService, private router: Router, private http: HttpClient) {}

  ngOnInit(): void {
    this.dataService.authenticatedUser$.subscribe(u => {
      this.currentUser = u;
      this.teamChip = u?.department ? chipColor(u.department)     : { bg: '', text: '' };
      this.roleChip = u?.position   ? chipColor(u.position, 5381) : { bg: '', text: '' };
    });
    this.dataService.loading$.subscribe(l => this.loading = l);

    // Close sidebar when navigating (mobile UX)
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe(() => this.sidebarOpen = false);

    this.fetchQuote();
  }

  fetchQuote(): void {
    this.answerRevealed = false;

    const cached = this.readCachedQuote();
    if (cached) {
      this.quote = cached;
      this.quoteLoading = false;
      return;
    }

    this.quoteLoading = true;
    this.quote = null;
    this.http.get<RiddleApiResponse[]>('https://api.api-ninjas.com/v1/riddles', {
      headers: { 'X-Api-Key': environment.apiNinjasKey },
    }).pipe(
      map(res => {
        const riddle = res?.[0];
        if (!riddle) throw new Error('No riddle returned');
        return { text: riddle.question, answer: riddle.answer } as DailyQuote;
      }),
      // Fall back to a plain quote if API Ninjas fails or is unreachable.
      catchError(() => this.http.get<FallbackQuoteApiResponse>('https://dummyjson.com/quotes/random').pipe(
        map(q => ({ text: q.quote, author: q.author } as DailyQuote)),
      )),
    ).subscribe({
      next: q => {
        this.quote = q;
        this.quoteLoading = false;
        if (q) this.cacheQuote(q);
      },
      error: () => { this.quoteLoading = false; },
    });
  }

  /** Returns the cached quote if it was fetched less than 30 minutes ago. */
  private readCachedQuote(): DailyQuote | null {
    try {
      const raw = localStorage.getItem(QUOTE_CACHE_KEY);
      if (!raw) return null;
      const cached: CachedQuote = JSON.parse(raw);
      if (Date.now() - cached.fetchedAt > QUOTE_CACHE_TTL_MS) return null;
      return cached.quote;
    } catch {
      return null;
    }
  }

  private cacheQuote(quote: DailyQuote): void {
    try {
      const cached: CachedQuote = { quote, fetchedAt: Date.now() };
      localStorage.setItem(QUOTE_CACHE_KEY, JSON.stringify(cached));
    } catch {
      // localStorage unavailable (e.g. private browsing) — skip caching
    }
  }

  logout(): void {
    this.dataService.logout();
  }
}

import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../core/services/data.service';

@Component({
  selector: 'app-login-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
         (click)="onBackdropClick($event)">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8"
           (click)="$event.stopPropagation()">
        <div class="flex justify-between items-start mb-6">
          <div>
            <h2 class="text-2xl font-bold text-[#1E293B]">Welcome Back</h2>
            <p class="text-[#64748B] text-sm mt-1">Please enter your username to continue.</p>
          </div>
          <button (click)="close.emit()"
            class="text-[#64748B] hover:text-[#1E293B] text-xl leading-none">&times;</button>
        </div>

        <!-- Loading state while members are fetched -->
        <div *ngIf="loading" class="flex flex-col items-center py-6 text-[#64748B] text-sm">
          <svg class="animate-spin h-6 w-6 mb-2 text-[#003bc4]" viewBox="0 0 24 24" fill="none">
            <circle class="opacity-25" cx="12" cy="12" r="10"
                    stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
          Loading member list…
        </div>

        <ng-container *ngIf="!loading">
          <div class="mb-4">
            <label class="block text-sm font-medium text-[#1E293B] mb-2">Username</label>
            <input
              [(ngModel)]="username"
              type="text"
              placeholder="Enter username"
              class="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#003bc4] focus:border-transparent"
              (keydown.enter)="onLogin()"
              autofocus
            />
            <p *ngIf="error" class="text-red-500 text-xs mt-2">{{ error }}</p>
          </div>

          <div class="flex gap-3 mt-6">
            <button (click)="close.emit()"
              class="flex-1 border border-gray-200 text-[#1E293B] rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50">
              Cancel
            </button>
            <button (click)="onLogin()"
              class="flex-1 bg-[#003bc4] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#002da3]">
              Login
            </button>
          </div>
        </ng-container>
      </div>
    </div>
  `,
})
export class LoginDialogComponent implements OnInit {
  @Output() close = new EventEmitter<void>();
  @Output() loggedIn = new EventEmitter<void>();

  username = '';
  error = '';
  loading = true;

  constructor(private dataService: DataService) {}

  ngOnInit(): void {
    this.dataService.loading$.subscribe(l => this.loading = l);
  }

  onLogin(): void {
    const u = this.username.trim();
    if (!u) { this.error = 'Please enter a username.'; return; }

    const ok = this.dataService.login(u);
    if (ok) {
      this.error = '';
      this.loggedIn.emit();
      this.close.emit();
    } else {
      this.error = `Username "${u}" was not found. Please check your username and try again.`;
    }
  }

  onBackdropClick(_event: MouseEvent): void { this.close.emit(); }
}

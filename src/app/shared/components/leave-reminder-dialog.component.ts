import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-leave-reminder-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
         (click)="onBackdropClick($event)">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center"
           (click)="$event.stopPropagation()">
        <img src="images/warning.png" class="w-14 h-14 object-contain mx-auto mb-4" alt="Warning">
        <h2 class="text-xl font-bold text-[#1E293B] mb-2">Don't forget!</h2>
        <p class="text-[#64748B] text-sm mb-6">
          This only plans your time off with the team. You must still submit your official leave
          request on the intranet by the <strong>21st</strong> of the month.
        </p>
        <div class="flex gap-3">
          <button (click)="close.emit()"
                  class="flex-1 border border-gray-200 text-[#1E293B] rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50">
            OK
          </button>
          <button (click)="goToLeave()"
                  class="flex-1 bg-[#003bc4] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#002da3]">
            Go to Leave
          </button>
        </div>
      </div>
    </div>
  `,
})
export class LeaveReminderDialogComponent {
  @Output() close = new EventEmitter<void>();

  private readonly leaveUrl = 'https://leave.tma.com.vn/#/newLeave';

  goToLeave(): void {
    window.open(this.leaveUrl, '_blank');
    this.close.emit();
  }

  onBackdropClick(_event: MouseEvent): void {
    this.close.emit();
  }
}

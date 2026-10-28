import { Component, Input } from '@angular/core';
import { PRIORITY_LABELS, Priority, STATUS_LABELS, Status } from '../core/models/models';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  template: `<span class="badge" [class]="'badge status-' + status">{{ label }}</span>`,
})
export class StatusBadgeComponent {
  @Input({ required: true }) status!: Status;
  get label(): string {
    return STATUS_LABELS[this.status];
  }
}

@Component({
  selector: 'app-priority-badge',
  standalone: true,
  template: `<span class="badge" [class]="'badge priority-' + priority">{{ label }}</span>`,
})
export class PriorityBadgeComponent {
  @Input({ required: true }) priority!: Priority;
  get label(): string {
    return PRIORITY_LABELS[this.priority];
  }
}

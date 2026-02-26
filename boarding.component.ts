import { Component, signal, computed, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BookingService } from '../../services/booking.service';
import { Booking, BoardingSequence } from '../../models/booking.model';

@Component({
  selector: 'app-boarding',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './boarding.component.html',
  styleUrls: ['./boarding.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BoardingComponent implements OnInit {
  // Signals for reactive state
  selectedDate = signal<string>('');
  bookings = signal<Booking[]>([]);
  boardingSequence = signal<BoardingSequence[]>([]);
  
  // Computed values
  totalBoardingTime = computed(() => {
    const bookingsValue = this.bookings();
    return bookingsValue.length > 0 
      ? this.bookingService.calculateTotalBoardingTime(bookingsValue)
      : 0;
  });

  sequentialBoardingTime = computed(() => {
    const bookingsValue = this.bookings();
    return bookingsValue.length > 0
      ? this.bookingService.calculateSequentialBoardingTime(bookingsValue)
      : 0;
  });

  timeSaved = computed(() => this.sequentialBoardingTime() - this.totalBoardingTime());

  totalPassengers = computed(() => this.bookings().length);
  boardedPassengers = computed(() => this.bookings().filter(b => b.isBoarded).length);
  boardingProgress = computed(() => {
    const total = this.totalPassengers();
    return total > 0 ? (this.boardedPassengers() / total) * 100 : 0;
  });

  readonly TODAY = new Date().toISOString().split('T')[0];

  constructor(private bookingService: BookingService) {}

  ngOnInit(): void {
    this.selectedDate.set(this.TODAY);
    this.loadBookings();
  }

  /**
   * Load bookings for selected date and calculate optimal sequence
   */
  loadBookings(): void {
    const date = this.selectedDate();
    if (!date) return;

    const bookings = this.bookingService.getBookingsByDate(date);
    this.bookings.set(bookings);

    if (bookings.length > 0) {
      const sequence = this.bookingService.calculateOptimalBoardingSequence(bookings);
      this.boardingSequence.set(sequence);
    } else {
      this.boardingSequence.set([]);
    }
  }

  /**
   * Handle date change
   */
  onDateChange(): void {
    this.loadBookings();
  }

  /**
   * Initiate phone call to mobile number
   */
  callMobile(mobileNumber: string): void {
    window.location.href = `tel:${mobileNumber}`;
  }

  /**
   * Toggle boarding status
   */
  toggleBoarding(bookingId: string, currentStatus: boolean): void {
    this.bookingService.markAsBoarded(bookingId, !currentStatus);
    this.loadBookings(); // Reload to update UI
  }

  /**
   * Get status badge class
   */
  getStatusBadgeClass(isBoarded: boolean): string {
    return isBoarded ? 'status-boarded' : 'status-pending';
  }

  /**
   * Get status text
   */
  getStatusText(isBoarded: boolean): string {
    return isBoarded ? 'Boarded' : 'Pending';
  }

  /**
   * Format time in seconds to readable format
   */
  formatTime(seconds: number): string {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 
      ? `${minutes}m ${remainingSeconds}s` 
      : `${minutes}m`;
  }

  /**
   * Get efficiency percentage
   */
  getEfficiency(): number {
    const sequential = this.sequentialBoardingTime();
    const optimal = this.totalBoardingTime();
    if (sequential === 0) return 0;
    return Math.round(((sequential - optimal) / sequential) * 100);
  }
}

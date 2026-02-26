import { Component, signal, computed, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BookingService } from '../../services/booking.service';
import { Booking, BookingConfirmation, TOTAL_ROWS, SEATS_PER_ROW, MAX_SEATS_PER_BOOKING, TOTAL_SEATS } from '../../models/booking.model';

@Component({
  selector: 'app-booking',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './booking.component.html',
  styleUrls: ['./booking.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BookingComponent implements OnInit {
  bookingForm!: FormGroup;

  // Signals for reactive state management
  selectedSeats = signal<Set<string>>(new Set());
  showConfirmation = signal(false);
  confirmation = signal<BookingConfirmation | null>(null);
  errorMessage = signal<string>('');
  editMode = signal(false);
  editBookingId = signal<string>('');
  myBookings = signal<Booking[]>([]);

  // Computed values
  selectedSeatsList = computed(() => Array.from(this.selectedSeats()).sort());
  selectedCount = computed(() => this.selectedSeats().size);
  canSelectMore = computed(() => this.selectedCount() < MAX_SEATS_PER_BOOKING);
  availableSeatsCount = computed(() => TOTAL_SEATS - this.occupiedSeats().size);
  occupiedSeatsCount = computed(() => this.occupiedSeats().size);

  // Constants
  readonly MAX_SEATS = MAX_SEATS_PER_BOOKING;
  readonly rows = Array.from({ length: TOTAL_ROWS }, (_, i) => String.fromCharCode(65 + i)); // A-O
  readonly columns = Array.from({ length: SEATS_PER_ROW }, (_, i) => i + 1); // 1-4
  readonly TODAY = new Date().toISOString().split('T')[0];

  // Occupied seats for selected date (excluding current user's bookings in edit mode)
  occupiedSeats = signal<Set<string>>(new Set());

  // Map to track which booking owns each seat
  seatOwnership = signal<Map<string, string>>(new Map());

  constructor(
    private fb: FormBuilder,
    private bookingService: BookingService
  ) { }

  ngOnInit(): void {
    this.initializeForm();
    this.updateOccupiedSeats();
    this.loadMyBookings();
  }

  /**
   * Initialize reactive form with validators
   */
  private initializeForm(): void {
    this.bookingForm = this.fb.group({
      travelDate: [this.TODAY, [Validators.required]],
      mobileNumber: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]]
    });

    // Update occupied seats when date changes
    this.bookingForm.get('travelDate')?.valueChanges.subscribe(() => {
      this.updateOccupiedSeats();
      this.selectedSeats.set(new Set()); // Clear selection on date change
    });

    // Update my bookings when mobile changes
    this.bookingForm.get('mobileNumber')?.valueChanges.subscribe(() => {
      this.loadMyBookings();
      this.updateOccupiedSeats(); // Also update occupied seats to exclude user's own bookings
    });
  }

  /**
   * Update occupied seats based on selected date
   * CRITICAL: Exclude current user's bookings from "occupied" seats
   */
  private updateOccupiedSeats(): void {
    const date = this.bookingForm.get('travelDate')?.value;
    const currentMobile = this.bookingForm.get('mobileNumber')?.value;

    if (date) {
      const occupied = new Set<string>();
      const ownership = new Map<string, string>();
      const allBookings = this.bookingService.getBookingsByDate(date);

      allBookings.forEach(booking => {
        // IMPORTANT: Only mark seats as occupied if they belong to OTHER users
        // If editing, exclude current booking
        // If booking new, exclude all bookings by current mobile number
        const isOtherUser = booking.mobileNumber !== currentMobile;
        const isCurrentBooking = this.editMode() && booking.bookingId === this.editBookingId();
        if (!isCurrentBooking) {
          booking.seats.forEach(seat => {
            occupied.add(seat);
            ownership.set(seat, booking.bookingId);
          });
        }


      });

      this.occupiedSeats.set(occupied);
      this.seatOwnership.set(ownership);
    }
  }

  /**
   * Load bookings for current mobile number
   */
  private loadMyBookings(): void {
    const mobile = this.bookingForm.get('mobileNumber')?.value;
    if (mobile && /^\d{10}$/.test(mobile)) {
      const allBookings = this.bookingService.getBookingsSignal()();
      const filtered = allBookings.filter(b => b.mobileNumber === mobile);
      this.myBookings.set(filtered);
    } else {
      this.myBookings.set([]);
    }
  }

  /**
   * Refresh bookings list
   */
  refreshBookings(): void {
    this.loadMyBookings();
    this.updateOccupiedSeats();
  }

  /**
   * Get seat ID from row and column
   */
  getSeatId(row: string, col: number): string {
    return `${row}${col}`;
  }

  /**
   * Check if a seat is selected
   */
  isSeatSelected(seatId: string): boolean {
    return this.selectedSeats().has(seatId);
  }

  /**
   * Check if a seat is occupied (by OTHER users only)
   */
  isSeatOccupied(seatId: string): boolean {
    return this.occupiedSeats().has(seatId);
  }

  /**
   * Get seat title for tooltip
   * Shows booking reference if occupied
   */
  getSeatTitle(seatId: string): string {
    if (this.isSeatOccupied(seatId)) {
      const bookingId = this.seatOwnership().get(seatId);
      return `Seat ${seatId} - Already Booked (Ref: ${bookingId})`;
    } else if (this.isSeatSelected(seatId)) {
      return `Seat ${seatId} - Selected (click to deselect)`;
    } else {
      return `Seat ${seatId} - Available (click to select)`;
    }
  }

  /**
   * Toggle seat selection
   */
  toggleSeat(seatId: string): void {
    if (this.isSeatOccupied(seatId)) {
      // Show reference number in error message
      const bookingId = this.seatOwnership().get(seatId);
      this.errorMessage.set(`Seat ${seatId} is already booked (Ref: ${bookingId})`);
      setTimeout(() => this.errorMessage.set(''), 3000);
      return;
    }

    const seats = this.selectedSeats();
    const newSeats = new Set(seats);

    if (seats.has(seatId)) {
      newSeats.delete(seatId);
    } else {
      if (this.canSelectMore()) {
        newSeats.add(seatId);
      } else {
        this.errorMessage.set(`Maximum ${MAX_SEATS_PER_BOOKING} seats can be selected`);
        setTimeout(() => this.errorMessage.set(''), 3000);
        return;
      }
    }

    this.selectedSeats.set(newSeats);
    this.errorMessage.set(''); // Clear any previous errors
  }

  /**
   * Get seat CSS classes
   */
  getSeatClasses(seatId: string): string[] {
    const classes = ['seat'];

    if (this.isSeatOccupied(seatId)) {
      classes.push('occupied');
    } else if (this.isSeatSelected(seatId)) {
      classes.push('selected');
    } else {
      classes.push('available');
    }

    return classes;
  }

  /**
   * Submit booking
   */
  onSubmit(): void {
    if (this.bookingForm.invalid) {
      this.errorMessage.set('Please fill all required fields correctly');
      return;
    }

    if (this.selectedCount() === 0) {
      this.errorMessage.set('Please select at least one seat');
      return;
    }

    const { travelDate, mobileNumber } = this.bookingForm.value;
    const seats = Array.from(this.selectedSeats());

    try {
      let result: BookingConfirmation | null;

      if (this.editMode()) {
        result = this.bookingService.updateBooking(this.editBookingId(), seats);
      } else {
        result = this.bookingService.createBooking(mobileNumber, travelDate, seats);
      }

      if (result) {
        this.confirmation.set(result);
        this.showConfirmation.set(true);
        this.errorMessage.set('');
        this.loadMyBookings(); // Refresh bookings list
      }
    } catch (error: any) {
      this.errorMessage.set(error.message || 'Booking failed');
      setTimeout(() => this.errorMessage.set(''), 5000);
    }
  }

  /**
   * Close confirmation popup and reset form
   */
  closeConfirmation(): void {
    this.showConfirmation.set(false);
    this.confirmation.set(null);
    this.resetForm();
  }

  /**
   * Print ticket (placeholder)
   */
  printTicket(): void {
    window.print();
  }

  /**
   * Reset form and selections
   */
  resetForm(): void {
    this.selectedSeats.set(new Set());
    this.bookingForm.patchValue({
      travelDate: this.TODAY,
      mobileNumber: ''
    });
    this.errorMessage.set('');
    this.editMode.set(false);
    this.editBookingId.set('');
    this.updateOccupiedSeats();
    this.loadMyBookings();
  }

  /**
   * Load booking for editing
   */
  loadBookingForEdit(bookingId: string): void {
    const booking = this.bookingService.getBookingById(bookingId);
    if (booking) {
      this.editMode.set(true);
      this.editBookingId.set(bookingId);
      this.bookingForm.patchValue({
        travelDate: booking.travelDate,
        mobileNumber: booking.mobileNumber
      });
      this.selectedSeats.set(new Set(booking.seats));
      this.updateOccupiedSeats(); // This will now exclude current booking's seats

      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }



}
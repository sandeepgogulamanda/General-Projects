import { Injectable, signal } from '@angular/core';
import {
  Booking,
  BookingConfirmation,
  BoardingSequence,
  TOTAL_ROWS,
  SEATS_PER_ROW,
  MAX_SEATS_PER_BOOKING,
  BOARDING_TIME_PER_PASSENGER
} from '../models/booking.model';

@Injectable({
  providedIn: 'root'
})
export class BookingService {
  private readonly STORAGE_KEY = 'bus_bookings';
  private bookings = signal<Booking[]>([]);

  constructor() {
    this.loadBookings();
  }

  /* ================================
   * Storage Handling
   * ================================ */

  private loadBookings(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.bookings.set(
          parsed.map((b: any) => ({
            ...b,
            createdAt: new Date(b.createdAt),
            updatedAt: new Date(b.updatedAt)
          }))
        );
      }
    } catch (error) {
      console.error('Error loading bookings:', error);
      this.bookings.set([]);
    }
  }

  private saveBookings(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.bookings()));
    } catch (error) {
      console.error('Error saving bookings:', error);
    }
  }

  /* ================================
   * Helpers
   * ================================ */

  private generateBookingId(): string {
    return `BK${Date.now()}${Math.floor(Math.random() * 10000)}`;
  }

  getAllSeats(): string[] {
    const seats: string[] = [];
    const rows = 'ABCDEFGHIJKLMNO'.split('');

    for (let r = 0; r < TOTAL_ROWS; r++) {
      for (let c = 1; c <= SEATS_PER_ROW; c++) {
        seats.push(`${rows[r]}${c}`);
      }
    }
    return seats;
  }

  /**
   * Seat ownership map for a date
   * seatId -> bookingId
   */
  getSeatOwnershipByDate(date: string): Map<string, string> {
    const ownership = new Map<string, string>();

    this.bookings()
      .filter(b => b.travelDate === date)
      .forEach(b => {
        b.seats.forEach(seat => ownership.set(seat, b.bookingId));
      });

    return ownership;
  }

  getSeatsCountByMobile(
    mobile: string,
    date: string,
    excludeBookingId?: string
  ): number {
    return this.bookings()
      .filter(
        b =>
          b.mobileNumber === mobile &&
          b.travelDate === date &&
          b.bookingId !== excludeBookingId
      )
      .reduce((sum, b) => sum + b.seats.length, 0);
  }

  /* ================================
   * Validation (Ownership Aware)
   * ================================ */

  validateBooking(
    mobile: string,
    date: string,
    seats: string[],
    existingBookingId?: string
  ): string | null {
    if (!seats.length) {
      return 'Please select at least one seat';
    }

    if (seats.length > MAX_SEATS_PER_BOOKING) {
      return `Maximum ${MAX_SEATS_PER_BOOKING} seats allowed`;
    }

    const selectedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDate < today) {
      return 'Please select a future date';
    }

    if (!/^\d{10}$/.test(mobile)) {
      return 'Invalid mobile number';
    }

    const alreadyBookedCount = this.getSeatsCountByMobile(
      mobile,
      date,
      existingBookingId
    );

    if (alreadyBookedCount + seats.length > MAX_SEATS_PER_BOOKING) {
      return `You can book only ${MAX_SEATS_PER_BOOKING} seats per day`;
    }

    // 🔐 Ownership check
    const ownership = this.getSeatOwnershipByDate(date);
    const conflicts = seats.filter(seat => {
      const owner = ownership.get(seat);
      if (!owner) return false;
      if (owner === existingBookingId) return false;
      return true;
    });

    if (conflicts.length) {
      return `Seat(s) ${conflicts.join(', ')} already booked`;
    }

    return null;
  }

  /* ================================
   * CRUD Operations
   * ================================ */

  createBooking(
    mobile: string,
    date: string,
    seats: string[]
  ): BookingConfirmation {
    const error = this.validateBooking(mobile, date, seats);
    if (error) throw new Error(error);

    const booking: Booking = {
      bookingId: this.generateBookingId(),
      travelDate: date,
      mobileNumber: mobile,
      seats: [...seats].sort(),
      isBoarded: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.bookings.update(list => [...list, booking]);
    this.saveBookings();

    return {
      bookingId: booking.bookingId,
      travelDate: booking.travelDate,
      mobileNumber: booking.mobileNumber,
      seats: booking.seats
    };
  }

  updateBooking(
    bookingId: string,
    seats: string[]
  ): BookingConfirmation {
    const booking = this.getBookingById(bookingId);
    if (!booking) throw new Error('Booking not found');

    const error = this.validateBooking(
      booking.mobileNumber,
      booking.travelDate,
      seats,
      bookingId
    );
    if (error) throw new Error(error);

    this.bookings.update(list =>
      list.map(b =>
        b.bookingId === bookingId
          ? { ...b, seats: [...seats].sort(), updatedAt: new Date() }
          : b
      )
    );

    this.saveBookings();

    return {
      bookingId,
      travelDate: booking.travelDate,
      mobileNumber: booking.mobileNumber,
      seats: [...seats].sort()
    };
  }

  deleteBooking(bookingId: string): void {
    this.bookings.update(list => list.filter(b => b.bookingId !== bookingId));
    this.saveBookings();
  }

  getBookingsByDate(date: string): Booking[] {
    return this.bookings().filter(b => b.travelDate === date);
  }

  getBookingById(id: string): Booking | undefined {
    return this.bookings().find(b => b.bookingId === id);
  }

  /* ================================
   * Boarding Algorithm (Unchanged)
   * ================================ */

  private getSeatPosition(seatId: string): number {
    const row = seatId.charCodeAt(0) - 65;
    const col = Number(seatId.slice(1)) - 1;
    return row * SEATS_PER_ROW + col;
  }

  private getFarthestSeatPosition(booking: Booking): number {
    return Math.max(...booking.seats.map(s => this.getSeatPosition(s)));
  }

  calculateOptimalBoardingSequence(
    bookings: Booking[]
  ): BoardingSequence[] {
    return [...bookings]
      .sort(
        (a, b) =>
          this.getFarthestSeatPosition(b) -
          this.getFarthestSeatPosition(a)
      )
      .map((b, i) => ({
        sequence: i + 1,
        booking: b,
        estimatedBoardingTime: BOARDING_TIME_PER_PASSENGER
      }));
  }

  calculateTotalBoardingTime(bookings: Booking[]): number {
    return bookings.length ? BOARDING_TIME_PER_PASSENGER : 0;
  }

  calculateSequentialBoardingTime(bookings: Booking[]): number {
    return bookings.length * BOARDING_TIME_PER_PASSENGER;
  }

  markAsBoarded(bookingId: string, boarded: boolean): void {
    this.bookings.update(list =>
      list.map(b =>
        b.bookingId === bookingId
          ? { ...b, isBoarded: boarded, updatedAt: new Date() }
          : b
      )
    );
    this.saveBookings();
  }

  getBookingsSignal() {
    return this.bookings.asReadonly();
  }

  clearAllBookings(): void {
    this.bookings.set([]);
    this.saveBookings();
  }
}

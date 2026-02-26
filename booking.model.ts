/**
 * Core data models for the Bus Booking System
 */

export interface Booking {
  bookingId: string;
  travelDate: string;
  mobileNumber: string;
  seats: string[];
  isBoarded: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Seat {
  id: string;
  position: number; // For sorting in boarding algorithm
  isAvailable: boolean;
  bookingId?: string;
}

export interface BookingConfirmation {
  bookingId: string;
  travelDate: string;
  mobileNumber: string;
  seats: string[];
}

export interface BoardingSequence {
  sequence: number;
  booking: Booking;
  estimatedBoardingTime: number;
}

export const TOTAL_ROWS = 15;
export const SEATS_PER_ROW = 4;
export const TOTAL_SEATS = TOTAL_ROWS * SEATS_PER_ROW;
export const MAX_SEATS_PER_BOOKING = 6;
export const BOARDING_TIME_PER_PASSENGER = 60; // seconds

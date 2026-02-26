import { Routes } from '@angular/router';
import { BookingComponent } from './components/booking/booking.component';
import { BoardingComponent } from './components/boarding/boarding.component';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/booking',
    pathMatch: 'full'
  },
  {
    path: 'booking',
    component: BookingComponent,
    title: 'Book Tickets'
  },
  {
    path: 'boarding',
    component: BoardingComponent,
    title: 'Boarding Management'
  },
  {
    path: '**',
    redirectTo: '/booking'
  }
];

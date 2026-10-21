/**
 * The one short reference a person may read out to support or use as an M-Pesa account number. It is the only place the
 * start of an id is shown; everywhere else a booking is named by its service, person and date.
 */
export const bookingReference = (id: string): string => id.slice(0, 8).toUpperCase();

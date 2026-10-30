/**
 * Sample Procurement Centres and Slots for Nashik District (Demo Data)
 * 
 * Note: These are simulated demonstration centres and four-hour procurement slots.
 */

const DEFAULT_SLOT_CAPACITY = 2; // Maximum concurrent demo bookings per 4-hour slot

const CENTRES = [
  {
    id: 1,
    name: 'Lasalgaon APMC Onion Yard',
    location: 'Niphad Taluka, Nashik',
    slots: [
      { id: 1, date: '28 Oct 2026', time: '08:00 AM - 12:00 PM', label: 'Morning Slot', capacity: 2 },
      { id: 2, date: '28 Oct 2026', time: '01:00 PM - 05:00 PM', label: 'Afternoon Slot', capacity: 2 },
      { id: 3, date: '29 Oct 2026', time: '08:00 AM - 12:00 PM', label: 'Morning Slot', capacity: 2 },
      { id: 4, date: '29 Oct 2026', time: '01:00 PM - 05:00 PM', label: 'Afternoon Slot', capacity: 2 }
    ]
  },
  {
    id: 2,
    name: 'Pimpalgaon Baswant Market Yard',
    location: 'Niphad Taluka, Nashik',
    slots: [
      { id: 1, date: '28 Oct 2026', time: '08:00 AM - 12:00 PM', label: 'Morning Slot', capacity: 2 },
      { id: 2, date: '28 Oct 2026', time: '01:00 PM - 05:00 PM', label: 'Afternoon Slot', capacity: 2 },
      { id: 3, date: '29 Oct 2026', time: '08:00 AM - 12:00 PM', label: 'Morning Slot', capacity: 2 },
      { id: 4, date: '29 Oct 2026', time: '01:00 PM - 05:00 PM', label: 'Afternoon Slot', capacity: 2 }
    ]
  },
  {
    id: 3,
    name: 'Kalwan Sub-Market Yard',
    location: 'Kalwan Taluka, Nashik',
    slots: [
      { id: 1, date: '28 Oct 2026', time: '08:00 AM - 12:00 PM', label: 'Morning Slot', capacity: 2 },
      { id: 2, date: '28 Oct 2026', time: '01:00 PM - 05:00 PM', label: 'Afternoon Slot', capacity: 2 },
      { id: 3, date: '29 Oct 2026', time: '08:00 AM - 12:00 PM', label: 'Morning Slot', capacity: 2 },
      { id: 4, date: '29 Oct 2026', time: '01:00 PM - 05:00 PM', label: 'Afternoon Slot', capacity: 2 }
    ]
  }
];

module.exports = {
  CENTRES,
  DEFAULT_SLOT_CAPACITY
};

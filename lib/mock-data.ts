export type Urgency = 'high' | 'medium' | 'low';
export type TicketStatus = 'new' | 'in-progress' | 'completed';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'staff' | 'vendor';
  avatar?: string;
}

export interface Building {
  id: string;
  name: string;
  address: string;
  units: number;
  managedBy: string;
}

export interface Message {
  id: string;
  userId: string;
  userName: string;
  userRole: 'admin' | 'staff' | 'vendor';
  timestamp: Date;
  content: string;
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  buildingId: string;
  building: string;
  unitNumber: string;
  urgency: Urgency;
  status: TicketStatus;
  assignedTo?: string;
  createdAt: Date;
  updatedAt: Date;
  messages: Message[];
}

// Mock Users
export const mockUsers: User[] = [
  {
    id: '1',
    name: 'Sarah Johnson',
    email: 'sarah@janus.com',
    role: 'admin',
    avatar: 'SJ',
  },
  {
    id: '2',
    name: 'Mike Chen',
    email: 'mike@janus.com',
    role: 'staff',
    avatar: 'MC',
  },
  {
    id: '3',
    name: 'Elena Rodriguez',
    email: 'elena@janus.com',
    role: 'staff',
    avatar: 'ER',
  },
  {
    id: '4',
    name: 'David Thompson',
    email: 'david@janus.com',
    role: 'vendor',
    avatar: 'DT',
  },
];

// Mock Buildings
export const mockBuildings: Building[] = [
  {
    id: '1',
    name: 'Riverside Tower',
    address: '123 Main Street, Downtown',
    units: 45,
    managedBy: 'Sarah Johnson',
  },
  {
    id: '2',
    name: 'Oak Park Complex',
    address: '456 Oak Avenue, Midtown',
    units: 32,
    managedBy: 'Sarah Johnson',
  },
  {
    id: '3',
    name: 'Harbor View Residences',
    address: '789 Harbor Road, Waterfront',
    units: 28,
    managedBy: 'Elena Rodriguez',
  },
];

// Mock Tickets
export const mockTickets: Ticket[] = [
  {
    id: 'TK001',
    title: 'Leaking faucet in bathroom',
    description: 'The bathroom sink is leaking. Water is pooling under the sink.',
    buildingId: '1',
    building: 'Riverside Tower',
    unitNumber: '4B',
    urgency: 'high',
    status: 'new',
    assignedTo: 'Mike Chen',
    createdAt: new Date('2024-02-20'),
    updatedAt: new Date('2024-02-20'),
    messages: [
      {
        id: 'm1',
        userId: '2',
        userName: 'Mike Chen',
        userRole: 'staff',
        timestamp: new Date('2024-02-20T10:00:00'),
        content: 'I will inspect the unit today and assess the damage.',
      },
      {
        id: 'm2',
        userId: '4',
        userName: 'David Thompson',
        userRole: 'vendor',
        timestamp: new Date('2024-02-20T14:30:00'),
        content: 'I can come by tomorrow morning to fix the issue. Will need to replace the valve.',
      },
    ],
  },
  {
    id: 'TK002',
    title: 'HVAC system not cooling',
    description: 'Unit temperature is not dropping. AC system appears to be malfunctioning.',
    buildingId: '2',
    building: 'Oak Park Complex',
    unitNumber: '7C',
    urgency: 'high',
    status: 'in-progress',
    assignedTo: 'Elena Rodriguez',
    createdAt: new Date('2024-02-18'),
    updatedAt: new Date('2024-02-21'),
    messages: [
      {
        id: 'm3',
        userId: '3',
        userName: 'Elena Rodriguez',
        userRole: 'staff',
        timestamp: new Date('2024-02-18T09:15:00'),
        content: 'Assigned to HVAC specialist for inspection.',
      },
      {
        id: 'm4',
        userId: '4',
        userName: 'David Thompson',
        userRole: 'vendor',
        timestamp: new Date('2024-02-19T11:00:00'),
        content: 'Compressor needs replacement. Ordering parts now.',
      },
      {
        id: 'm5',
        userId: '3',
        userName: 'Elena Rodriguez',
        userRole: 'staff',
        timestamp: new Date('2024-02-21T08:30:00'),
        content: 'Parts arrived. Installation scheduled for tomorrow.',
      },
    ],
  },
  {
    id: 'TK003',
    title: 'Broken window in living room',
    description: 'Large crack in the main window. Safety concern.',
    buildingId: '1',
    building: 'Riverside Tower',
    unitNumber: '12A',
    urgency: 'high',
    status: 'new',
    assignedTo: 'Mike Chen',
    createdAt: new Date('2024-02-21'),
    updatedAt: new Date('2024-02-21'),
    messages: [],
  },
  {
    id: 'TK004',
    title: 'Door lock replacement needed',
    description: 'Front door lock is broken. Need new deadbolt installation.',
    buildingId: '3',
    building: 'Harbor View Residences',
    unitNumber: '2E',
    urgency: 'medium',
    status: 'in-progress',
    assignedTo: 'Elena Rodriguez',
    createdAt: new Date('2024-02-19'),
    updatedAt: new Date('2024-02-20'),
    messages: [
      {
        id: 'm6',
        userId: '3',
        userName: 'Elena Rodriguez',
        userRole: 'staff',
        timestamp: new Date('2024-02-19T14:00:00'),
        content: 'Lock ordered. Will be installed on Friday.',
      },
    ],
  },
  {
    id: 'TK005',
    title: 'Paint touch-up in hallway',
    description: 'Several scuff marks on hallway walls that need repainting.',
    buildingId: '2',
    building: 'Oak Park Complex',
    unitNumber: 'Common Area',
    urgency: 'low',
    status: 'completed',
    assignedTo: 'Mike Chen',
    createdAt: new Date('2024-02-10'),
    updatedAt: new Date('2024-02-15'),
    messages: [
      {
        id: 'm7',
        userId: '2',
        userName: 'Mike Chen',
        userRole: 'staff',
        timestamp: new Date('2024-02-10T16:00:00'),
        content: 'Scheduled painter for next week.',
      },
      {
        id: 'm8',
        userId: '4',
        userName: 'David Thompson',
        userRole: 'vendor',
        timestamp: new Date('2024-02-15T17:00:00'),
        content: 'Painting completed. All walls touched up and sealed.',
      },
    ],
  },
  {
    id: 'TK006',
    title: 'Garbage disposal not working',
    description: 'Kitchen garbage disposal is jammed and not operating.',
    buildingId: '1',
    building: 'Riverside Tower',
    unitNumber: '8D',
    urgency: 'medium',
    status: 'new',
    assignedTo: 'Mike Chen',
    createdAt: new Date('2024-02-21'),
    updatedAt: new Date('2024-02-21'),
    messages: [],
  },
  {
    id: 'TK007',
    title: 'Bathroom tile repair',
    description: 'Loose and cracked tiles in shower area need replacement.',
    buildingId: '3',
    building: 'Harbor View Residences',
    unitNumber: '5F',
    urgency: 'medium',
    status: 'in-progress',
    assignedTo: 'Elena Rodriguez',
    createdAt: new Date('2024-02-17'),
    updatedAt: new Date('2024-02-20'),
    messages: [
      {
        id: 'm9',
        userId: '4',
        userName: 'David Thompson',
        userRole: 'vendor',
        timestamp: new Date('2024-02-17T10:30:00'),
        content: 'Removed old tiles. New tiles being installed tomorrow.',
      },
      {
        id: 'm10',
        userId: '3',
        userName: 'Elena Rodriguez',
        userRole: 'staff',
        timestamp: new Date('2024-02-20T09:00:00'),
        content: 'Tiling work almost complete. Final grouting scheduled.',
      },
    ],
  },
  {
    id: 'TK008',
    title: 'Ceiling water stain investigation',
    description: 'Large water stain on ceiling. Possible roof leak.',
    buildingId: '2',
    building: 'Oak Park Complex',
    unitNumber: '15B',
    urgency: 'high',
    status: 'new',
    createdAt: new Date('2024-02-21'),
    updatedAt: new Date('2024-02-21'),
    messages: [],
  },
];

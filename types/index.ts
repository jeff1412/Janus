export type BuildingType = 'condo' | 'rental' | 'housing-co-op'

export type UserRole = 'Resident' | 'Owner' | 'Agent' | 'PropertyManager'

export type TicketType = 'repair' | 'complaint' | 'Self-Help' | 'general'

export type TicketState =
  | 'new'
  | 'in-progress'
  | 'completed'
  | 'escalated'
  | 'pending-approval'

export type TicketUrgency = 'low' | 'medium' | 'high'

export type VendorType = 'vendor' | 'contractor'

export interface Building {
  id: number
  name: string
  address: string | null
  building_type: BuildingType
  property_manager_email: string | null
  property_manager_name: string | null
  rules_and_regulations: string | null
  created_at: string
}

export interface User {
  id: string
  email: string
  name: string | null
  role: UserRole
  suite_number: string | null
  building_id: number | null
  created_at: string
  building?: Building
}

export interface Vendor {
  id: number
  company_name: string
  email: string | null
  phone: string | null
  category: string | null
  building_ids: string | null
  types: VendorType | null
  created_at: string
}

export interface Ticket {
  id: number
  ticket_id: string
  type: TicketType
  repair_category: string | null
  urgency: TicketUrgency | null
  damage_description: string | null
  state: TicketState
  resident: string | null
  building_id: number | null
  conversation_history: string | null
  attachments: string | null
  created_at: string
  updated_at: string
  building?: Building
}

export interface BuildingRule {
  id: number
  building_id: number | null
  ai_text: string | null
  rule_category: string | null
  effective_date: string | null
  created_at: string
}

// Auth context type
export interface AuthUser {
  id: string
  email: string
  name: string | null
  role: UserRole
  suite_number: string | null
  building_id: number | null
  building?: Building
}

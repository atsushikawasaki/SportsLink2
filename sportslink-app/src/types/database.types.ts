export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type Database = {
    public: {
        Tables: {
            users: {
                Row: {
                    id: string
                    email: string
                    display_name: string | null
                    password_hash: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    email: string
                    display_name?: string | null
                    password_hash?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    email?: string
                    display_name?: string | null
                    password_hash?: string | null
                    created_at?: string
                }
            }
            tournaments: {
                Row: {
                    id: string
                    name: string
                    status: 'draft' | 'published' | 'finished'
                    is_public: boolean
                    description: string | null
                    start_date: string | null
                    end_date: string | null
                    match_format: 'team_doubles_3' | 'team_doubles_4_singles_1' | 'individual_doubles' | 'individual_singles' | null
                    umpire_mode: 'LOSER' | 'ASSIGNED' | 'FREE'
                    created_by_user_id: string
                    created_at: string
                }
                Insert: {
                    id?: string
                    name: string
                    status?: 'draft' | 'published' | 'finished'
                    is_public?: boolean
                    description?: string | null
                    start_date?: string | null
                    end_date?: string | null
                    match_format?: 'team_doubles_3' | 'team_doubles_4_singles_1' | 'individual_doubles' | 'individual_singles' | null
                    umpire_mode?: 'LOSER' | 'ASSIGNED' | 'FREE'
                    created_by_user_id: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    name?: string
                    status?: 'draft' | 'published' | 'finished'
                    is_public?: boolean
                    description?: string | null
                    start_date?: string | null
                    end_date?: string | null
                    match_format?: 'team_doubles_3' | 'team_doubles_4_singles_1' | 'individual_doubles' | 'individual_singles' | null
                    umpire_mode?: 'LOSER' | 'ASSIGNED' | 'FREE'
                    created_by_user_id?: string
                    created_at?: string
                }
            }
            user_permissions: {
                Row: {
                    id: string
                    user_id: string
                    role_type: 'admin' | 'tournament_admin' | 'team_admin' | 'umpire'
                    tournament_id: string | null
                    team_id: string | null
                    match_id: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    role_type: 'admin' | 'tournament_admin' | 'team_admin' | 'umpire'
                    tournament_id?: string | null
                    team_id?: string | null
                    match_id?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    role_type?: 'admin' | 'tournament_admin' | 'team_admin' | 'umpire'
                    tournament_id?: string | null
                    team_id?: string | null
                    match_id?: string | null
                    created_at?: string
                }
            }
            teams: {
                Row: {
                    id: string
                    name: string
                    team_manager_user_id: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    name: string
                    team_manager_user_id?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    name?: string
                    team_manager_user_id?: string | null
                    created_at?: string
                }
            }
            tournament_players: {
                Row: {
                    id: string
                    entry_id: string | null
                    actual_team_id: string
                    player_name: string
                    player_type: '前衛' | '後衛' | '両方'
                    sort_order: number | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    entry_id?: string | null
                    actual_team_id: string
                    player_name: string
                    player_type: '前衛' | '後衛' | '両方'
                    sort_order?: number | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    entry_id?: string | null
                    actual_team_id?: string
                    player_name?: string
                    player_type?: '前衛' | '後衛' | '両方'
                    sort_order?: number | null
                    created_at?: string
                }
            }
            tournament_pairs: {
                Row: {
                    id: string
                    entry_id: string | null
                    pair_number: number
                    player_1_id: string
                    player_2_id: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    entry_id?: string | null
                    pair_number: number
                    player_1_id: string
                    player_2_id?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    entry_id?: string | null
                    pair_number?: number
                    player_1_id?: string
                    player_2_id?: string | null
                    created_at?: string
                }
            }
            tournament_phases: {
                Row: {
                    id: string
                    tournament_id: string
                    phase_type: 'tournament' | 'league'
                    name: string
                    sequence: number
                    config: Json
                    created_at: string
                }
                Insert: {
                    id?: string
                    tournament_id: string
                    phase_type: 'tournament' | 'league'
                    name: string
                    sequence: number
                    config?: Json
                    created_at?: string
                }
                Update: {
                    id?: string
                    tournament_id?: string
                    phase_type?: 'tournament' | 'league'
                    name?: string
                    sequence?: number
                    config?: Json
                    created_at?: string
                }
            }
            tournament_groups: {
                Row: {
                    id: string
                    phase_id: string
                    name: string
                    seed_bucket: string | null
                    config: Json
                    created_at: string
                }
                Insert: {
                    id?: string
                    phase_id: string
                    name: string
                    seed_bucket?: string | null
                    config?: Json
                    created_at?: string
                }
                Update: {
                    id?: string
                    phase_id?: string
                    name?: string
                    seed_bucket?: string | null
                    config?: Json
                    created_at?: string
                }
            }
            tournament_entries: {
                Row: {
                    id: string
                    tournament_id: string
                    entry_type: 'team' | 'doubles' | 'singles'
                    team_id: string | null
                    pair_id: string | null
                    seed_rank: number | null
                    performance_score: number | null
                    team_order: number | null
                    region_name: string | null
                    custom_display_name: string | null
                    is_active: boolean
                    is_checked_in: boolean
                    day_token: string | null
                    last_checked_in_at: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    tournament_id: string
                    entry_type: 'team' | 'doubles' | 'singles'
                    team_id?: string | null
                    pair_id?: string | null
                    seed_rank?: number | null
                    performance_score?: number | null
                    team_order?: number | null
                    region_name?: string | null
                    custom_display_name?: string | null
                    is_active?: boolean
                    is_checked_in?: boolean
                    day_token?: string | null
                    last_checked_in_at?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    tournament_id?: string
                    entry_type?: 'team' | 'doubles' | 'singles'
                    team_id?: string | null
                    pair_id?: string | null
                    seed_rank?: number | null
                    performance_score?: number | null
                    team_order?: number | null
                    region_name?: string | null
                    custom_display_name?: string | null
                    is_active?: boolean
                    is_checked_in?: boolean
                    day_token?: string | null
                    last_checked_in_at?: string | null
                    created_at?: string
                }
            }
            matches: {
                Row: {
                    id: string
                    tournament_id: string
                    phase_id: string | null
                    round_name: string
                    round_index: number | null
                    slot_index: number | null
                    match_number: number | null
                    umpire_id: string | null
                    court_number: number | null
                    status: 'pending' | 'inprogress' | 'paused' | 'finished'
                    version: number
                    is_confirmed: boolean | null
                    started_at: string | null
                    created_at: string
                    parent_match_id: string | null
                    match_type: 'team_match' | 'individual_match' | null
                    next_match_id: string | null
                    winner_source_match_a: string | null
                    winner_source_match_b: string | null
                }
                Insert: {
                    id?: string
                    tournament_id: string
                    phase_id?: string | null
                    round_name: string
                    round_index?: number | null
                    slot_index?: number | null
                    match_number?: number | null
                    umpire_id?: string | null
                    court_number?: number | null
                    status?: 'pending' | 'inprogress' | 'paused' | 'finished'
                    version?: number
                    is_confirmed?: boolean | null
                    started_at?: string | null
                    created_at?: string
                    parent_match_id?: string | null
                    match_type?: 'team_match' | 'individual_match' | null
                    next_match_id?: string | null
                    winner_source_match_a?: string | null
                    winner_source_match_b?: string | null
                }
                Update: {
                    id?: string
                    tournament_id?: string
                    phase_id?: string | null
                    round_name?: string
                    round_index?: number | null
                    slot_index?: number | null
                    match_number?: number | null
                    umpire_id?: string | null
                    court_number?: number | null
                    status?: 'pending' | 'inprogress' | 'paused' | 'finished'
                    version?: number
                    is_confirmed?: boolean | null
                    started_at?: string | null
                    created_at?: string
                    parent_match_id?: string | null
                    match_type?: 'team_match' | 'individual_match' | null
                    next_match_id?: string | null
                    winner_source_match_a?: string | null
                    winner_source_match_b?: string | null
                }
            }
            match_pairs: {
                Row: {
                    id: string
                    match_id: string
                    pair_number: number
                    team_id: string
                    player_1_id: string
                    player_2_id: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    match_id: string
                    pair_number: number
                    team_id: string
                    player_1_id: string
                    player_2_id?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    match_id?: string
                    pair_number?: number
                    team_id?: string
                    player_1_id?: string
                    player_2_id?: string | null
                    created_at?: string
                }
            }
            match_slots: {
                Row: {
                    id: string
                    match_id: string
                    slot_number: number
                    source_type: 'entry' | 'winner' | 'loser' | 'bye'
                    seed_position: number | null
                    entry_id: string | null
                    source_match_id: string | null
                    placeholder_label: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    match_id: string
                    slot_number: number
                    source_type: 'entry' | 'winner' | 'loser' | 'bye'
                    seed_position?: number | null
                    entry_id?: string | null
                    source_match_id?: string | null
                    placeholder_label?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    match_id?: string
                    slot_number?: number
                    source_type?: 'entry' | 'winner' | 'loser' | 'bye'
                    seed_position?: number | null
                    entry_id?: string | null
                    source_match_id?: string | null
                    placeholder_label?: string | null
                    created_at?: string
                }
            }
            points: {
                Row: {
                    id: string
                    match_id: string
                    point_type: 'A_score' | 'B_score'
                    client_uuid: string
                    server_received_at: string
                    is_undone: boolean
                    created_at: string
                }
                Insert: {
                    id?: string
                    match_id: string
                    point_type: 'A_score' | 'B_score'
                    client_uuid: string
                    server_received_at?: string
                    is_undone?: boolean
                    created_at?: string
                }
                Update: {
                    id?: string
                    match_id?: string
                    point_type?: 'A_score' | 'B_score'
                    client_uuid?: string
                    server_received_at?: string
                    is_undone?: boolean
                    created_at?: string
                }
            }
            match_scores: {
                Row: {
                    match_id: string
                    game_count_a: number
                    game_count_b: number
                    final_score: string | null
                    updated_at: string
                    winner_id: string | null
                    ended_at: string | null
                    winning_reason: 'NORMAL' | 'RETIRE' | 'DEFAULT' | null
                }
                Insert: {
                    match_id: string
                    game_count_a?: number
                    game_count_b?: number
                    final_score?: string | null
                    updated_at?: string
                    winner_id?: string | null
                    ended_at?: string | null
                    winning_reason?: 'NORMAL' | 'RETIRE' | 'DEFAULT' | null
                }
                Update: {
                    match_id?: string
                    game_count_a?: number
                    game_count_b?: number
                    final_score?: string | null
                    updated_at?: string
                    winner_id?: string | null
                    ended_at?: string | null
                    winning_reason?: 'NORMAL' | 'RETIRE' | 'DEFAULT' | null
                }
            }
            audit_logs: {
                Row: {
                    id: string
                    table_name: string
                    operation_type: 'INSERT' | 'UPDATE' | 'DELETE'
                    record_id: string
                    old_data: Json | null
                    new_data: Json | null
                    performed_by: string
                    performed_at: string
                }
                Insert: {
                    id?: string
                    table_name: string
                    operation_type: 'INSERT' | 'UPDATE' | 'DELETE'
                    record_id: string
                    old_data?: Json | null
                    new_data?: Json | null
                    performed_by: string
                    performed_at?: string
                }
                Update: {
                    id?: string
                    table_name?: string
                    operation_type?: 'INSERT' | 'UPDATE' | 'DELETE'
                    record_id?: string
                    old_data?: Json | null
                    new_data?: Json | null
                    performed_by?: string
                    performed_at?: string
                }
            }
            notifications: {
                Row: {
                    id: string
                    user_id: string
                    type: 'auth_key' | 'match_start' | 'umpire_assignment' | 'tournament_update'
                    title: string
                    message: string
                    day_token: string | null
                    match_id: string | null
                    tournament_id: string | null
                    is_read: boolean
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    type: 'auth_key' | 'match_start' | 'umpire_assignment' | 'tournament_update'
                    title: string
                    message: string
                    day_token?: string | null
                    match_id?: string | null
                    tournament_id?: string | null
                    is_read?: boolean
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    type?: 'auth_key' | 'match_start' | 'umpire_assignment' | 'tournament_update'
                    title?: string
                    message?: string
                    day_token?: string | null
                    match_id?: string | null
                    tournament_id?: string | null
                    is_read?: boolean
                    created_at?: string
                }
            }
            contact_requests: {
                Row: {
                    id: string
                    user_id: string | null
                    category: 'technical' | 'feature' | 'other'
                    email: string
                    subject: string
                    message: string
                    status: 'pending' | 'in_progress' | 'resolved' | 'closed'
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id?: string | null
                    category: 'technical' | 'feature' | 'other'
                    email: string
                    subject: string
                    message: string
                    status?: 'pending' | 'in_progress' | 'resolved' | 'closed'
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string | null
                    category?: 'technical' | 'feature' | 'other'
                    email?: string
                    subject?: string
                    message?: string
                    status?: 'pending' | 'in_progress' | 'resolved' | 'closed'
                    created_at?: string
                    updated_at?: string
                }
            }
            user_consents: {
                Row: {
                    id: string
                    user_id: string
                    consent_type: 'terms' | 'privacy'
                    version: string
                    agreed_at: string
                    ip_address: string | null
                    user_agent: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    consent_type: 'terms' | 'privacy'
                    version: string
                    agreed_at?: string
                    ip_address?: string | null
                    user_agent?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    consent_type?: 'terms' | 'privacy'
                    version?: string
                    agreed_at?: string
                    ip_address?: string | null
                    user_agent?: string | null
                    created_at?: string
                }
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            [_ in never]: never
        }
        Enums: {
            [_ in never]: never
        }
    }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']

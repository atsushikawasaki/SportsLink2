-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  operation_type text NOT NULL CHECK (operation_type = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])),
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  performed_by uuid NOT NULL,
  performed_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT audit_logs_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id)
);
CREATE TABLE public.contact_requests (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  category text NOT NULL CHECK (category = ANY (ARRAY['technical'::text, 'feature'::text, 'other'::text])),
  email text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'resolved'::text, 'closed'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT contact_requests_pkey PRIMARY KEY (id),
  CONSTRAINT contact_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.match_pairs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL,
  pair_number integer NOT NULL,
  team_id uuid NOT NULL,
  player_1_id uuid NOT NULL,
  player_2_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT match_pairs_pkey PRIMARY KEY (id),
  CONSTRAINT match_pairs_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id),
  CONSTRAINT match_pairs_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id),
  CONSTRAINT match_pairs_player_1_id_fkey FOREIGN KEY (player_1_id) REFERENCES public.tournament_players(id),
  CONSTRAINT match_pairs_player_2_id_fkey FOREIGN KEY (player_2_id) REFERENCES public.tournament_players(id)
);
CREATE TABLE public.match_scores (
  match_id uuid NOT NULL,
  game_count_a integer NOT NULL DEFAULT 0,
  game_count_b integer NOT NULL DEFAULT 0,
  final_score text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  winner_id uuid,
  ended_at timestamp with time zone,
  winning_reason text CHECK (winning_reason = ANY (ARRAY['NORMAL'::text, 'RETIRE'::text, 'DEFAULT'::text])),
  CONSTRAINT match_scores_pkey PRIMARY KEY (match_id),
  CONSTRAINT match_scores_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id)
);
CREATE TABLE public.match_slots (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  match_id uuid NOT NULL,
  slot_number smallint NOT NULL CHECK (slot_number = ANY (ARRAY[1, 2])),
  source_type text NOT NULL CHECK (source_type = ANY (ARRAY['entry'::text, 'winner'::text, 'loser'::text, 'bye'::text])),
  seed_position smallint,
  entry_id uuid,
  source_match_id uuid,
  placeholder_label text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT match_slots_pkey PRIMARY KEY (id),
  CONSTRAINT match_slots_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id),
  CONSTRAINT match_slots_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES public.tournament_entries(id),
  CONSTRAINT match_slots_source_match_id_fkey FOREIGN KEY (source_match_id) REFERENCES public.matches(id)
);
CREATE TABLE public.matches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL,
  round_name text NOT NULL,
  umpire_id uuid,
  court_number integer,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'inprogress'::text, 'paused'::text, 'finished'::text])),
  version integer NOT NULL DEFAULT 1,
  started_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  phase_id uuid,
  round_index smallint,
  slot_index smallint,
  match_number integer,
  is_confirmed boolean DEFAULT false,
  parent_match_id uuid,
  match_type text CHECK (match_type = ANY (ARRAY['team_match'::text, 'individual_match'::text])),
  next_match_id uuid,
  winner_source_match_a uuid,
  winner_source_match_b uuid,
  CONSTRAINT matches_pkey PRIMARY KEY (id),
  CONSTRAINT matches_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id),
  CONSTRAINT matches_umpire_id_fkey FOREIGN KEY (umpire_id) REFERENCES public.users(id),
  CONSTRAINT matches_phase_id_fkey FOREIGN KEY (phase_id) REFERENCES public.tournament_phases(id),
  CONSTRAINT matches_parent_match_id_fkey FOREIGN KEY (parent_match_id) REFERENCES public.matches(id),
  CONSTRAINT matches_next_match_id_fkey FOREIGN KEY (next_match_id) REFERENCES public.matches(id),
  CONSTRAINT matches_winner_source_match_a_fkey FOREIGN KEY (winner_source_match_a) REFERENCES public.matches(id),
  CONSTRAINT matches_winner_source_match_b_fkey FOREIGN KEY (winner_source_match_b) REFERENCES public.matches(id)
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['auth_key'::text, 'match_start'::text, 'umpire_assignment'::text, 'tournament_update'::text])),
  title text NOT NULL,
  message text NOT NULL,
  day_token character varying,
  match_id uuid,
  tournament_id uuid,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT notifications_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id),
  CONSTRAINT notifications_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id)
);
CREATE TABLE public.points (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL,
  point_type text NOT NULL,
  client_uuid uuid NOT NULL,
  server_received_at timestamp with time zone NOT NULL DEFAULT now(),
  is_undone boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT points_pkey PRIMARY KEY (id),
  CONSTRAINT points_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id)
);
CREATE TABLE public.teams (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  team_manager_user_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT teams_pkey PRIMARY KEY (id),
  CONSTRAINT teams_team_manager_user_id_fkey FOREIGN KEY (team_manager_user_id) REFERENCES public.users(id)
);
CREATE TABLE public.tournament_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL,
  entry_type text NOT NULL CHECK (entry_type = ANY (ARRAY['team'::text, 'doubles'::text, 'singles'::text])),
  team_id uuid,
  pair_id uuid,
  seed_rank smallint,
  performance_score integer,
  team_order smallint,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  is_checked_in boolean DEFAULT false,
  day_token character varying,
  last_checked_in_at timestamp without time zone,
  region_name text,
  custom_display_name text,
  CONSTRAINT tournament_entries_pkey PRIMARY KEY (id),
  CONSTRAINT tournament_entries_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id),
  CONSTRAINT tournament_entries_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id)
);
CREATE TABLE public.tournament_pairs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pair_number integer NOT NULL,
  player_1_id uuid NOT NULL,
  player_2_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  entry_id uuid,
  CONSTRAINT tournament_pairs_pkey PRIMARY KEY (id),
  CONSTRAINT tournament_pairs_player_1_id_fkey FOREIGN KEY (player_1_id) REFERENCES public.tournament_players(id),
  CONSTRAINT tournament_pairs_player_2_id_fkey FOREIGN KEY (player_2_id) REFERENCES public.tournament_players(id),
  CONSTRAINT tournament_pairs_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES public.tournament_entries(id)
);
CREATE TABLE public.tournament_phases (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL,
  phase_type text NOT NULL CHECK (phase_type = ANY (ARRAY['tournament'::text, 'league'::text])),
  name text NOT NULL,
  sequence smallint NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT tournament_phases_pkey PRIMARY KEY (id),
  CONSTRAINT tournament_phases_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id)
);
CREATE TABLE public.tournament_players (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  actual_team_id uuid NOT NULL,
  player_name text NOT NULL,
  player_type text CHECK (player_type = ANY (ARRAY['前衛'::text, '後衛'::text, '両方'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  entry_id uuid,
  sort_order smallint,
  CONSTRAINT tournament_players_pkey PRIMARY KEY (id),
  CONSTRAINT tournament_players_team_id_fkey FOREIGN KEY (actual_team_id) REFERENCES public.teams(id),
  CONSTRAINT tournament_players_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES public.tournament_entries(id)
);
CREATE TABLE public.tournaments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft'::text, 'published'::text, 'finished'::text])),
  created_by_user_id uuid NOT NULL,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  description text,
  start_date date,
  end_date date,
  match_format text CHECK (match_format = ANY (ARRAY['team_doubles_3'::text, 'team_doubles_4_singles_1'::text, 'individual_doubles'::text, 'individual_singles'::text])),
  umpire_mode text NOT NULL DEFAULT 'LOSER'::text CHECK (umpire_mode = ANY (ARRAY['LOSER'::text, 'ASSIGNED'::text, 'FREE'::text])),
  CONSTRAINT tournaments_pkey PRIMARY KEY (id),
  CONSTRAINT tournaments_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id)
);
CREATE TABLE public.user_consents (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  consent_type text NOT NULL CHECK (consent_type = ANY (ARRAY['terms'::text, 'privacy'::text])),
  version text NOT NULL,
  agreed_at timestamp with time zone DEFAULT now(),
  ip_address text,
  user_agent text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_consents_pkey PRIMARY KEY (id),
  CONSTRAINT user_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.user_permissions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  role_type text NOT NULL CHECK (role_type = ANY (ARRAY['admin'::text, 'tournament_admin'::text, 'team_admin'::text, 'umpire'::text])),
  tournament_id uuid,
  team_id uuid,
  match_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_permissions_pkey PRIMARY KEY (id),
  CONSTRAINT user_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT user_permissions_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id),
  CONSTRAINT user_permissions_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id),
  CONSTRAINT user_permissions_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id)
);
CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  password_hash text,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);
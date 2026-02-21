-- 1. matches.umpire_id を NULL 許可にする（未割り当てを許容）
-- 2. 審判用ゲストアカウントを登録（auth.users + public.users + auth.identities）

-- ========== 1. umpire_id NULL 許可 ==========
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'matches' AND column_name = 'umpire_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.matches ALTER COLUMN umpire_id DROP NOT NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.matches.umpire_id IS 'Assigned umpire user id. NULL means unassigned.';

-- ========== 2. 審判用ゲストアカウント ==========
-- 固定UUID: 環境変数 GUEST_UMPIRE_USER_ID にこの値を設定すること
-- 例: GUEST_UMPIRE_USER_ID=11111111-1111-1111-1111-111111111111
-- 初期パスワード: GuestUmpire1! （本番ではダッシュボード等で変更を推奨）
DO $$
DECLARE
  guest_id UUID := '11111111-1111-1111-1111-111111111111';
  guest_email TEXT := 'guest-umpire@sportslink.local';
  guest_display TEXT := 'ゲスト審判';
  pwd_hash TEXT;
BEGIN
  -- pgcrypto で bcrypt ハッシュ生成（拡張が無ければ有効化）
  CREATE EXTENSION IF NOT EXISTS pgcrypto;
  pwd_hash := crypt('GuestUmpire1!', gen_salt('bf'));

  -- auth.users に挿入（存在しなければ）
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = guest_id) THEN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      guest_id,
      'authenticated',
      'authenticated',
      guest_email,
      pwd_hash,
      NOW(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('display_name', guest_display),
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    );
  END IF;

  -- auth.identities に挿入（email プロバイダ、存在しなければ）
  IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = guest_id AND provider = 'email') THEN
    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      guest_id,
      guest_id::text,
      jsonb_build_object('sub', guest_id::text, 'email', guest_email),
      'email',
      NOW(),
      NOW(),
      NOW()
    );
  END IF;

  -- 監査ログ用に performed_by を設定（マイグレーションでは auth.uid() が NULL のため必須）
  PERFORM set_config('app.current_user_id', guest_id::text, false);

  -- public.users に挿入（トリガーで作られない場合に備えて存在しなければ）
  -- 注: users のフラグ列は 011 で削除済みのため id, email, display_name, created_at のみ
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = guest_id) THEN
    INSERT INTO public.users (id, email, display_name, created_at)
    VALUES (guest_id, guest_email, guest_display, NOW());
  ELSE
    UPDATE public.users
    SET display_name = guest_display
    WHERE id = guest_id;
  END IF;
END $$;

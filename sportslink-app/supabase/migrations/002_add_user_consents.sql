-- Add User_Consents table for tracking user consent to terms and privacy policy
-- Version: 1.0.1

CREATE TABLE IF NOT EXISTS user_consents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    consent_type TEXT NOT NULL CHECK (consent_type IN ('terms', 'privacy')),
    version TEXT NOT NULL,
    agreed_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_consents_user_id ON user_consents(user_id);
CREATE INDEX IF NOT EXISTS idx_user_consents_consent_type ON user_consents(consent_type);
CREATE INDEX IF NOT EXISTS idx_user_consents_agreed_at ON user_consents(agreed_at);


CREATE TABLE IF NOT EXISTS referrals (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  referral_type TEXT NOT NULL CHECK (referral_type IN ('driver_referral', 'fleet_referral', 'creator_referral')),
  referrer_name TEXT NOT NULL,
  referrer_email TEXT NOT NULL,
  referrer_phone TEXT,
  referral_code TEXT,
  referred_name TEXT,
  referred_email TEXT,
  referred_phone TEXT,
  company_name TEXT,
  company_website TEXT,
  fleet_size TEXT,
  decision_maker_name TEXT,
  decision_maker_contact TEXT,
  creator_social_link TEXT,
  creator_audience_type TEXT,
  creator_audience_size TEXT,
  reason TEXT,
  source_site TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'reviewing', 'approved', 'code_created', 'converted', 'reward_pending', 'paid', 'rejected')),
  reward_amount NUMERIC NOT NULL DEFAULT 0 CHECK (reward_amount >= 0),
  payout_status TEXT NOT NULL DEFAULT 'not_ready',
  admin_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_referrals_type ON referrals(referral_type);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);
CREATE INDEX IF NOT EXISTS idx_referrals_created_at ON referrals(created_at DESC);

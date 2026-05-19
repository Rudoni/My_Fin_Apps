BEGIN;

CREATE TABLE IF NOT EXISTS app_user (
    user_id SERIAL PRIMARY KEY,
    email VARCHAR(190) NOT NULL UNIQUE,
    display_name VARCHAR(120) NOT NULL,
    password_hash TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_session (
    user_session_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS category (
    category_id SERIAL PRIMARY KEY,
    name_cat VARCHAR(120) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS subcategory (
    subcategory_id SERIAL PRIMARY KEY,
    name_subcat VARCHAR(120) NOT NULL,
    category_id INTEGER NOT NULL REFERENCES category(category_id) ON DELETE CASCADE,
    CONSTRAINT uq_subcategory_name_per_category UNIQUE (name_subcat, category_id)
);

CREATE TABLE IF NOT EXISTS payment_method (
    id SERIAL PRIMARY KEY,
    name_payment VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS expenses (
    expense_id SERIAL PRIMARY KEY,
    description_expense TEXT NOT NULL,
    price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    expense_date DATE NOT NULL,
    subcategory_id INTEGER NOT NULL REFERENCES subcategory(subcategory_id),
    payment_method_id INTEGER NOT NULL REFERENCES payment_method(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS incomes (
    income_id SERIAL PRIMARY KEY,
    description_income TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    income_date DATE NOT NULL,
    income_type VARCHAR(80) NOT NULL DEFAULT 'Autre',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS budget_allocation (
    allocation_id SERIAL PRIMARY KEY,
    description_allocation TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    allocation_date DATE NOT NULL,
    allocation_group VARCHAR(80) NOT NULL DEFAULT 'Investissement',
    allocation_target VARCHAR(120) NOT NULL DEFAULT 'Bourse',
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS limits (
    limit_id SERIAL PRIMARY KEY,
    subcategory_id INTEGER NOT NULL REFERENCES subcategory(subcategory_id) ON DELETE CASCADE,
    year INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 2100),
    limit_amount NUMERIC(12, 2) NOT NULL CHECK (limit_amount >= 0),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_limits_subcategory_year UNIQUE (subcategory_id, year)
);

CREATE TABLE IF NOT EXISTS abonnement (
    abonnement_id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    monthly_amount NUMERIC(12, 2) NOT NULL CHECK (monthly_amount >= 0),
    category VARCHAR(120) DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS asset_type (
    asset_type_id SERIAL PRIMARY KEY,
    code VARCHAR(40) NOT NULL UNIQUE,
    label VARCHAR(120) NOT NULL UNIQUE,
    category_group VARCHAR(50) NOT NULL DEFAULT 'other',
    is_market_quoted BOOLEAN NOT NULL DEFAULT FALSE,
    track_latest_price BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS asset_account (
    account_id SERIAL PRIMARY KEY,
    name_account VARCHAR(120) NOT NULL UNIQUE,
    account_type VARCHAR(80) NOT NULL DEFAULT 'Compte-titres',
    provider VARCHAR(120) DEFAULT '',
    currency VARCHAR(10) NOT NULL DEFAULT 'EUR',
    include_in_net_worth BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS asset (
    asset_id SERIAL PRIMARY KEY,
    name_asset VARCHAR(160) NOT NULL UNIQUE,
    ticker VARCHAR(40),
    asset_type_id INTEGER NOT NULL REFERENCES asset_type(asset_type_id),
    currency VARCHAR(10) NOT NULL DEFAULT 'EUR',
    data_source VARCHAR(40) NOT NULL DEFAULT 'manual',
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS asset_transaction (
    transaction_id SERIAL PRIMARY KEY,
    asset_id INTEGER NOT NULL REFERENCES asset(asset_id) ON DELETE CASCADE,
    account_id INTEGER REFERENCES asset_account(account_id) ON DELETE SET NULL,
    transaction_type VARCHAR(20) NOT NULL CHECK (
        transaction_type IN ('BUY', 'SELL', 'DIVIDEND', 'FEE', 'DEPOSIT', 'WITHDRAWAL')
    ),
    quantity NUMERIC(18, 8) NOT NULL DEFAULT 0,
    unit_price NUMERIC(18, 8) NOT NULL DEFAULT 0,
    total_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
    fees NUMERIC(18, 2) NOT NULL DEFAULT 0,
    transaction_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS asset_valuation (
    valuation_id SERIAL PRIMARY KEY,
    asset_id INTEGER NOT NULL REFERENCES asset(asset_id) ON DELETE CASCADE,
    valuation_date DATE NOT NULL,
    unit_price NUMERIC(18, 8) NOT NULL DEFAULT 0,
    total_value NUMERIC(18, 2),
    value_source VARCHAR(40) NOT NULL DEFAULT 'manual',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_asset_valuation UNIQUE (asset_id, valuation_date, value_source)
);

CREATE TABLE IF NOT EXISTS resale_item (
    resale_item_id SERIAL PRIMARY KEY,
    pair_name VARCHAR(200) NOT NULL,
    resale_category VARCHAR(80) NOT NULL DEFAULT 'Autres',
    retail_price NUMERIC(12, 2),
    purchase_price NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (purchase_price >= 0),
    purchase_date DATE,
    purchase_site VARCHAR(160),
    size VARCHAR(40),
    pair_received BOOLEAN NOT NULL DEFAULT FALSE,
    sale_price NUMERIC(12, 2),
    sale_date DATE,
    sale_site VARCHAR(160),
    pair_count INTEGER NOT NULL DEFAULT 1 CHECK (pair_count > 0),
    payment_method VARCHAR(120),
    expected_price NUMERIC(12, 2),
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS brocante_category (
    brocante_category_id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS brocante_item (
    brocante_item_id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    brocante_category_id INTEGER NOT NULL REFERENCES brocante_category(brocante_category_id),
    inventory_group VARCHAR(40) NOT NULL DEFAULT 'bulk',
    ownership_mode VARCHAR(20) NOT NULL DEFAULT 'solo',
    ownership_share NUMERIC(6, 4) NOT NULL DEFAULT 1.0000,
    copy_key VARCHAR(40) NOT NULL DEFAULT '',
    card_type VARCHAR(120) NOT NULL DEFAULT '',
    target_sale_unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (target_sale_unit_price >= 0),
    minimum_sale_unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (minimum_sale_unit_price >= 0),
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_brocante_item UNIQUE (name, brocante_category_id, inventory_group, card_type, copy_key)
);

ALTER TABLE brocante_item
ADD COLUMN IF NOT EXISTS inventory_group VARCHAR(40) NOT NULL DEFAULT 'bulk';

ALTER TABLE brocante_item
ADD COLUMN IF NOT EXISTS copy_key VARCHAR(40) NOT NULL DEFAULT '';

ALTER TABLE brocante_item
ADD COLUMN IF NOT EXISTS ownership_mode VARCHAR(20) NOT NULL DEFAULT 'solo';

ALTER TABLE brocante_item
ADD COLUMN IF NOT EXISTS ownership_share NUMERIC(6, 4) NOT NULL DEFAULT 1.0000;

UPDATE brocante_item
SET ownership_mode = CASE
    WHEN LOWER(ownership_mode) = 'common' THEN 'common'
    ELSE 'solo'
END
WHERE ownership_mode IS NOT NULL;

UPDATE brocante_item
SET ownership_share = CASE
    WHEN LOWER(ownership_mode) = 'common' THEN 0.5000
    ELSE 1.0000
END
WHERE ownership_share IS NULL
   OR ownership_share <= 0
   OR ownership_share > 1.0000
   OR (LOWER(ownership_mode) = 'common' AND ownership_share <> 0.5000)
   OR (LOWER(ownership_mode) <> 'common' AND ownership_share <> 1.0000);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_name = 'brocante_item'
          AND constraint_name = 'uq_brocante_item'
          AND table_schema = 'public'
    ) THEN
        BEGIN
            ALTER TABLE brocante_item DROP CONSTRAINT uq_brocante_item;
        EXCEPTION
            WHEN undefined_object THEN NULL;
        END;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_name = 'brocante_item'
          AND constraint_name = 'uq_brocante_item'
          AND table_schema = 'public'
    ) THEN
        ALTER TABLE brocante_item
        ADD CONSTRAINT uq_brocante_item UNIQUE (name, brocante_category_id, inventory_group, card_type, copy_key);
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS brocante_movement (
    brocante_movement_id SERIAL PRIMARY KEY,
    brocante_item_id INTEGER NOT NULL REFERENCES brocante_item(brocante_item_id) ON DELETE CASCADE,
    movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('PURCHASE', 'SALE')),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
    movement_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE incomes
ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES app_user(user_id) ON DELETE CASCADE;

ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES app_user(user_id) ON DELETE CASCADE;

ALTER TABLE budget_allocation
ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES app_user(user_id) ON DELETE CASCADE;

ALTER TABLE resale_item
ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES app_user(user_id) ON DELETE CASCADE;

ALTER TABLE brocante_category
ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES app_user(user_id) ON DELETE CASCADE;

ALTER TABLE brocante_item
ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES app_user(user_id) ON DELETE CASCADE;

ALTER TABLE asset_account
ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES app_user(user_id) ON DELETE CASCADE;

ALTER TABLE asset
ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES app_user(user_id) ON DELETE CASCADE;

ALTER TABLE resale_item
ADD COLUMN IF NOT EXISTS resale_category VARCHAR(80) NOT NULL DEFAULT 'Autres';

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_name = 'brocante_category'
          AND constraint_name = 'brocante_category_name_key'
          AND table_schema = 'public'
    ) THEN
        ALTER TABLE brocante_category DROP CONSTRAINT brocante_category_name_key;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_name = 'brocante_category'
          AND constraint_name = 'uq_brocante_category_user'
          AND table_schema = 'public'
    ) THEN
        ALTER TABLE brocante_category
        ADD CONSTRAINT uq_brocante_category_user UNIQUE (user_id, name);
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_name = 'asset'
          AND constraint_name = 'asset_name_asset_key'
          AND table_schema = 'public'
    ) THEN
        ALTER TABLE asset DROP CONSTRAINT asset_name_asset_key;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_name = 'asset'
          AND constraint_name = 'uq_asset_user_name'
          AND table_schema = 'public'
    ) THEN
        ALTER TABLE asset
        ADD CONSTRAINT uq_asset_user_name UNIQUE (user_id, name_asset);
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_name = 'asset_account'
          AND constraint_name = 'asset_account_name_account_key'
          AND table_schema = 'public'
    ) THEN
        ALTER TABLE asset_account DROP CONSTRAINT asset_account_name_account_key;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_name = 'asset_account'
          AND constraint_name = 'uq_asset_account_user_name'
          AND table_schema = 'public'
    ) THEN
        ALTER TABLE asset_account
        ADD CONSTRAINT uq_asset_account_user_name UNIQUE (user_id, name_account);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_incomes_date ON incomes(income_date);
CREATE INDEX IF NOT EXISTS idx_budget_allocation_date ON budget_allocation(allocation_date);
CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, expense_date);
CREATE INDEX IF NOT EXISTS idx_incomes_user_date ON incomes(user_id, income_date);
CREATE INDEX IF NOT EXISTS idx_budget_allocation_user_date ON budget_allocation(user_id, allocation_date);
CREATE INDEX IF NOT EXISTS idx_asset_transaction_date ON asset_transaction(transaction_date);
CREATE INDEX IF NOT EXISTS idx_asset_transaction_asset ON asset_transaction(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_valuation_asset_date ON asset_valuation(asset_id, valuation_date DESC);
CREATE INDEX IF NOT EXISTS idx_resale_item_purchase_date ON resale_item(purchase_date);
CREATE INDEX IF NOT EXISTS idx_resale_item_sale_date ON resale_item(sale_date);
CREATE INDEX IF NOT EXISTS idx_resale_item_user_purchase_date ON resale_item(user_id, purchase_date);
CREATE INDEX IF NOT EXISTS idx_asset_user ON asset(user_id);
CREATE INDEX IF NOT EXISTS idx_asset_account_user ON asset_account(user_id);
CREATE INDEX IF NOT EXISTS idx_brocante_category_user_name ON brocante_category(user_id, name);
CREATE INDEX IF NOT EXISTS idx_brocante_item_category ON brocante_item(brocante_category_id);
CREATE INDEX IF NOT EXISTS idx_brocante_item_user ON brocante_item(user_id);
CREATE INDEX IF NOT EXISTS idx_brocante_movement_item_date ON brocante_movement(brocante_item_id, movement_date DESC);
CREATE INDEX IF NOT EXISTS idx_user_session_user ON user_session(user_id, expires_at DESC);

INSERT INTO payment_method (name_payment)
SELECT v.name_payment
FROM (
    VALUES
        ('Carte bancaire'),
        ('Virement'),
        ('Especes'),
        ('Paypal'),
        ('Crypto')
) AS v(name_payment)
WHERE NOT EXISTS (
    SELECT 1
    FROM payment_method pm
    WHERE pm.name_payment = v.name_payment
);

INSERT INTO category (name_cat)
SELECT v.name_cat
FROM (
    VALUES
        ('Logement'),
        ('Vie courante'),
        ('Transport'),
        ('Loisirs'),
        ('Sante'),
        ('Finances'),
        ('Business'),
        ('Investissement')
) AS v(name_cat)
WHERE NOT EXISTS (
    SELECT 1
    FROM category c
    WHERE c.name_cat = v.name_cat
);

INSERT INTO subcategory (name_subcat, category_id)
SELECT v.name_subcat, c.category_id
FROM (
    VALUES
        ('Loyer', 'Logement'),
        ('Electricite', 'Logement'),
        ('Courses', 'Vie courante'),
        ('Restaurants', 'Vie courante'),
        ('Essence', 'Transport'),
        ('Abonnements', 'Loisirs'),
        ('Sante', 'Sante'),
        ('Frais bancaires', 'Finances'),
        ('Achat-revente', 'Business'),
        ('Investissements', 'Investissement')
) AS v(name_subcat, category_name)
JOIN category c ON c.name_cat = v.category_name
WHERE NOT EXISTS (
    SELECT 1
    FROM subcategory s
    WHERE s.name_subcat = v.name_subcat
      AND s.category_id = c.category_id
);

INSERT INTO asset_type (code, label, category_group, is_market_quoted, track_latest_price)
SELECT v.code, v.label, v.category_group, v.is_market_quoted, v.track_latest_price
FROM (
    VALUES
        ('STOCK', 'Action', 'financial', TRUE, TRUE),
        ('ETF', 'ETF', 'financial', TRUE, TRUE),
        ('CRYPTO', 'Crypto', 'crypto', TRUE, TRUE),
        ('RESALE', 'Achat-revente', 'resale', FALSE, FALSE),
        ('PATRIMOINE', 'Patrimoine physique', 'patrimony', FALSE, FALSE),
        ('CASH', 'Cash / Livret', 'cash', FALSE, FALSE)
) AS v(code, label, category_group, is_market_quoted, track_latest_price)
WHERE NOT EXISTS (
    SELECT 1
    FROM asset_type at
    WHERE at.code = v.code
);

INSERT INTO asset_account (name_account, account_type, provider, currency)
SELECT v.name_account, v.account_type, v.provider, v.currency
FROM (
    VALUES
        ('PEA', 'PEA', 'Bourse Direct', 'EUR'),
        ('CTO', 'Compte-titres', 'Interactive Brokers', 'EUR'),
        ('Binance', 'Exchange crypto', 'Binance', 'EUR'),
        ('Patrimoine perso', 'Patrimoine', 'Manuel', 'EUR'),
        ('Stock achat-revente', 'Stock', 'Manuel', 'EUR')
) AS v(name_account, account_type, provider, currency)
WHERE NOT EXISTS (
    SELECT 1
    FROM asset_account aa
    WHERE aa.name_account = v.name_account
);

INSERT INTO brocante_category (name)
SELECT v.name
FROM (
    VALUES
        ('Pokemon'),
        ('Yu-Gi-Oh'),
        ('One Piece'),
        ('Magic'),
        ('DBZ'),
        ('Autres TCG'),
        ('Autres')
) AS v(name)
WHERE NOT EXISTS (
    SELECT 1
    FROM brocante_category bc
    WHERE bc.name = v.name
);

COMMIT;

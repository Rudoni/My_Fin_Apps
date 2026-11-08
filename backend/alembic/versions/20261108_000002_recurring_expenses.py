"""Monthly recurring expenses and idempotent occurrences."""
from alembic import op

revision = "20261108_000002"
down_revision = "20260519_000001"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
CREATE TABLE IF NOT EXISTS recurring_expense (
    recurring_expense_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES app_user(user_id),
    description_expense TEXT NOT NULL,
    price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
    subcategory_id INTEGER NOT NULL REFERENCES subcategory(subcategory_id),
    payment_method_id INTEGER NOT NULL REFERENCES payment_method(id),
    start_month DATE NOT NULL,
    end_month DATE,
    next_month DATE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CHECK (end_month IS NULL OR end_month >= start_month)
);
CREATE INDEX IF NOT EXISTS idx_recurring_expense_user ON recurring_expense(user_id);
CREATE TABLE IF NOT EXISTS recurring_expense_occurrence (
    recurring_expense_id INTEGER NOT NULL REFERENCES recurring_expense(recurring_expense_id),
    month DATE NOT NULL,
    expense_id INTEGER UNIQUE REFERENCES expenses(expense_id) ON DELETE SET NULL,
    PRIMARY KEY (recurring_expense_id, month)
);
    """)


def downgrade():
    op.execute("DROP TABLE recurring_expense_occurrence")
    op.execute("DROP TABLE recurring_expense")

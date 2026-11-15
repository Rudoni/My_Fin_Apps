"""Personal expense categories and per-user hiding of shared categories."""
from alembic import op

revision = "20261115_000003"
down_revision = "20261108_000002"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        ALTER TABLE subcategory ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES app_user(user_id);
        ALTER TABLE subcategory DROP CONSTRAINT IF EXISTS uq_subcategory_name_per_category;
        CREATE UNIQUE INDEX IF NOT EXISTS uq_subcategory_shared
            ON subcategory (name_subcat, category_id) WHERE user_id IS NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS uq_subcategory_personal
            ON subcategory (user_id, LOWER(name_subcat), category_id) WHERE user_id IS NOT NULL;
        CREATE TABLE IF NOT EXISTS hidden_expense_category (
            user_id INTEGER NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
            subcategory_id INTEGER NOT NULL REFERENCES subcategory(subcategory_id) ON DELETE CASCADE,
            PRIMARY KEY (user_id, subcategory_id)
        );
    """)


def downgrade():
    raise RuntimeError("Personal categories cannot be safely merged into a shared catalogue automatically.")

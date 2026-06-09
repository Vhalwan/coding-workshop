"""
PostgreSQL service for budget tracking.
"""
from psycopg import connect

PG_CONN = None

def get_connection(config):
    global PG_CONN
    if PG_CONN is None or PG_CONN.closed:
        PG_CONN = connect(config)
    return PG_CONN

def reset_connection():
    global PG_CONN
    PG_CONN = None

def init_db(config):
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS budget_entries (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                project_id UUID NOT NULL,
                project_name VARCHAR(255),
                category VARCHAR(255) NOT NULL,
                description TEXT,
                amount NUMERIC(15,2) NOT NULL,
                type VARCHAR(10) NOT NULL DEFAULT 'expense',
                date DATE NOT NULL DEFAULT CURRENT_DATE,
                created_by VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        conn.commit()

def create_entry(config, data):
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO budget_entries (project_id, project_name, category, description, amount, type, date, created_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, project_id, project_name, category, description, amount, type, date, created_by, created_at, updated_at;
        """, (data["project_id"], data.get("project_name"), data["category"], data.get("description"), data["amount"], data.get("type", "expense"), data.get("date"), data.get("created_by")))
        conn.commit()
        return row_to_dict(cur.fetchone())

def get_entries(config, project_id=None, category=None):
    conn = get_connection(config)
    with conn.cursor() as cur:
        query = "SELECT id, project_id, project_name, category, description, amount, type, date, created_by, created_at, updated_at FROM budget_entries WHERE 1=1"
        params = []
        if project_id:
            query += " AND project_id = %s"
            params.append(project_id)
        if category:
            query += " AND category = %s"
            params.append(category)
        cur.execute(query + " ORDER BY date DESC, created_at DESC;", params)
        return [row_to_dict(r) for r in cur.fetchall()]

def get_entry_by_id(config, entry_id):
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute("SELECT id, project_id, project_name, category, description, amount, type, date, created_by, created_at, updated_at FROM budget_entries WHERE id = %s;", (entry_id,))
        return row_to_dict(cur.fetchone())

def get_summary(config, project_id=None):
    conn = get_connection(config)
    with conn.cursor() as cur:
        if project_id:
            cur.execute("""
                SELECT project_id, project_name,
                    SUM(CASE WHEN type='budget' THEN amount ELSE 0 END) as total_budget,
                    SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) as total_spent
                FROM budget_entries WHERE project_id = %s GROUP BY project_id, project_name;
            """, (project_id,))
        else:
            cur.execute("""
                SELECT project_id, project_name,
                    SUM(CASE WHEN type='budget' THEN amount ELSE 0 END) as total_budget,
                    SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) as total_spent
                FROM budget_entries GROUP BY project_id, project_name ORDER BY project_name;
            """)
        rows = cur.fetchall()
        return [{"project_id": str(r[0]), "project_name": r[1], "total_budget": float(r[2]), "total_spent": float(r[3]), "remaining": float(r[2]) - float(r[3])} for r in rows]

def update_entry(config, entry_id, data):
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE budget_entries SET
                category = COALESCE(%s, category),
                description = COALESCE(%s, description),
                amount = COALESCE(%s, amount),
                type = COALESCE(%s, type),
                date = COALESCE(%s, date),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            RETURNING id, project_id, project_name, category, description, amount, type, date, created_by, created_at, updated_at;
        """, (data.get("category"), data.get("description"), data.get("amount"), data.get("type"), data.get("date"), entry_id))
        conn.commit()
        return row_to_dict(cur.fetchone())

def delete_entry(config, entry_id):
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute("DELETE FROM budget_entries WHERE id = %s RETURNING id;", (entry_id,))
        conn.commit()
        return cur.fetchone() is not None

def row_to_dict(row):
    if not row:
        return None
    return {"id": str(row[0]), "project_id": str(row[1]), "project_name": row[2], "category": row[3], "description": row[4], "amount": float(row[5]), "type": row[6], "date": row[7].isoformat() if row[7] else None, "created_by": row[8], "created_at": row[9].isoformat(), "updated_at": row[10].isoformat()}

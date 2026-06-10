"""
PostgreSQL service for projects.
"""
from psycopg import connect

PG_CONN = None

def _optional_date(value):
    return value if value else None

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
            CREATE TABLE IF NOT EXISTS projects (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(255) NOT NULL,
                description TEXT,
                status VARCHAR(50) NOT NULL DEFAULT 'active',
                priority VARCHAR(50) NOT NULL DEFAULT 'medium',
                start_date DATE,
                end_date DATE,
                owner_id VARCHAR(255),
                owner_name VARCHAR(255),
                budget_total NUMERIC(15,2) DEFAULT 0,
                budget_spent NUMERIC(15,2) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        conn.commit()

def create_project(config, data):
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO projects (name, description, status, priority, start_date, end_date, owner_id, owner_name, budget_total)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, name, description, status, priority, start_date, end_date,
                      owner_id, owner_name, budget_total, budget_spent, created_at, updated_at;
        """, (
            data["name"], data.get("description"), data.get("status", "active"),
            data.get("priority", "medium"), _optional_date(data.get("start_date")), _optional_date(data.get("end_date")),
            data.get("owner_id"), data.get("owner_name"), data.get("budget_total", 0)
        ))
        conn.commit()
        return row_to_dict(cur.fetchone())

def get_all_projects(config, status=None):
    conn = get_connection(config)
    with conn.cursor() as cur:
        if status:
            cur.execute("""
                SELECT id, name, description, status, priority, start_date, end_date,
                       owner_id, owner_name, budget_total, budget_spent, created_at, updated_at
                FROM projects WHERE status = %s ORDER BY created_at DESC;
            """, (status,))
        else:
            cur.execute("""
                SELECT id, name, description, status, priority, start_date, end_date,
                       owner_id, owner_name, budget_total, budget_spent, created_at, updated_at
                FROM projects ORDER BY created_at DESC;
            """)
        return [row_to_dict(r) for r in cur.fetchall()]

def get_project_by_id(config, project_id):
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute("""
            SELECT id, name, description, status, priority, start_date, end_date,
                   owner_id, owner_name, budget_total, budget_spent, created_at, updated_at
            FROM projects WHERE id = %s;
        """, (project_id,))
        row = cur.fetchone()
        return row_to_dict(row) if row else None

def update_project(config, project_id, data):
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE projects SET
                name = COALESCE(%s, name),
                description = COALESCE(%s, description),
                status = COALESCE(%s, status),
                priority = COALESCE(%s, priority),
                start_date = %s,
                end_date = %s,
                owner_id = COALESCE(%s, owner_id),
                owner_name = COALESCE(%s, owner_name),
                budget_total = COALESCE(%s, budget_total),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            RETURNING id, name, description, status, priority, start_date, end_date,
                      owner_id, owner_name, budget_total, budget_spent, created_at, updated_at;
        """, (
            data.get("name"), data.get("description"), data.get("status"),
            data.get("priority"), _optional_date(data.get("start_date")), _optional_date(data.get("end_date")),
            data.get("owner_id"), data.get("owner_name"), data.get("budget_total"),
            project_id
        ))
        conn.commit()
        row = cur.fetchone()
        return row_to_dict(row) if row else None

def delete_project(config, project_id):
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute("DELETE FROM projects WHERE id = %s RETURNING id;", (project_id,))
        conn.commit()
        return cur.fetchone() is not None

def row_to_dict(row):
    if not row:
        return None
    return {
        "id": str(row[0]),
        "name": row[1],
        "description": row[2],
        "status": row[3],
        "priority": row[4],
        "start_date": row[5].isoformat() if row[5] else None,
        "end_date": row[6].isoformat() if row[6] else None,
        "owner_id": row[7],
        "owner_name": row[8],
        "budget_total": float(row[9]) if row[9] else 0,
        "budget_spent": float(row[10]) if row[10] else 0,
        "created_at": row[11].isoformat() if row[11] else None,
        "updated_at": row[12].isoformat() if row[12] else None,
    }

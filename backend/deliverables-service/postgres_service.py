"""
PostgreSQL service for deliverables.
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
            CREATE TABLE IF NOT EXISTS deliverables (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                project_id UUID NOT NULL,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                status VARCHAR(50) NOT NULL DEFAULT 'pending',
                priority VARCHAR(50) NOT NULL DEFAULT 'medium',
                assignee_id VARCHAR(255),
                assignee_name VARCHAR(255),
                due_date DATE,
                completed_at TIMESTAMP,
                depends_on UUID[],
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        conn.commit()

def create_deliverable(config, data):
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO deliverables (project_id, name, description, status, priority, assignee_id, assignee_name, due_date, depends_on)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, project_id, name, description, status, priority, assignee_id, assignee_name, due_date, completed_at, depends_on, created_at, updated_at;
        """, (
            data["project_id"], data["name"], data.get("description"),
            data.get("status", "pending"), data.get("priority", "medium"),
            data.get("assignee_id"), data.get("assignee_name"),
            data.get("due_date"), data.get("depends_on", [])
        ))
        conn.commit()
        return row_to_dict(cur.fetchone())

def get_deliverables(config, project_id=None, status=None):
    conn = get_connection(config)
    with conn.cursor() as cur:
        query = """
            SELECT id, project_id, name, description, status, priority, assignee_id, assignee_name, due_date, completed_at, depends_on, created_at, updated_at
            FROM deliverables WHERE 1=1
        """
        params = []
        if project_id:
            query += " AND project_id = %s"
            params.append(project_id)
        if status:
            query += " AND status = %s"
            params.append(status)
        query += " ORDER BY created_at DESC;"
        cur.execute(query, params)
        return [row_to_dict(r) for r in cur.fetchall()]

def get_deliverable_by_id(config, deliverable_id):
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute("""
            SELECT id, project_id, name, description, status, priority, assignee_id, assignee_name, due_date, completed_at, depends_on, created_at, updated_at
            FROM deliverables WHERE id = %s;
        """, (deliverable_id,))
        return row_to_dict(cur.fetchone())

def update_deliverable(config, deliverable_id, data):
    conn = get_connection(config)
    completed_at = "CURRENT_TIMESTAMP" if data.get("status") == "completed" else None
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE deliverables SET
                name = COALESCE(%s, name),
                description = COALESCE(%s, description),
                status = COALESCE(%s, status),
                priority = COALESCE(%s, priority),
                assignee_id = COALESCE(%s, assignee_id),
                assignee_name = COALESCE(%s, assignee_name),
                due_date = COALESCE(%s, due_date),
                completed_at = CASE WHEN %s = 'completed' THEN CURRENT_TIMESTAMP ELSE completed_at END,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            RETURNING id, project_id, name, description, status, priority, assignee_id, assignee_name, due_date, completed_at, depends_on, created_at, updated_at;
        """, (
            data.get("name"), data.get("description"), data.get("status"),
            data.get("priority"), data.get("assignee_id"), data.get("assignee_name"),
            data.get("due_date"), data.get("status", ""), deliverable_id
        ))
        conn.commit()
        return row_to_dict(cur.fetchone())

def delete_deliverable(config, deliverable_id):
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute("DELETE FROM deliverables WHERE id = %s RETURNING id;", (deliverable_id,))
        conn.commit()
        return cur.fetchone() is not None

def row_to_dict(row):
    if not row:
        return None
    return {
        "id": str(row[0]),
        "project_id": str(row[1]),
        "name": row[2],
        "description": row[3],
        "status": row[4],
        "priority": row[5],
        "assignee_id": row[6],
        "assignee_name": row[7],
        "due_date": row[8].isoformat() if row[8] else None,
        "completed_at": row[9].isoformat() if row[9] else None,
        "depends_on": [str(d) for d in row[10]] if row[10] else [],
        "created_at": row[11].isoformat() if row[11] else None,
        "updated_at": row[12].isoformat() if row[12] else None,
    }

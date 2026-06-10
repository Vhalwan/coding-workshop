"""
PostgreSQL service for deliverables.
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
        cur.execute("""
            CREATE TABLE IF NOT EXISTS deliverable_dependencies (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                deliverable_id UUID NOT NULL,
                depends_on_id UUID NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (deliverable_id, depends_on_id)
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
            _optional_date(data.get("due_date")), data.get("depends_on", [])
        ))
        conn.commit()
        d = row_to_dict(cur.fetchone())
        d["dependencies"] = []
        return d

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
        deliverables = [row_to_dict(r) for r in cur.fetchall()]
        deps_map = get_dependencies_map(config, project_id=project_id)
        return enrich_with_dependencies(deliverables, deps_map)

def get_deliverable_by_id(config, deliverable_id):
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute("""
            SELECT id, project_id, name, description, status, priority, assignee_id, assignee_name, due_date, completed_at, depends_on, created_at, updated_at
            FROM deliverables WHERE id = %s;
        """, (deliverable_id,))
        d = row_to_dict(cur.fetchone())
        if d:
            deps_map = get_dependencies_map(config, deliverable_ids=[deliverable_id])
            enrich_with_dependencies([d], deps_map)
        return d

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
                due_date = %s,
                completed_at = CASE WHEN %s = 'completed' THEN CURRENT_TIMESTAMP ELSE completed_at END,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            RETURNING id, project_id, name, description, status, priority, assignee_id, assignee_name, due_date, completed_at, depends_on, created_at, updated_at;
        """, (
            data.get("name"), data.get("description"), data.get("status"),
            data.get("priority"), data.get("assignee_id"), data.get("assignee_name"),
            _optional_date(data.get("due_date")),             data.get("status", ""), deliverable_id
        ))
        conn.commit()
        d = row_to_dict(cur.fetchone())
        if d:
            deps_map = get_dependencies_map(config, deliverable_ids=[deliverable_id])
            enrich_with_dependencies([d], deps_map)
        return d

def delete_deliverable(config, deliverable_id):
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute("DELETE FROM deliverable_dependencies WHERE deliverable_id = %s OR depends_on_id = %s;", (deliverable_id, deliverable_id))
        cur.execute("DELETE FROM deliverables WHERE id = %s RETURNING id;", (deliverable_id,))
        conn.commit()
        return cur.fetchone() is not None

def get_dependencies_map(config, project_id=None, deliverable_ids=None):
    conn = get_connection(config)
    with conn.cursor() as cur:
        query = """
            SELECT dd.deliverable_id, d.id, d.name
            FROM deliverable_dependencies dd
            JOIN deliverables d ON d.id = dd.depends_on_id
            WHERE 1=1
        """
        params = []
        if project_id:
            query += " AND dd.deliverable_id IN (SELECT id FROM deliverables WHERE project_id = %s)"
            params.append(project_id)
        if deliverable_ids:
            query += " AND dd.deliverable_id = ANY(%s)"
            params.append(deliverable_ids)
        cur.execute(query, params)
        deps_map = {}
        for row in cur.fetchall():
            did = str(row[0])
            deps_map.setdefault(did, []).append({"id": str(row[1]), "name": row[2]})
        return deps_map

def enrich_with_dependencies(deliverables, deps_map):
    for d in deliverables:
        d["dependencies"] = deps_map.get(d["id"], [])
    return deliverables

def get_direct_dependencies(config, deliverable_id):
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute("SELECT depends_on_id FROM deliverable_dependencies WHERE deliverable_id = %s;", (deliverable_id,))
        return [str(r[0]) for r in cur.fetchall()]

def would_create_cycle(config, deliverable_id, depends_on_id):
    visited = set()
    stack = [depends_on_id]
    while stack:
        current = stack.pop()
        if current == deliverable_id:
            return True
        if current in visited:
            continue
        visited.add(current)
        stack.extend(get_direct_dependencies(config, current))
    return False

def add_dependency(config, deliverable_id, depends_on_id):
    if deliverable_id == depends_on_id:
        raise ValueError("A deliverable cannot depend on itself")
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute("SELECT project_id FROM deliverables WHERE id = %s;", (deliverable_id,))
        row1 = cur.fetchone()
        cur.execute("SELECT project_id FROM deliverables WHERE id = %s;", (depends_on_id,))
        row2 = cur.fetchone()
        if not row1 or not row2:
            return None
        if str(row1[0]) != str(row2[0]):
            raise ValueError("Dependencies must be within the same project")
    if would_create_cycle(config, deliverable_id, depends_on_id):
        raise ValueError("Circular dependency detected")
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO deliverable_dependencies (deliverable_id, depends_on_id)
            VALUES (%s, %s)
            RETURNING id, deliverable_id, depends_on_id, created_at;
        """, (deliverable_id, depends_on_id))
        conn.commit()
        row = cur.fetchone()
        return {"id": str(row[0]), "deliverable_id": str(row[1]), "depends_on_id": str(row[2]), "created_at": row[3].isoformat() if row[3] else None}

def remove_dependency(config, deliverable_id, depends_on_id):
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute("""
            DELETE FROM deliverable_dependencies
            WHERE deliverable_id = %s AND depends_on_id = %s
            RETURNING id;
        """, (deliverable_id, depends_on_id))
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

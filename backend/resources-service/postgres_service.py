"""
PostgreSQL service for resources (team members & allocations).
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
            CREATE TABLE IF NOT EXISTS resources (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                role VARCHAR(255),
                department VARCHAR(255),
                capacity_hours_per_week INTEGER DEFAULT 40,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS allocations (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
                project_id UUID NOT NULL,
                project_name VARCHAR(255),
                hours_per_week INTEGER NOT NULL,
                start_date DATE,
                end_date DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        conn.commit()

def create_resource(config, data):
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO resources (name, email, role, department, capacity_hours_per_week)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id, name, email, role, department, capacity_hours_per_week, created_at, updated_at;
        """, (data["name"], data["email"], data.get("role"), data.get("department"), data.get("capacity_hours_per_week", 40)))
        conn.commit()
        return resource_to_dict(cur.fetchone())

def get_all_resources(config):
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute("""
            SELECT r.id, r.name, r.email, r.role, r.department, r.capacity_hours_per_week, r.created_at, r.updated_at,
                   COALESCE(SUM(a.hours_per_week), 0) as allocated_hours
            FROM resources r
            LEFT JOIN allocations a ON r.id = a.resource_id
            GROUP BY r.id ORDER BY r.name;
        """)
        rows = cur.fetchall()
        return [{
            "id": str(r[0]), "name": r[1], "email": r[2], "role": r[3],
            "department": r[4], "capacity_hours_per_week": r[5],
            "created_at": r[6].isoformat(), "updated_at": r[7].isoformat(),
            "allocated_hours": int(r[8]), "available_hours": max(0, r[5] - int(r[8]))
        } for r in rows]

def get_resource_by_id(config, resource_id):
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute("""
            SELECT id, name, email, role, department, capacity_hours_per_week, created_at, updated_at
            FROM resources WHERE id = %s;
        """, (resource_id,))
        return resource_to_dict(cur.fetchone())

def update_resource(config, resource_id, data):
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE resources SET
                name = COALESCE(%s, name),
                email = COALESCE(%s, email),
                role = COALESCE(%s, role),
                department = COALESCE(%s, department),
                capacity_hours_per_week = COALESCE(%s, capacity_hours_per_week),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            RETURNING id, name, email, role, department, capacity_hours_per_week, created_at, updated_at;
        """, (data.get("name"), data.get("email"), data.get("role"), data.get("department"), data.get("capacity_hours_per_week"), resource_id))
        conn.commit()
        return resource_to_dict(cur.fetchone())

def delete_resource(config, resource_id):
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute("DELETE FROM resources WHERE id = %s RETURNING id;", (resource_id,))
        conn.commit()
        return cur.fetchone() is not None

def create_allocation(config, data):
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO allocations (resource_id, project_id, project_name, hours_per_week, start_date, end_date)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id, resource_id, project_id, project_name, hours_per_week, start_date, end_date, created_at;
        """, (data["resource_id"], data["project_id"], data.get("project_name"), data["hours_per_week"], data.get("start_date"), data.get("end_date")))
        conn.commit()
        r = cur.fetchone()
        return {"id": str(r[0]), "resource_id": str(r[1]), "project_id": str(r[2]), "project_name": r[3], "hours_per_week": r[4], "start_date": r[5].isoformat() if r[5] else None, "end_date": r[6].isoformat() if r[6] else None, "created_at": r[7].isoformat()}

def get_allocations(config, resource_id=None, project_id=None):
    conn = get_connection(config)
    with conn.cursor() as cur:
        query = "SELECT id, resource_id, project_id, project_name, hours_per_week, start_date, end_date, created_at FROM allocations WHERE 1=1"
        params = []
        if resource_id:
            query += " AND resource_id = %s"
            params.append(resource_id)
        if project_id:
            query += " AND project_id = %s"
            params.append(project_id)
        cur.execute(query + " ORDER BY created_at DESC;", params)
        return [{"id": str(r[0]), "resource_id": str(r[1]), "project_id": str(r[2]), "project_name": r[3], "hours_per_week": r[4], "start_date": r[5].isoformat() if r[5] else None, "end_date": r[6].isoformat() if r[6] else None, "created_at": r[7].isoformat()} for r in cur.fetchall()]

def delete_allocation(config, allocation_id):
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute("DELETE FROM allocations WHERE id = %s RETURNING id;", (allocation_id,))
        conn.commit()
        return cur.fetchone() is not None

def resource_to_dict(row):
    if not row:
        return None
    return {"id": str(row[0]), "name": row[1], "email": row[2], "role": row[3], "department": row[4], "capacity_hours_per_week": row[5], "created_at": row[6].isoformat(), "updated_at": row[7].isoformat()}

"""
PostgreSQL service for auth - users table management.
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
    """Create users table if it doesn't exist."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                full_name VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL DEFAULT 'viewer',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        conn.commit()

def create_user(config, email, password_hash, full_name, role='viewer'):
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO users (email, password_hash, full_name, role)
            VALUES (%s, %s, %s, %s)
            RETURNING id, email, full_name, role, created_at;
        """, (email, password_hash, full_name, role))
        conn.commit()
        row = cur.fetchone()
        return {
            "id": str(row[0]),
            "email": row[1],
            "full_name": row[2],
            "role": row[3],
            "created_at": row[4].isoformat()
        }

def get_user_by_email(config, email):
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute("""
            SELECT id, email, password_hash, full_name, role, created_at
            FROM users WHERE email = %s;
        """, (email,))
        row = cur.fetchone()
        if not row:
            return None
        return {
            "id": str(row[0]),
            "email": row[1],
            "password_hash": row[2],
            "full_name": row[3],
            "role": row[4],
            "created_at": row[5].isoformat()
        }

def get_user_by_id(config, user_id):
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute("""
            SELECT id, email, full_name, role, created_at
            FROM users WHERE id = %s;
        """, (user_id,))
        row = cur.fetchone()
        if not row:
            return None
        return {
            "id": str(row[0]),
            "email": row[1],
            "full_name": row[2],
            "role": row[3],
            "created_at": row[4].isoformat()
        }

def get_all_users(config):
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute("""
            SELECT id, email, full_name, role, created_at
            FROM users ORDER BY created_at DESC;
        """)
        rows = cur.fetchall()
        return [
            {
                "id": str(r[0]),
                "email": r[1],
                "full_name": r[2],
                "role": r[3],
                "created_at": r[4].isoformat()
            }
            for r in rows
        ]

# backend/database.py
# SQLite database setup for TOP LABLE
# Handles Users, Admins, Products, TryOnResults

import sqlite3
import hashlib
import json
import os
from pathlib import Path

# ── Database file location ────────────────────────────────────
DB_PATH = Path(__file__).resolve().parent / "toplable.db"

def get_connection():
    """Get a database connection."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row  # Returns rows as dicts
    return conn

def hash_password(password: str) -> str:
    """Hash a password using SHA-256."""
    return hashlib.sha256(password.encode()).hexdigest()

def init_database():
    """
    Create all tables if they don't exist.
    Based on the ER diagram in the project report.
    """
    conn = get_connection()
    cursor = conn.cursor()

    # ── USERS TABLE ───────────────────────────────────────────
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS Users (
            user_id    INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT    NOT NULL,
            email      TEXT    NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            mobile_number TEXT,
            birthday   TEXT,
            created_at TEXT    DEFAULT (datetime('now'))
        )
    """)

    # ── ADMINS TABLE ──────────────────────────────────────────
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS Admins (
            admin_id      INTEGER PRIMARY KEY AUTOINCREMENT,
            email         TEXT    NOT NULL UNIQUE,
            password_hash TEXT    NOT NULL,
            name          TEXT    NOT NULL,
            created_at    TEXT    DEFAULT (datetime('now'))
        )
    """)

    # ── PRODUCTS TABLE ────────────────────────────────────────
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS Products (
            product_id       INTEGER PRIMARY KEY AUTOINCREMENT,
            name             TEXT    NOT NULL,
            category         TEXT    NOT NULL,
            price            REAL    NOT NULL,
            description      TEXT,
            image_path       TEXT,
            image_gallery    TEXT    DEFAULT '[]',
            colors           TEXT,
            sizes            TEXT,
            created_at       TEXT    DEFAULT (datetime('now')),
            created_by_admin INTEGER REFERENCES Admins(admin_id)
        )
    """)
    # migrate existing DBs missing columns
    for col, definition in [
        ("stock",            "INTEGER DEFAULT 0"),
        ("image_gallery",    "TEXT DEFAULT '[]'"),
        ("size_stock",       "TEXT DEFAULT '{}'"),
        ("color_size_stock", "TEXT DEFAULT '{}'"),
        ("color_images",     "TEXT DEFAULT '{}'"),
    ]:
        try:
            cursor.execute(f"ALTER TABLE Products ADD COLUMN {col} {definition}")
            conn.commit()
        except Exception:
            pass

    # ── TRY-ON RESULTS TABLE ──────────────────────────────────
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS TryOnResults (
            result_id         INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id           INTEGER REFERENCES Users(user_id),
            product_id        INTEGER REFERENCES Products(product_id),
            person_image_path TEXT,
            output_image_path TEXT,
            status            TEXT    DEFAULT 'pending',
            error_message     TEXT,
            created_at        TEXT    DEFAULT (datetime('now'))
        )
    """)

    # migrate: add cloth_image_path if missing
    try:
        cursor.execute("ALTER TABLE TryOnResults ADD COLUMN cloth_image_path TEXT DEFAULT ''")
    except Exception:
        pass

    # ── PRODUCT VIEWS TABLE (for recommendations) ─────────────
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS ProductViews (
            view_id    INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id    INTEGER REFERENCES Users(user_id),
            product_id INTEGER REFERENCES Products(product_id),
            viewed_at  TEXT    DEFAULT (datetime('now'))
        )
    """)

    # ── ORDERS TABLE ─────────────────────────────────────────
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS Orders (
            order_id   INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id    INTEGER REFERENCES Users(user_id),
            items      TEXT    DEFAULT '[]',
            subtotal   REAL    DEFAULT 0,
            shipping   REAL    DEFAULT 0,
            discount   REAL    DEFAULT 0,
            total      REAL    DEFAULT 0,
            status     TEXT    DEFAULT 'confirmed',
            address    TEXT    DEFAULT '{}',
            created_at TEXT    DEFAULT (datetime('now'))
        )
    """)

    # ── USER BODY PROFILE TABLE ───────────────────────────────
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS UserBodyProfile (
            profile_id      INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id         INTEGER NOT NULL UNIQUE REFERENCES Users(user_id) ON DELETE CASCADE,
            height          REAL,
            weight          REAL,
            gender          TEXT,
            skin_tone       TEXT,
            body_type       TEXT,
            chest           REAL,
            waist           REAL,
            hips            REAL,
            preferred_style TEXT,
            updated_at      TEXT    DEFAULT (datetime('now'))
        )
    """)

    # ── Add stock column if missing (migration) ──────────────
    try:
        cursor.execute("ALTER TABLE Products ADD COLUMN stock INTEGER DEFAULT 0")
        conn.commit()
    except Exception:
        pass  # column already exists

    # ── Create default admin account if none exists ───────────
    cursor.execute("SELECT COUNT(*) as count FROM Admins")
    admin_count = cursor.fetchone()["count"]

    if admin_count == 0:
        default_password = hash_password("admin123")
        cursor.execute("""
            INSERT INTO Admins (email, password_hash, name)
            VALUES (?, ?, ?)
        """, ("admin@toplable.com", default_password, "Super Admin"))
        print("[OK] Default admin created: admin@toplable.com / admin123")

    conn.commit()
    conn.close()
    print(f"[OK] Database initialized: {DB_PATH}")

# ── USER FUNCTIONS ────────────────────────────────────────────

def create_user(name: str, email: str, password: str,
                mobile: str = None, birthday: str = None):
    """Register a new user. Returns user dict or raises error."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        password_hash = hash_password(password)
        cursor.execute("""
            INSERT INTO Users (name, email, password_hash, mobile_number, birthday)
            VALUES (?, ?, ?, ?, ?)
        """, (name, email, password_hash, mobile, birthday))
        conn.commit()
        user_id = cursor.lastrowid
        return {"user_id": user_id, "name": name, "email": email}
    except sqlite3.IntegrityError:
        raise ValueError("Email already registered.")
    finally:
        conn.close()

def login_user(email: str, password: str):
    """Verify user login. Returns user dict or None."""
    conn = get_connection()
    cursor = conn.cursor()
    password_hash = hash_password(password)
    cursor.execute("""
        SELECT user_id, name, email, created_at
        FROM Users
        WHERE email = ? AND password_hash = ?
    """, (email, password_hash))
    row = cursor.fetchone()
    conn.close()
    if row:
        return dict(row)
    return None

def change_password(user_id: int, current_password: str, new_password: str) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    current_hash = hash_password(current_password)
    cursor.execute(
        "SELECT user_id FROM Users WHERE user_id = ? AND password_hash = ?",
        (user_id, current_hash)
    )
    if not cursor.fetchone():
        conn.close()
        return False
    cursor.execute(
        "UPDATE Users SET password_hash = ? WHERE user_id = ?",
        (hash_password(new_password), user_id)
    )
    conn.commit()
    conn.close()
    return True

def get_all_users():
    """Get all users (for admin panel)."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT user_id, name, email, mobile_number, birthday, created_at
        FROM Users
        ORDER BY created_at DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def delete_user(user_id: int):
    """Delete a user by ID."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM Users WHERE user_id = ?", (user_id,))
    conn.commit()
    conn.close()

# ── ADMIN FUNCTIONS ───────────────────────────────────────────

def login_admin(email: str, password: str):
    """Verify admin login. Returns admin dict or None."""
    conn = get_connection()
    cursor = conn.cursor()
    password_hash = hash_password(password)
    cursor.execute("""
        SELECT admin_id, name, email, created_at
        FROM Admins
        WHERE email = ? AND password_hash = ?
    """, (email, password_hash))
    row = cursor.fetchone()
    conn.close()
    if row:
        return dict(row)
    return None

# ── TRY-ON RESULT FUNCTIONS ───────────────────────────────────

def save_tryon_result(user_id: int, output_image_path: str,
                      person_image_path: str = '', cloth_image_path: str = '',
                      product_id: int = None, status: str = "success"):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO TryOnResults
            (user_id, product_id, person_image_path, cloth_image_path, output_image_path, status)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (user_id, product_id, person_image_path, cloth_image_path, output_image_path, status))
    conn.commit()
    result_id = cursor.lastrowid
    conn.close()
    return result_id

def delete_tryon_result(result_id: int, user_id: int) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "DELETE FROM TryOnResults WHERE result_id = ? AND user_id = ?",
        (result_id, user_id)
    )
    conn.commit()
    deleted = cursor.rowcount > 0
    conn.close()
    return deleted

def get_all_tryon_results():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT r.result_id, r.user_id, u.name as user_name, u.email,
               r.status, r.person_image_path, r.cloth_image_path,
               r.output_image_path, r.product_id, r.created_at
        FROM TryOnResults r
        LEFT JOIN Users u ON r.user_id = u.user_id
        ORDER BY r.created_at DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    results = []
    for row in rows:
        r = dict(row)
        cloth = r.get('cloth_image_path', '') or ''
        if cloth.endswith('custom_cloth.jpg'):
            r['cloth_image_path'] = ''
        results.append(r)
    return results

def get_user_tryon_results(user_id: int):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT r.result_id, r.user_id, r.status,
               r.person_image_path, r.cloth_image_path,
               r.output_image_path, r.product_id, r.created_at,
               p.name as product_name, p.category as product_category,
               p.image_path as product_image_path
        FROM TryOnResults r
        LEFT JOIN Products p ON r.product_id = p.product_id
        WHERE r.user_id = ?
        ORDER BY r.created_at DESC
    """, (user_id,))
    rows = cursor.fetchall()
    conn.close()
    results = []
    for row in rows:
        r = dict(row)
        cloth = r.get('cloth_image_path', '') or ''
        if cloth.endswith('custom_cloth.jpg') or not cloth:
            # Fall back to the product image when we have one, otherwise blank.
            product_img = r.get('product_image_path') or ''
            if product_img:
                # image_path is stored as a full URL; extract the relative portion
                # e.g. "http://localhost:8000/static/products/xxx.png" → "/static/products/xxx.png"
                from urllib.parse import urlparse
                parsed = urlparse(product_img)
                r['cloth_image_path'] = parsed.path  # e.g. "/static/products/xxx.png"
            else:
                r['cloth_image_path'] = ''
        r.pop('product_image_path', None)  # don't expose internal field to frontend
        results.append(r)
    return results

# ── PRODUCT FUNCTIONS ─────────────────────────────────────────

def _parse_product(row) -> dict:
    p = dict(row)
    p['colors']           = json.loads(p.get('colors')           or '[]')
    p['sizes']            = json.loads(p.get('sizes')            or '[]')
    p['image_gallery']    = json.loads(p.get('image_gallery')    or '[]')
    p['size_stock']       = json.loads(p.get('size_stock')       or '{}')
    p['color_size_stock'] = json.loads(p.get('color_size_stock') or '{}')
    p['color_images']     = json.loads(p.get('color_images')     or '{}')
    p['image_url']        = p.get('image_path', '')
    p['id']               = p.get('product_id')
    return p

def get_all_products() -> list:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM Products ORDER BY product_id")
    rows = cursor.fetchall()
    conn.close()
    return [_parse_product(r) for r in rows]

def get_product_by_id(product_id: int):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM Products WHERE product_id = ?", (product_id,))
    row = cursor.fetchone()
    conn.close()
    return _parse_product(row) if row else None

def create_product(name: str, category: str, price: float, description: str = "",
                   image_url: str = "", colors=None, sizes=None, stock: int = 0,
                   image_gallery=None, size_stock=None, color_size_stock=None,
                   color_images=None) -> dict:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO Products (name, category, price, description, image_path, image_gallery,
                              colors, sizes, stock, size_stock, color_size_stock, color_images)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (name, category, float(price), description, image_url,
          json.dumps(image_gallery or []),
          json.dumps(colors or []), json.dumps(sizes or []),
          int(stock), json.dumps(size_stock or {}),
          json.dumps(color_size_stock or {}),
          json.dumps(color_images or {})))
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()
    return get_product_by_id(new_id)

def update_product(product_id: int, name: str, category: str, price: float,
                   description: str = "", image_url: str = "",
                   colors=None, sizes=None, stock: int = 0, image_gallery=None,
                   size_stock=None, color_size_stock=None, color_images=None):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE Products
        SET name=?, category=?, price=?, description=?, image_path=?, image_gallery=?,
            colors=?, sizes=?, stock=?, size_stock=?, color_size_stock=?, color_images=?
        WHERE product_id=?
    """, (name, category, float(price), description, image_url,
          json.dumps(image_gallery or []),
          json.dumps(colors or []), json.dumps(sizes or []),
          int(stock), json.dumps(size_stock or {}),
          json.dumps(color_size_stock or {}),
          json.dumps(color_images or {}), product_id))
    conn.commit()
    affected = cursor.rowcount
    conn.close()
    return get_product_by_id(product_id) if affected > 0 else None

def delete_product(product_id: int) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM Products WHERE product_id = ?", (product_id,))
    conn.commit()
    deleted = cursor.rowcount > 0
    conn.close()
    return deleted

def seed_products_if_empty(sample_products: list):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) as count FROM Products")
    if cursor.fetchone()["count"] == 0:
        for p in sample_products:
            cursor.execute("""
                INSERT INTO Products (name, category, price, description, image_path, colors, sizes, stock)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (p["name"], p["category"], p["price"], p.get("description", ""),
                  p.get("image_url", ""), json.dumps(p.get("colors", [])),
                  json.dumps(p.get("sizes", [])), p.get("stock", 0)))
        conn.commit()
        print(f"[OK] Seeded {len(sample_products)} sample products into database")
    conn.close()

def seed_products_if_needed(sample_products: list):
    """Insert only products whose name does not already exist in the DB.
    Safe to call every startup — never creates duplicates."""
    conn = get_connection()
    cursor = conn.cursor()
    added = 0
    for p in sample_products:
        cursor.execute("SELECT COUNT(*) FROM Products WHERE name = ?", (p["name"],))
        if cursor.fetchone()[0] == 0:
            cursor.execute("""
                INSERT INTO Products (name, category, price, description, image_path, colors, sizes, stock)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (p["name"], p["category"], p["price"], p.get("description", ""),
                  p.get("image_url", ""), json.dumps(p.get("colors", [])),
                  json.dumps(p.get("sizes", [])), p.get("stock", 0)))
            added += 1
    if added:
        conn.commit()
        print(f"[OK] Added {added} new products to database")
    conn.close()

# ── ORDER FUNCTIONS ───────────────────────────────────────────

def create_order(user_id: int, items: list, subtotal: float, shipping: float,
                 discount: float, total: float, address: dict) -> dict:
    conn = get_connection()
    cursor = conn.cursor()
    # Reduce stock for each ordered item — per-size only
    for item in items:
        pid  = item.get('product_id')
        qty  = int(item.get('quantity', 1))
        size = item.get('size', '')
        if not pid:
            continue
        cursor.execute(
            "SELECT size_stock, color_size_stock, stock, sizes FROM Products WHERE product_id = ?",
            (pid,)
        )
        row = cursor.fetchone()
        if not row:
            continue

        size_stock       = json.loads(row['size_stock']       or '{}')
        color_size_stock = json.loads(row['color_size_stock'] or '{}')
        total_stock      = int(row['stock'] or 0)
        sizes_list       = json.loads(row['sizes']            or '[]')
        color            = item.get('color', '')

        # Prefer color_size_stock when color is provided
        if color and color_size_stock and color in color_size_stock:
            color_entry = color_size_stock[color]
            if size and size in color_entry:
                color_entry[size] = max(0, color_entry[size] - qty)
            color_size_stock[color] = color_entry
            new_total = sum(
                sum(sizes.values()) for sizes in color_size_stock.values()
            )
            cursor.execute(
                "UPDATE Products SET color_size_stock = ?, stock = ? WHERE product_id = ?",
                (json.dumps(color_size_stock), new_total, pid)
            )
        elif size and size in size_stock:
            # Fall back to flat size_stock
            size_stock[size] = max(0, size_stock[size] - qty)
            new_total = sum(size_stock.values())
            cursor.execute(
                "UPDATE Products SET size_stock = ?, stock = ? WHERE product_id = ?",
                (json.dumps(size_stock), new_total, pid)
            )
        else:
            # No granular stock — reduce total only
            cursor.execute(
                "UPDATE Products SET stock = MAX(0, stock - ?) WHERE product_id = ?",
                (qty, pid)
            )
    cursor.execute("""
        INSERT INTO Orders (user_id, items, subtotal, shipping, discount, total, address)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (user_id, json.dumps(items), subtotal, shipping, discount, total, json.dumps(address)))
    conn.commit()
    order_id = cursor.lastrowid
    conn.close()
    return get_order_by_id(order_id)

def get_order_by_id(order_id: int) -> dict:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM Orders WHERE order_id = ?", (order_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    o = dict(row)
    o['items']   = json.loads(o.get('items')   or '[]')
    o['address'] = json.loads(o.get('address') or '{}')
    return o

def get_user_orders(user_id: int) -> list:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM Orders WHERE user_id = ? ORDER BY created_at DESC", (user_id,))
    rows = cursor.fetchall()
    conn.close()
    result = []
    for row in rows:
        o = dict(row)
        o['items']   = json.loads(o.get('items')   or '[]')
        o['address'] = json.loads(o.get('address') or '{}')
        result.append(o)
    return result

def get_sales_by_product() -> dict:
    """Returns {product_id: total_quantity_sold} aggregated from all orders."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT items FROM Orders")
    rows = cursor.fetchall()
    conn.close()
    sales: dict = {}
    for row in rows:
        items = json.loads(row['items'] or '[]')
        for item in items:
            pid = item.get('product_id')
            qty = int(item.get('quantity', 1))
            if pid:
                sales[pid] = sales.get(pid, 0) + qty
    return sales

def get_all_orders() -> list:
    """Get all orders with customer details (for admin panel)."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT o.order_id, o.user_id, o.items, o.subtotal, o.shipping,
               o.discount, o.total, o.status, o.address, o.created_at,
               u.name  AS user_name,
               u.email AS user_email,
               u.mobile_number AS user_mobile
        FROM Orders o
        LEFT JOIN Users u ON o.user_id = u.user_id
        ORDER BY o.created_at DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    result = []
    for row in rows:
        o = dict(row)
        o['items']   = json.loads(o.get('items')   or '[]')
        o['address'] = json.loads(o.get('address') or '{}')
        result.append(o)
    return result

# ── USER PROFILE FUNCTIONS ────────────────────────────────────

def get_user_profile(user_id: int):
    """Get user info merged with body profile (LEFT JOIN)."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT u.user_id, u.name, u.email, u.mobile_number, u.birthday, u.created_at,
               b.height, b.weight, b.gender, b.skin_tone, b.body_type,
               b.chest, b.waist, b.hips, b.preferred_style
        FROM Users u
        LEFT JOIN UserBodyProfile b ON u.user_id = b.user_id
        WHERE u.user_id = ?
    """, (user_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def update_user_info(user_id: int, name: str = None, mobile: str = None, birthday: str = None):
    """Update basic user fields (name, mobile, birthday). Skips None values."""
    conn = get_connection()
    cursor = conn.cursor()
    updates, values = [], []
    if name is not None:
        updates.append("name = ?")
        values.append(name)
    if mobile is not None:
        updates.append("mobile_number = ?")
        values.append(mobile)
    if birthday is not None:
        updates.append("birthday = ?")
        values.append(birthday)
    if updates:
        values.append(user_id)
        cursor.execute(f"UPDATE Users SET {', '.join(updates)} WHERE user_id = ?", values)
        conn.commit()
    conn.close()
    return get_user_profile(user_id)

def upsert_body_profile(user_id: int, height=None, weight=None, gender=None,
                        skin_tone=None, body_type=None, chest=None, waist=None,
                        hips=None, preferred_style=None):
    """Insert or fully replace the body profile row for a user."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO UserBodyProfile
            (user_id, height, weight, gender, skin_tone, body_type,
             chest, waist, hips, preferred_style, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(user_id) DO UPDATE SET
            height          = excluded.height,
            weight          = excluded.weight,
            gender          = excluded.gender,
            skin_tone       = excluded.skin_tone,
            body_type       = excluded.body_type,
            chest           = excluded.chest,
            waist           = excluded.waist,
            hips            = excluded.hips,
            preferred_style = excluded.preferred_style,
            updated_at      = datetime('now')
    """, (user_id, height, weight, gender, skin_tone, body_type,
          chest, waist, hips, preferred_style))
    conn.commit()
    conn.close()


# Run init when this file is imported
init_database()
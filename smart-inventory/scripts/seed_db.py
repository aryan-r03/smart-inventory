"""
Seed database with sample data from CSV files.
Run: python scripts/seed_db.py
"""
import asyncio
import csv
import sys
import os
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.db.session import AsyncSessionLocal
from app.db.base import Base
from app.db.session import engine
from app.models.models import User, Supplier, InventoryItem, UsageLog, UserRole, ItemCategory
from app.core.security import get_password_hash


SAMPLE_USERS = [
    {"email": "admin@lab.edu", "full_name": "Admin User", "password": "Admin@1234", "role": UserRole.admin, "department": "Administration"},
    {"email": "staff@lab.edu", "full_name": "Lab Staff", "password": "Staff@1234", "role": UserRole.lab_staff, "department": "Chemistry"},
    {"email": "student@lab.edu", "full_name": "Student User", "password": "Student@1234", "role": UserRole.student, "department": "Physics"},
]


async def seed():
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        print("🌱 Seeding users...")
        users = {}
        for u in SAMPLE_USERS:
            user = User(
                email=u["email"],
                full_name=u["full_name"],
                hashed_password=get_password_hash(u["password"]),
                role=u["role"],
                department=u["department"],
            )
            db.add(user)
            users[u["role"]] = user

        await db.flush()

        print("🌱 Seeding suppliers & inventory...")
        suppliers = {}
        items = {}

        with open("data/sample_inventory.csv") as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Create supplier if not exists
                sname = row["supplier_name"]
                if sname not in suppliers:
                    sup = Supplier(
                        name=sname,
                        contact_email=row["supplier_email"],
                        lead_time_days=int(row["lead_time_days"]),
                    )
                    db.add(sup)
                    await db.flush()
                    suppliers[sname] = sup

                from app.services.qr_service import generate_qr_code, generate_sku

                item = InventoryItem(
                    item_name=row["item_name"],
                    category=row["category"],
                    quantity=int(row["quantity"]),
                    minimum_threshold=int(row["minimum_threshold"]),
                    reorder_quantity=int(row["reorder_quantity"]),
                    unit_cost=float(row["unit_cost"]) if row["unit_cost"] else None,
                    location=row["location"],
                    purchase_date=datetime.fromisoformat(row["purchase_date"]) if row["purchase_date"] else None,
                    expiry_date=datetime.fromisoformat(row["expiry_date"]) if row["expiry_date"] else None,
                    supplier_id=suppliers[sname].id,
                    unit=row["unit"],
                    sku=f"{row['category'][:2].upper()}-{row['item_name'][:4].upper()}-{row['id'].zfill(4)}",
                )
                item.qr_code = generate_qr_code(item.sku)
                db.add(item)
                await db.flush()
                items[row["id"]] = item

        print("🌱 Seeding usage logs...")
        with open("data/sample_usage_history.csv") as f:
            reader = csv.DictReader(f)
            for row in reader:
                item_id = row["item_id"]
                if item_id not in items:
                    continue
                item = items[item_id]
                log = UsageLog(
                    item_id=item.id,
                    user_id=users[UserRole.lab_staff].id,
                    quantity_change=-int(row["quantity_consumed"]),
                    quantity_after=item.quantity,
                    action=row["action"],
                    department=row["department"],
                    timestamp=datetime.fromisoformat(row["date"]),
                )
                db.add(log)

        await db.commit()
        print("✅ Database seeded successfully!")
        print("\n📋 Login credentials:")
        for u in SAMPLE_USERS:
            print(f"   {u['role'].value:<12} → {u['email']} / {u['password']}")


if __name__ == "__main__":
    asyncio.run(seed())

"""
Unit and integration tests for LabTrack API.
Run: pytest tests/ -v
"""
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.main import app
from app.db.base import Base
from app.db.session import get_db
from app.core.security import get_password_hash

# ─── Test Database Setup ──────────────────────────────────────────────────────
TEST_DB_URL = "sqlite+aiosqlite:///./test.db"

test_engine = create_async_engine(TEST_DB_URL, echo=False)
TestSessionLocal = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


async def override_get_db():
    async with TestSessionLocal() as session:
        yield session


app.dependency_overrides[get_db] = override_get_db


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def admin_token(client):
    """Create admin user and return token."""
    await client.post("/api/auth/register", json={
        "email": "admin@test.com",
        "full_name": "Test Admin",
        "password": "Admin@1234",
        "role": "admin",
        "department": "Administration",
    })
    resp = await client.post("/api/auth/login", json={
        "email": "admin@test.com",
        "password": "Admin@1234",
    })
    return resp.json()["access_token"]


@pytest_asyncio.fixture
async def staff_token(client):
    await client.post("/api/auth/register", json={
        "email": "staff@test.com",
        "full_name": "Test Staff",
        "password": "Staff@1234",
        "role": "lab_staff",
        "department": "Chemistry",
    })
    resp = await client.post("/api/auth/login", json={
        "email": "staff@test.com",
        "password": "Staff@1234",
    })
    return resp.json()["access_token"]


# ─── Auth Tests ───────────────────────────────────────────────────────────────
class TestAuth:
    @pytest.mark.asyncio
    async def test_register_success(self, client):
        resp = await client.post("/api/auth/register", json={
            "email": "new@test.com",
            "full_name": "New User",
            "password": "Password@1234",
            "role": "student",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["email"] == "new@test.com"
        assert data["role"] == "student"

    @pytest.mark.asyncio
    async def test_register_duplicate_email(self, client):
        payload = {"email": "dup@test.com", "full_name": "Dup", "password": "Pass@1234"}
        await client.post("/api/auth/register", json=payload)
        resp = await client.post("/api/auth/register", json=payload)
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_login_success(self, client):
        await client.post("/api/auth/register", json={
            "email": "login@test.com", "full_name": "L", "password": "Login@1234",
        })
        resp = await client.post("/api/auth/login", json={
            "email": "login@test.com", "password": "Login@1234",
        })
        assert resp.status_code == 200
        assert "access_token" in resp.json()
        assert "refresh_token" in resp.json()

    @pytest.mark.asyncio
    async def test_login_wrong_password(self, client):
        await client.post("/api/auth/register", json={
            "email": "wp@test.com", "full_name": "WP", "password": "Right@1234",
        })
        resp = await client.post("/api/auth/login", json={
            "email": "wp@test.com", "password": "Wrong@1234",
        })
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_get_me(self, client, admin_token):
        resp = await client.get("/api/users/me", headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.status_code == 200
        assert resp.json()["email"] == "admin@test.com"


# ─── Inventory Tests ──────────────────────────────────────────────────────────
class TestInventory:
    @pytest.mark.asyncio
    async def test_create_item(self, client, staff_token):
        resp = await client.post("/api/inventory/", json={
            "item_name": "Test Beaker",
            "category": "equipment",
            "quantity": 20,
            "minimum_threshold": 5,
            "reorder_quantity": 15,
            "unit": "unit",
            "location": "Lab A, Shelf 1",
        }, headers={"Authorization": f"Bearer {staff_token}"})
        assert resp.status_code == 201
        data = resp.json()
        assert data["item_name"] == "Test Beaker"
        assert data["sku"] is not None
        return data["id"]

    @pytest.mark.asyncio
    async def test_list_items(self, client, staff_token):
        # Create first
        await client.post("/api/inventory/", json={
            "item_name": "Flask", "category": "equipment",
            "quantity": 10, "minimum_threshold": 3, "reorder_quantity": 10,
        }, headers={"Authorization": f"Bearer {staff_token}"})

        resp = await client.get("/api/inventory/", headers={"Authorization": f"Bearer {staff_token}"})
        assert resp.status_code == 200
        assert resp.json()["total"] >= 1

    @pytest.mark.asyncio
    async def test_create_requires_staff(self, client, client_as_student=None):
        # Register student
        await client.post("/api/auth/register", json={
            "email": "stu@test.com", "full_name": "Stu",
            "password": "Stu@12345", "role": "student",
        })
        resp_login = await client.post("/api/auth/login", json={
            "email": "stu@test.com", "password": "Stu@12345",
        })
        student_token = resp_login.json()["access_token"]

        resp = await client.post("/api/inventory/", json={
            "item_name": "Unauthorized", "category": "book",
            "quantity": 1, "minimum_threshold": 1, "reorder_quantity": 1,
        }, headers={"Authorization": f"Bearer {student_token}"})
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_update_item(self, client, staff_token):
        create = await client.post("/api/inventory/", json={
            "item_name": "Old Name", "category": "consumable",
            "quantity": 5, "minimum_threshold": 2, "reorder_quantity": 10,
        }, headers={"Authorization": f"Bearer {staff_token}"})
        item_id = create.json()["id"]

        resp = await client.patch(f"/api/inventory/{item_id}", json={
            "item_name": "New Name", "quantity": 15,
        }, headers={"Authorization": f"Bearer {staff_token}"})
        assert resp.status_code == 200
        assert resp.json()["item_name"] == "New Name"
        assert resp.json()["quantity"] == 15

    @pytest.mark.asyncio
    async def test_log_usage(self, client, staff_token):
        create = await client.post("/api/inventory/", json={
            "item_name": "Chemical X", "category": "chemical",
            "quantity": 50, "minimum_threshold": 5, "reorder_quantity": 20,
        }, headers={"Authorization": f"Bearer {staff_token}"})
        item_id = create.json()["id"]

        resp = await client.post(f"/api/inventory/{item_id}/usage", json={
            "quantity_change": -10,
            "action": "checkout",
            "department": "Chemistry",
        }, headers={"Authorization": f"Bearer {staff_token}"})
        assert resp.status_code == 200
        assert resp.json()["quantity_after"] == 40

    @pytest.mark.asyncio
    async def test_log_usage_insufficient_stock(self, client, staff_token):
        create = await client.post("/api/inventory/", json={
            "item_name": "Scarce Item", "category": "consumable",
            "quantity": 3, "minimum_threshold": 1, "reorder_quantity": 10,
        }, headers={"Authorization": f"Bearer {staff_token}"})
        item_id = create.json()["id"]

        resp = await client.post(f"/api/inventory/{item_id}/usage", json={
            "quantity_change": -100,
            "action": "checkout",
        }, headers={"Authorization": f"Bearer {staff_token}"})
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_search_items(self, client, staff_token):
        await client.post("/api/inventory/", json={
            "item_name": "Unique Oscilloscope", "category": "electronic",
            "quantity": 2, "minimum_threshold": 1, "reorder_quantity": 3,
        }, headers={"Authorization": f"Bearer {staff_token}"})

        resp = await client.get(
            "/api/inventory/?search=Oscilloscope",
            headers={"Authorization": f"Bearer {staff_token}"}
        )
        assert resp.status_code == 200
        assert resp.json()["total"] >= 1


# ─── Analytics Tests ──────────────────────────────────────────────────────────
class TestAnalytics:
    @pytest.mark.asyncio
    async def test_dashboard_stats(self, client, admin_token):
        resp = await client.get("/api/analytics/dashboard",
                                headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert "total_items" in data
        assert "low_stock_count" in data
        assert "active_alerts" in data

    @pytest.mark.asyncio
    async def test_monthly_consumption(self, client, staff_token):
        resp = await client.get("/api/analytics/consumption/monthly?months=3",
                                headers={"Authorization": f"Bearer {staff_token}"})
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)


# ─── Procurement Tests ────────────────────────────────────────────────────────
class TestProcurement:
    @pytest.mark.asyncio
    async def test_auto_suggest(self, client, staff_token):
        # Create a low-stock item
        await client.post("/api/inventory/", json={
            "item_name": "Low Item", "category": "consumable",
            "quantity": 2, "minimum_threshold": 10, "reorder_quantity": 50,
        }, headers={"Authorization": f"Bearer {staff_token}"})

        resp = await client.post("/api/procurement/auto-suggest",
                                 headers={"Authorization": f"Bearer {staff_token}"})
        assert resp.status_code == 200
        assert resp.json()["created"] >= 1

    @pytest.mark.asyncio
    async def test_create_procurement_order(self, client, staff_token):
        item = await client.post("/api/inventory/", json={
            "item_name": "Order Me", "category": "book",
            "quantity": 5, "minimum_threshold": 10, "reorder_quantity": 20,
        }, headers={"Authorization": f"Bearer {staff_token}"})
        item_id = item.json()["id"]

        resp = await client.post("/api/procurement/", json={
            "item_id": item_id,
            "quantity": 25,
            "reason": "Manual restock test",
        }, headers={"Authorization": f"Bearer {staff_token}"})
        assert resp.status_code == 201
        assert resp.json()["status"] == "suggested"


# ─── ML Forecaster Tests ──────────────────────────────────────────────────────
class TestForecaster:
    def test_insufficient_data(self):
        from app.ml.forecaster import InventoryForecaster
        fc = InventoryForecaster()
        result = fc.forecast(
            item_id="test-1",
            current_quantity=20,
            usage_history=[],
            minimum_threshold=5,
        )
        assert result.model_used == "insufficient_data"
        assert result.confidence_score == 0.0

    def test_linear_forecast_with_data(self):
        from app.ml.forecaster import InventoryForecaster
        from datetime import date, timedelta

        fc = InventoryForecaster(forecast_horizon_days=7)
        history = [
            {"date": date.today() - timedelta(days=i), "quantity_consumed": 3}
            for i in range(1, 10)
        ]
        result = fc.forecast(
            item_id="test-2",
            current_quantity=30,
            usage_history=history,
            minimum_threshold=5,
            reorder_quantity=50,
            lead_time_days=7,
        )
        assert result.daily_consumption_rate > 0
        assert result.recommended_restock_qty > 0
        assert len(result.forecast_data) > 0

    def test_stockout_calculation(self):
        from app.ml.forecaster import InventoryForecaster
        fc = InventoryForecaster()
        date, days = fc._calculate_stockout(
            current_qty=10,
            daily_consumption=[3, 3, 3, 3],
            threshold=0,
            lead_time=3,
        )
        assert days is not None
        assert days <= 4

    def test_academic_cycle_weights(self):
        from app.ml.forecaster import ACADEMIC_DEMAND_CYCLE
        # September should have highest weight
        assert ACADEMIC_DEMAND_CYCLE[9] >= max(
            v for k, v in ACADEMIC_DEMAND_CYCLE.items() if k != 9
        )
        # All weights should be positive
        assert all(v > 0 for v in ACADEMIC_DEMAND_CYCLE.values())

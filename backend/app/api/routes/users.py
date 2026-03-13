from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.models.models import User, UserRole
from app.schemas.schemas import UserOut, UserUpdate
from app.services.auth_service import get_current_user, require_role

router = APIRouter()


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserOut)
async def update_me(
    payload: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    for key, value in payload.model_dump(exclude_none=True).items():
        if key == "role":
            continue  # Can't self-promote
        setattr(current_user, key, value)
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.get("/", response_model=list[UserOut])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.admin])),
):
    result = await db.execute(select(User))
    return result.scalars().all()


@router.patch("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: str,
    payload: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.admin])),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(user, key, value)
    await db.commit()
    await db.refresh(user)
    return user

from fastapi import APIRouter, Depends, HTTPException, Response

from lib.auth import clear_session, current_user, set_session, verify_password
from lib.db import db
from models.schemas import LoginIn, Me

router = APIRouter(prefix="/auth", tags=["auth"])


def _me(u: dict) -> Me:
    return Me(id=u["id"], email=u["email"], name=u["name"], role=u["role"], barber_id=u.get("barber_id"))


@router.post("/login", response_model=Me)
async def login(body: LoginIn, response: Response):
    user = await db.users.find_one({"email": body.email.lower()}, {"_id": 0})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "E-mail ou senha incorretos")
    set_session(response, user["id"])
    return _me(user)


@router.post("/logout", status_code=204)
async def logout():
    res = Response(status_code=204)
    clear_session(res)
    return res


@router.get("/me", response_model=Me)
async def me(user: dict = Depends(current_user)):
    return _me(user)

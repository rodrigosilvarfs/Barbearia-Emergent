"""Session auth (httpOnly JWT cookie) + RBAC dependencies. Principal is re-read from the DB on every request."""

import os
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, Request, Response
from passlib.context import CryptContext

from lib.db import db

COOKIE = "rpg_session"
JWT_SECRET = os.environ["JWT_SECRET"]
TTL = timedelta(days=7)
pwd = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def hash_password(p: str) -> str:
    return pwd.hash(p)


def verify_password(p: str, h: str) -> bool:
    try:
        return pwd.verify(p, h)
    except Exception:
        return False


def set_session(response: Response, user_id: str) -> None:
    token = jwt.encode({"sub": user_id, "exp": datetime.now(timezone.utc) + TTL}, JWT_SECRET, algorithm="HS256")
    response.set_cookie(COOKIE, token, httponly=True, secure=True, samesite="lax", max_age=int(TTL.total_seconds()), path="/")


def clear_session(response: Response) -> None:
    response.delete_cookie(COOKIE, path="/", secure=True, samesite="lax", httponly=True)


async def current_user(request: Request) -> dict:
    token = request.cookies.get(COOKIE)
    if not token:
        raise HTTPException(401, "Não autenticado")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "Sessão inválida")
    user = await db.users.find_one({"id": payload.get("sub")}, {"_id": 0})
    if not user:
        raise HTTPException(401, "Sessão inválida")
    return user


def require_role(role: str):
    async def dep(user: dict = Depends(current_user)) -> dict:
        if user.get("role") != role:
            raise HTTPException(403, "Acesso negado")
        if role == "barber" and not user.get("barber_id"):
            raise HTTPException(403, "Acesso negado")
        return user

    return dep


require_admin = require_role("admin")
require_barber = require_role("barber")

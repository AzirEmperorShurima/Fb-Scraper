from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from app import crud, database, schemas
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/config/fb-accounts", tags=["config"])

@router.post("", response_model=schemas.FBAccountResponse)
async def create_account(
    account: schemas.FBAccountCreate,
    db=Depends(database.get_db),
    current_user=Depends(get_current_user)
):
    db_account = await crud.get_fb_account_by_email(db, email=account.email)
    if db_account:
        update_payload = schemas.FBAccountUpdate(
            email=account.email,
            password=account.password,
            cookies_json=account.cookies_json,
            status=account.status
        )
        updated = await crud.update_fb_account(db, db_account, update_payload)
        return crud.serialize_fb_account(updated)
    created = await crud.create_fb_account(db=db, account=account)
    return crud.serialize_fb_account(created)

@router.get("", response_model=List[schemas.FBAccountResponse])
async def get_accounts(
    db=Depends(database.get_db),
    current_user=Depends(get_current_user)
):
    return [crud.serialize_fb_account(account) for account in await crud.get_fb_accounts(db)]

@router.get("/{account_id}", response_model=schemas.FBAccountResponse)
async def get_account(
    account_id: str,
    db=Depends(database.get_db),
    current_user=Depends(get_current_user)
):
    db_account = await crud.get_fb_account_by_id(db, account_id)
    if not db_account:
        raise HTTPException(status_code=404, detail="Account not found")
    return crud.serialize_fb_account(db_account)

@router.patch("/{account_id}", response_model=schemas.FBAccountResponse)
async def update_account(
    account_id: str,
    payload: schemas.FBAccountUpdate,
    db=Depends(database.get_db),
    current_user=Depends(get_current_user)
):
    db_account = await crud.get_fb_account_by_id(db, account_id)
    if not db_account:
        raise HTTPException(status_code=404, detail="Account not found")
    updated = await crud.update_fb_account(db, db_account, payload)
    return crud.serialize_fb_account(updated)

@router.delete("/{account_id}")
async def delete_account(
    account_id: str,
    db=Depends(database.get_db),
    current_user=Depends(get_current_user)
):
    success = await crud.delete_fb_account(db, account_id)
    if not success:
        raise HTTPException(status_code=404, detail="Account not found")
    return {"message": "Account deleted successfully"}


@router.post("/proxy-endpoints", response_model=schemas.ProxyEndpointResponse, status_code=status.HTTP_201_CREATED)
async def create_proxy_endpoint(
    payload: schemas.ProxyEndpointCreate,
    db=Depends(database.get_db),
    current_user=Depends(get_current_user)
):
    existing = await crud.get_proxy_endpoint_by_url(db, payload.proxy_url)
    if existing:
        update_payload = schemas.ProxyEndpointUpdate(
            name=payload.name,
            proxy_url=payload.proxy_url,
            status=payload.status,
        )
        updated = await crud.update_proxy_endpoint(db, existing, update_payload)
        return crud.serialize_proxy_endpoint(updated)
    created = await crud.create_proxy_endpoint(db, payload)
    return crud.serialize_proxy_endpoint(created)


@router.get("/proxy-endpoints", response_model=List[schemas.ProxyEndpointResponse])
async def list_proxy_endpoints(
    db=Depends(database.get_db),
    current_user=Depends(get_current_user)
):
    return [crud.serialize_proxy_endpoint(proxy) for proxy in await crud.get_proxy_endpoints(db)]


@router.get("/proxy-endpoints/{proxy_id}", response_model=schemas.ProxyEndpointResponse)
async def get_proxy_endpoint(
    proxy_id: str,
    db=Depends(database.get_db),
    current_user=Depends(get_current_user)
):
    proxy = await crud.get_proxy_endpoint_by_id(db, proxy_id)
    if not proxy:
        raise HTTPException(status_code=404, detail="Proxy endpoint not found")
    return crud.serialize_proxy_endpoint(proxy)


@router.patch("/proxy-endpoints/{proxy_id}", response_model=schemas.ProxyEndpointResponse)
async def update_proxy_endpoint(
    proxy_id: str,
    payload: schemas.ProxyEndpointUpdate,
    db=Depends(database.get_db),
    current_user=Depends(get_current_user)
):
    proxy = await crud.get_proxy_endpoint_by_id(db, proxy_id)
    if not proxy:
        raise HTTPException(status_code=404, detail="Proxy endpoint not found")
    updated = await crud.update_proxy_endpoint(db, proxy, payload)
    return crud.serialize_proxy_endpoint(updated)


@router.delete("/proxy-endpoints/{proxy_id}")
async def delete_proxy_endpoint(
    proxy_id: str,
    db=Depends(database.get_db),
    current_user=Depends(get_current_user)
):
    success = await crud.delete_proxy_endpoint(db, proxy_id)
    if not success:
        raise HTTPException(status_code=404, detail="Proxy endpoint not found")
    return {"message": "Proxy endpoint deleted successfully"}

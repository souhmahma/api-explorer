from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import httpx
import json

app = FastAPI(title="API Explorer Proxy", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": "API Explorer Proxy is running", "version": "1.0.0"}


@app.api_route("/proxy", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def proxy(request: Request):
    body = await request.body()

    try:
        params = dict(request.query_params)
        target_url = params.pop("__url", None)
        auth_header = params.pop("__auth", None)
        auth_type = params.pop("__auth_type", "Bearer")

        if not target_url:
            raise HTTPException(status_code=400, detail="Missing __url query parameter")

        headers = {}
        for key, value in request.headers.items():
            if key.lower() not in ("host", "content-length", "connection"):
                headers[key] = value

        if auth_header:
            headers["Authorization"] = f"{auth_type} {auth_header}"

        headers.pop("__url", None)
        headers.pop("__auth", None)
        headers.pop("__auth_type", None)

        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            response = await client.request(
                method=request.method,
                url=target_url,
                headers=headers,
                params=params if params else None,
                content=body if body else None,
            )

        try:
            response_body = response.json()
        except Exception:
            response_body = response.text

        return JSONResponse(
            content={
                "status_code": response.status_code,
                "headers": dict(response.headers),
                "body": response_body,
                "url": str(response.url),
                "elapsed_ms": round(response.elapsed.total_seconds() * 1000, 2),
            }
        )

    except httpx.ConnectError:
        raise HTTPException(status_code=502, detail="Could not connect to target URL")
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Request to target URL timed out")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import httpx
import json
import gzip
import zlib

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

        if not target_url:
            raise HTTPException(status_code=400, detail="Missing __url query parameter")

        # Forward all headers except internal/hop-by-hop ones
        SKIP_HEADERS = ("host", "content-length", "connection", "accept-encoding")
        headers = {
            k: v for k, v in request.headers.items()
            if k.lower() not in SKIP_HEADERS
        }

        # Force plain text — no compression
        headers["Accept-Encoding"] = "identity"

        # Auth is now sent directly in headers by the frontend — nothing to inject

        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            response = await client.request(
                method=request.method,
                url=target_url,
                headers=headers,
                params=params if params else None,
                content=body if body else None,
            )

        # Decompress if server ignored our identity request
        raw = response.content
        encoding = response.headers.get("content-encoding", "")
        try:
            if encoding == "gzip":
                raw = gzip.decompress(raw)
            elif encoding in ("deflate", "zlib"):
                raw = zlib.decompress(raw)
            elif encoding == "br":
                import brotli
                raw = brotli.decompress(raw)
        except Exception:
            pass

        try:
            response_body = json.loads(raw)
        except Exception:
            try:
                response_body = raw.decode("utf-8")
            except Exception:
                response_body = raw.decode("latin-1")

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
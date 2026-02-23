from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.config import utc_to_kst
from app.routers import agents, live, overview, pixel_office, projects, sessions, tasks, teams, tokens, tools

app = FastAPI(title="Claude Dashboard", version="1.0.0", docs_url=None, redoc_url=None)

app.mount("/static", StaticFiles(directory="static"), name="static")

app.include_router(overview.router)
app.include_router(sessions.router)
app.include_router(live.router)
app.include_router(tokens.router)
app.include_router(tools.router)
app.include_router(projects.router)
app.include_router(tasks.router)
app.include_router(agents.router)
app.include_router(teams.router)
app.include_router(pixel_office.router)

for router_mod in (overview, sessions, live, tokens, tools, projects, tasks, agents, teams, pixel_office):
    router_mod.templates.env.filters["kst"] = utc_to_kst

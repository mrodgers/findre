FROM python:3.11-slim

WORKDIR /app

RUN pip install uv

COPY pyproject.toml .
COPY uv.lock* .

RUN uv sync --frozen --no-dev 2>/dev/null || uv sync --no-dev

COPY . .

ENV PORT=8000
EXPOSE 8000

CMD ["uv", "run", "python", "main.py"]

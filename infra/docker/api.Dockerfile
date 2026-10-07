FROM python:3.12-slim
ARG PIP_INDEX_URL=https://pypi.org/simple
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip==26.2.1 && pip install --no-cache-dir -r requirements.txt && useradd --uid 10001 --create-home baxi
COPY shared ./shared
COPY backend/baxi ./backend/baxi
COPY backend/scripts ./backend/scripts
COPY assets ./assets
RUN mkdir -p data/uploads && chown -R baxi:baxi /app
USER baxi
EXPOSE 8000
CMD ["python", "backend/scripts/start_api.py"]

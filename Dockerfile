# Stage 1: Build Angular
FROM node:22-slim AS angular-build

WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npx ng build --output-path=dist --base-href=/

# Stage 2: Python backend
FROM python:3.12

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

# Copy Angular browser output flat into static/
COPY --from=angular-build /frontend/dist/browser/ ./static/

RUN mkdir -p /data/uploads

EXPOSE 8000

CMD python -m uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}

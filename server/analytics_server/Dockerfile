FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV DATA_DIR=/data
RUN mkdir -p /data
EXPOSE 8090
# Longer timeout: /v1/media/parse may call yt-dlp / Cobalt.
CMD ["gunicorn", "-b", "0.0.0.0:8090", "-w", "2", "--timeout", "180", "app:APP"]

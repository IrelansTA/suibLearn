FROM python:3.11-slim

WORKDIR /app

# No extra system dependencies needed
# (ffmpeg can be installed later if MKV remux support is needed)

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt -i https://mirrors.aliyun.com/pypi/simple/ --trusted-host mirrors.aliyun.com

# Copy application code
COPY . .

# Create data and media directories
RUN mkdir -p /app/data /data/sublearn/media

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
FROM python:3.12-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libkrb5-3 libgssapi-krb5-2 libsasl2-2 libldap2 libcurl4 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /app/data /app/pbm-bins

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

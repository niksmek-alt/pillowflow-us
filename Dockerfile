FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PILLOWFLOW_HOST=0.0.0.0 \
    PILLOWFLOW_PORT=8000 \
    PILLOWFLOW_REFERRALS_DB=/data/referrals.db \
    PILLOWFLOW_LANDING_PAGE=/referral.html

WORKDIR /app
COPY . /app
RUN mkdir -p /data

VOLUME ["/data"]
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "from urllib.request import urlopen; urlopen('http://127.0.0.1:8000/healthz', timeout=3)"

CMD ["python", "referral_server.py"]

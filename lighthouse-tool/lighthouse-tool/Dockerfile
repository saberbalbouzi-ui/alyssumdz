FROM node:22-bookworm-slim

# Chromium + خطوط تدعم العربية (بدونها يظهر النص مربعات في لقطات الشاشة)
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium dumb-init ca-certificates \
      fonts-noto-core fonts-noto-ui-core fonts-freefont-ttf fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    CHROME_PATH=/usr/bin/chromium \
    PORT=3000

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force
COPY src ./src

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.mjs"]

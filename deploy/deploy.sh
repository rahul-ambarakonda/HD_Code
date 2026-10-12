#!/bin/sh
set -eu

IP=$1
KEY=$2

# 1. rsync the repository
echo "🚀 Deploying to $IP..."
rsync -avz --exclude 'node_modules/' --exclude '.git/' --exclude 'data/' -e "ssh -i $KEY" . "ec2-user@$IP:~/beacon"

# 2. ssh into instance and run docker compose
echo "🏗️ Building and starting containers..."
ssh -i "$KEY" "ec2-user@$IP" "cd ~/beacon && docker compose -f deploy/docker-compose.yaml up -d --build"

# 3. Copy nginx.conf and reload nginx
echo "⚙️ Updating nginx configuration..."
ssh -i "$KEY" "ec2-user@$IP" "sudo cp ~/beacon/deploy/nginx.conf /etc/nginx/conf.d/beacon.conf && sudo systemctl reload nginx"

# 4. Poll healthz endpoint
echo "💖 Waiting for health check to pass..."
for i in $(seq 1 60); do
  STATUS=$(curl -s -o /dev/null -w '%{http_code}' "http://$IP/healthz")
  if [ "$STATUS" -eq 200 ]; then
    echo "✅ Health check passed."
    exit 0
  fi
  printf "."
  sleep 1
done

echo "❌ Health check failed after 60 seconds."
exit 1
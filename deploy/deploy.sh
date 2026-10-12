#!/bin/sh
set -eu

IP="$1"
KEY_PATH="$2"

# 1. rsync the repository to ec2-user@$IP:~/beacon, excluding node_modules, .git and data.
echo "--> Deploying to $IP: syncing files..."
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'data' -e "ssh -i \"$KEY_PATH\"" . "ec2-user@$IP:~/beacon"

# 2. ssh into instance and run docker compose -f deploy/docker-compose.yaml up -d --build.
echo "--> Building and running containers on $IP..."
ssh -i "$KEY_PATH" "ec2-user@$IP" << EOF
  cd ~/beacon
  docker compose -f deploy/docker-compose.yaml up -d --build
EOF

# 3. Copy deploy/nginx.conf into /etc/nginx/conf.d/ and systemctl reload nginx.
echo "--> Updating nginx configuration on $IP..."
ssh -i "$KEY_PATH" "ec2-user@$IP" << EOF
  sudo cp ~/beacon/deploy/nginx.conf /etc/nginx/conf.d/beacon.conf
  sudo systemctl reload nginx
EOF

# 4. Poll http://$IP/healthz for up to 60 seconds and fail if not 200.
echo "--> Polling health endpoint on $IP..."
for i in $(seq 1 20); do
  if curl -sS "http://$IP/healthz" | grep -q '"status":"ok"'; then
    echo "--> Health check passed after $((i * 3)) seconds."
    exit 0
  fi
  sleep 3
done

echo "Error: Health check failed after 60 seconds."
exit 1
#!/bin/sh
set -eu

IP=$1
KEY=$2

echo "--- Deploying to $IP ---"

echo "1. Syncing repository..."
rsync -avz --exclude 'node_modules/' --exclude '.git/' --exclude 'data/' -e "ssh -i $KEY" . "ec2-user@$IP:~/beacon"

echo "2. Building and starting Docker containers..."
ssh -i "$KEY" "ec2-user@$IP" "cd ~/beacon && docker compose -f deploy/docker-compose.yaml up -d --build"

echo "3. Copying nginx config and reloading..."
ssh -i "$KEY" "ec2-user@$IP" "sudo cp ~/beacon/deploy/nginx.conf /etc/nginx/conf.d/beacon.conf && sudo systemctl reload nginx"

echo "4. Polling health endpoint..."
TIMEOUT=60
COUNT=0
while [ $COUNT -lt $TIMEOUT ]; do
    if curl -sSf "http://$IP/healthz" > /dev/null; then
        echo "Health check passed."
        echo "Deployment successful!"
        exit 0
    fi
    sleep 1
    COUNT=$((COUNT + 1))
done

echo "Error: Health check failed after $TIMEOUT seconds."
exit 1
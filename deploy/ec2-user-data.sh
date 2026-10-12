#!/bin/sh
set -eu
dnf -y update
dnf -y install docker nginx git
systemctl enable --now docker
systemctl enable --now nginx
usermod -aG docker ec2-user
DOCKER_CFG=/usr/local/lib/docker/cli-plugins
mkdir -p "$DOCKER_CFG"
curl -sSL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-aarch64 \
  -o "$DOCKER_CFG/docker-compose"
chmod +x "$DOCKER_CFG/docker-compose"
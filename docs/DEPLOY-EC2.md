# Deploying Beacon to a Single EC2 Instance

This runbook details the process of deploying the Beacon pre-launch marketing site to a single AWS EC2 instance. The deployment uses Docker Compose to manage the application container and Nginx as a reverse proxy.

## 1. AWS EC2 Instance Setup

### Instance Configuration
*   **Type**: `t4g.micro` (ARM64 Graviton processor)
*   **AMI**: Latest Amazon Linux 2023 ARM64
*   **Storage**: 8 GB gp3 SSD
*   **Region**: `ap-south-1`
*   **Elastic IP**: Attach an Elastic IP to ensure the public IP address remains constant across stop/starts.

### Security Group Rules

Create a security group with the following inbound rules:

*   **HTTP (Port 80)**:
    *   Type: HTTP
    *   Protocol: TCP
    *   Port range: 80
    *   Source: `0.0.0.0/0` (Allows access from anywhere)
*   **SSH (Port 22)**:
    *   Type: SSH
    *   Protocol: TCP
    *   Port range: 22
    *   Source: Your administrative IP address (e.g., `XXX.XXX.XXX.XXX/32`)

Outbound rules should allow all traffic.

### Launching the Instance (CLI Example)

```bash
aws ec2 run-instances \
  --image-id resolve:ssm:/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-6.1-arm64 \
  --instance-type t4g.micro \
  --key-name your-ssh-key-pair-name \
  --security-group-ids sg-xxxxxxxxxxxxxxxxx \
  --subnet-id subnet-xxxxxxxxxxxxxxxxx \
  --user-data file://deploy/ec2-user-data.sh \
  --associate-public-ip-address \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=beacon-web-01}]'
```

**Note:** Replace `your-ssh-key-pair-name`, `sg-xxxxxxxxxxxxxxxxx`, and `subnet-xxxxxxxxxxxxxxxxx` with your actual values.

## 2. Initial Instance Bootstrap (`ec2-user-data.sh`)

The `deploy/ec2-user-data.sh` script is executed once when the instance is launched. It performs the following setup:

*   Updates system packages.
*   Installs Docker, Nginx, and Git.
*   Enables and starts Docker and Nginx services.
*   Adds the `ec2-user` to the `docker` group.
*   Downloads and installs `docker-compose` for ARM64 architecture.

This script is idempotent and safe to re-run.

## 3. Deployment Process (`deploy.sh`)

The `deploy/deploy.sh` script is run from your local developer machine. It takes the instance's public IP and your SSH key path as arguments.

```bash
bash deploy/deploy.sh <instance-public-ip> <path-to-your-ssh-key.pem>
```

**Steps performed by `deploy.sh`:**

1.  **Rsync Repository**: Copies the local repository to `~/beacon` on the EC2 instance, excluding `node_modules`, `.git`, and `data` directories.
2.  **Docker Compose Up**: Connects via SSH to the instance, navigates to `~/beacon`, and runs `docker compose -f deploy/docker-compose.yaml up -d --build`. This builds the Docker image and starts the container in detached mode.
3.  **Update Nginx Config**: Copies `deploy/nginx.conf` to `/etc/nginx/conf.d/beacon.conf` on the instance and reloads Nginx to apply the new configuration.
4.  **Health Check Poll**: Polls `http://<instance-public-ip>/healthz` for up to 60 seconds. The script fails loudly if the health endpoint does not return a 200 OK status with `{"status":"ok"}`.

## 4. Operations Commands

Once deployed, you can manage the application on the EC2 instance using SSH and Docker Compose.

*   **View Application Logs (tail -f):**
    ```bash
    ssh -i <key-path> ec2-user@<instance-public-ip> \
      "docker compose -f ~/beacon/deploy/docker-compose.yaml logs -f web"
    ```

*   **Restart the Application Container:**
    ```bash
    ssh -i <key-path> ec2-user@<instance-public-ip> \
      "docker compose -f ~/beacon/deploy/docker-compose.yaml restart web"
    ```

*   **Read the Waitlist Data (from named Docker volume):**
    ```bash
    ssh -i <key-path> ec2-user@<instance-public-ip> \
      "docker run --rm -v beacon_waitlist_data:/d alpine cat /d/waitlist.json"
    ```

## 5. Rollback

To rollback to a previous version, checkout the desired commit on your local machine and re-run the `deploy.sh` script:

```bash
git checkout <previous-sha>
bash deploy/deploy.sh <instance-public-ip> <path-to-your-ssh-key.pem>
```

**Note:** This deployment strategy involves a brief period of downtime (2-3 seconds) during redeployments, which is acceptable for a pre-launch marketing page.
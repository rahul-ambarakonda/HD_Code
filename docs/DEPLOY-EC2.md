# Deploying Beacon to EC2

This document outlines the steps to deploy the Beacon marketing site to a single EC2 instance.

## 1. Instance Setup

### Instance Type and AMI

*   **Type**: `t4g.micro` (ARM64 Graviton processor)
*   **AMI**: Latest Amazon Linux 2023 ARM64

### Storage

*   8 GB gp3

### Region

*   `ap-south-1`

### Security Group Rules

Create a new security group with the following inbound rules:

| Type   | Protocol | Port Range | Source          |
| :----- | :------- | :--------- | :-------------- |
| HTTP   | TCP      | 80         | `0.0.0.0/0`     |
| SSH    | TCP      | 22         | `YOUR_ADMIN_IP` |

All outbound traffic is permitted.

### Elastic IP

Allocate and associate an Elastic IP with your EC2 instance to ensure its public IP address remains constant across stop/start cycles.

### `aws ec2 run-instances` Invocation Example

```bash
aws ec2 run-instances \
  --image-id resolve:ssm:/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-6.1-arm64 \
  --instance-type t4g.micro \
  --key-name your-ssh-key-name \
  --security-group-ids sg-xxxxxxxxxxxxxxxxx \
  --subnet-id subnet-xxxxxxxxxxxxxxxxx \
  --user-data file://deploy/ec2-user-data.sh \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=beacon-web}]'
```

Remember to replace `your-ssh-key-name`, `sg-xxxxxxxxxxxxxxxxx`, and `subnet-xxxxxxxxxxxxxxxxx` with your actual values.

## 2. Initial Bootstrap

The `deploy/ec2-user-data.sh` script is executed automatically on first boot. This script performs the following:

*   Updates system packages.
*   Installs Docker, Nginx, and Git.
*   Enables and starts Docker and Nginx services.
*   Adds the `ec2-user` to the `docker` group.
*   Downloads and installs Docker Compose (for ARM64).

Verify these services are running:

```bash
ssh -i /path/to/your/key.pem ec2-user@YOUR_EC2_IP "systemctl status docker && systemctl status nginx"
```

## 3. Deployment

To deploy the application, run the `deploy/deploy.sh` script from your local machine. This script will:

1.  `rsync` the repository content (excluding `node_modules`, `.git`, and `data`) to the EC2 instance.
2.  SSH into the instance and build/start the Docker containers using `docker compose`.
3.  Copy the `nginx.conf` file to the Nginx configuration directory on the instance and reload Nginx.
4.  Poll the `/healthz` endpoint for up to 60 seconds to confirm the application is healthy.

```bash
bash deploy/deploy.sh YOUR_EC2_IP /path/to/your/key.pem
```

## 4. Operations

### Viewing Application Logs

To view the application logs:

```bash
ssh -i /path/to/your/key.pem ec2-user@YOUR_EC2_IP "cd ~/beacon && docker compose -f deploy/docker-compose.yaml logs -f web"
```

### Restarting the Application

To restart the `web` service:

```bash
ssh -i /path/to/your/key.pem ec2-user@YOUR_EC2_IP "cd ~/beacon && docker compose -f deploy/docker-compose.yaml restart web"
```

### Reading the Waitlist Data

The waitlist data is stored in a named Docker volume. To read the `waitlist.json` file:

```bash
ssh -i /path/to/your/key.pem ec2-user@YOUR_EC2_IP "docker run --rm -v beacon_waitlist_data:/d alpine cat /d/waitlist.json"
```

### Rollback

To rollback to a previous version, checkout the desired commit on your local machine and re-run the `deploy/deploy.sh` script:

```bash
git checkout <previous-sha>
bash deploy/deploy.sh YOUR_EC2_IP /path/to/your/key.pem
```
# Deploying Beacon to a single EC2 instance

This document describes how to deploy the Beacon marketing site to a single AWS EC2 instance. The process involves setting up the EC2 instance, configuring Docker and Nginx, and deploying the application container.

## 1. EC2 Instance Setup

### Instance Details

*   **Type**: `t4g.micro` (ARM64 Graviton) - ensures compatibility with `node:22-alpine` multi-arch image.
*   **AMI**: Latest Amazon Linux 2023 ARM64.
*   **Storage**: 8 GB gp3.
*   **Region**: `ap-south-1` (Mumbai).
*   **Elastic IP**: Attach an Elastic IP to the instance so its public IP address remains constant across stop/starts.

### Security Group Rules

Create a security group with the following inbound rules:

*   **Type**: HTTP (Port 80)
    *   **Source**: Anywhere (`0.0.0.0/0`)
    *   **Description**: Allow public access to the Nginx web server.
*   **Type**: SSH (Port 22)
    *   **Source**: Your administrative IP address (e.g., `your.ip.address/32`)
    *   **Description**: Allow secure shell access from your machine only.

### Launching the Instance

Use the AWS CLI to launch the instance. Replace `YOUR_KEY_PAIR_NAME` and `YOUR_SECURITY_GROUP_ID` with your actual values.

```bash
aws ec2 run-instances \
  --image-id resolve:ssm:/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-6.1-arm64 \
  --instance-type t4g.micro \
  --key-name YOUR_KEY_PAIR_NAME \
  --security-group-ids YOUR_SECURITY_GROUP_ID \
  --block-device-mappings '[{"DeviceName":"/dev/xvda","Ebs":{"VolumeSize":8,"VolumeType":"gp3"}}]' \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=beacon-marketing-site}]' \
  --user-data file://deploy/ec2-user-data.sh \
  --region ap-south-1
```

Attach an Elastic IP to this instance after it's launched.

## 2. Initial Instance Bootstrap

The `deploy/ec2-user-data.sh` script (provided during instance launch) will automatically:

*   Update the system packages.
*   Install Docker, Nginx, and Git.
*   Enable and start Docker and Nginx services.
*   Add the `ec2-user` to the `docker` group.
*   Download and install `docker-compose`.

This script is idempotent and can be safely re-run.

## 3. Deployment Steps

To deploy the application, run the `deploy/deploy.sh` script from your local machine. This script will:

1.  **Synchronize the repository**: `rsync` the local repository files (excluding `node_modules`, `.git`, and `data`) to `~/beacon` on the EC2 instance.
2.  **Build and Start Containers**: SSH into the instance and run `docker compose up -d --build` to build the Docker image and start the `web` service in detached mode.
3.  **Configure Nginx**: Copy the `deploy/nginx.conf` file to `/etc/nginx/conf.d/beacon.conf` on the instance and reload the Nginx service.
4.  **Health Check**: Poll the `/healthz` endpoint of the deployed application for up to 60 seconds, failing if a 200 status is not received.

Before running, ensure your SSH key (`YOUR_KEY_PATH`) has the correct permissions (`chmod 400 YOUR_KEY_PATH`).

```bash
bash deploy/deploy.sh YOUR_EC2_INSTANCE_IP YOUR_KEY_PATH
```

## 4. Operations

### Viewing Application Logs

To view the live application logs, SSH into the instance and run:

```bash
docker compose -f ~/beacon/deploy/docker-compose.yaml logs -f web
```

### Restarting the Application Container

To restart the Beacon application, SSH into the instance and run:

```bash
docker compose -f ~/beacon/deploy/docker-compose.yaml restart web
```

### Reading the Waitlist Data

The waitlist data is stored in a named Docker volume. To read its content, SSH into the instance and run:

```bash
docker run --rm -v beacon_waitlist_data:/d alpine cat /d/waitlist.json
```

### Rollback

To rollback to a previous version, checkout the desired commit on your local machine and re-run the `deploy/deploy.sh` script:

```bash
git checkout <previous-sha>
bash deploy/deploy.sh YOUR_EC2_INSTANCE_IP YOUR_KEY_PATH
```

**Note**: There is no zero-downtime deployment in v1. Redeployments will cause a brief service interruption (2-3 seconds).
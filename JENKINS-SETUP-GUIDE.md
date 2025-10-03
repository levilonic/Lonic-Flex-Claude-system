# Jenkins Setup Guide

## What is Jenkins?

Jenkins is a CI/CD automation server used for:
- Building and testing code automatically
- Running automated deployments
- Scheduling jobs and workflows

**Do you need it?** Only if you want CI/CD automation. Not required for LonicFLex core functionality.

---

## Option 1: Quick Docker Setup (Recommended - 5 minutes)

### Prerequisites
- Docker installed and running

### Steps

1. **Run Jenkins in Docker**:
```bash
docker run -d \
  --name jenkins \
  -p 8080:8080 -p 50000:50000 \
  -v jenkins_home:/var/jenkins_home \
  jenkins/jenkins:lts
```

2. **Get Initial Admin Password**:
```bash
docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

3. **Access Jenkins**:
- URL: http://localhost:8080
- Paste the initial admin password
- Click "Install suggested plugins"
- Wait 2-3 minutes for plugins to install

4. **Create Admin User**:
- Username: `admin` (or your choice)
- Password: (choose a password)
- Full name: Your name
- Email: `levi.lonic@gmail.com`

5. **Generate API Token**:
- Once logged in, click your name (top right)
- Click "Configure"
- Scroll to "API Token" section
- Click "Add new Token"
- Name: `LonicFLex`
- Click "Generate"
- **COPY THE TOKEN** (you can't see it again!)

6. **What to Give Me**:
- URL: `http://localhost:8080`
- Username: `admin` (or what you chose)
- API Token: (the generated token)

---

## Option 2: Download and Install (10 minutes)

### For Windows

1. **Download**:
   - Go to: https://www.jenkins.io/download/
   - Download Windows installer (.msi)

2. **Install**:
   - Run installer
   - Default port: 8080 (keep it)
   - Install as Windows service

3. **Follow steps 3-6 from Option 1** (Access Jenkins → Generate Token)

### For Mac

```bash
brew install jenkins-lts
brew services start jenkins-lts
```

Then follow steps 3-6 from Option 1.

### For Linux

```bash
# Ubuntu/Debian
wget -q -O - https://pkg.jenkins.io/debian-stable/jenkins.io.key | sudo apt-key add -
sudo sh -c 'echo deb http://pkg.jenkins.io/debian-stable binary/ > /etc/apt/sources.list.d/jenkins.list'
sudo apt update
sudo apt install jenkins
sudo systemctl start jenkins
```

Then follow steps 3-6 from Option 1.

---

## Option 3: Use Placeholder (Skip for Now)

If you don't need Jenkins or want to set it up later:

**I'll add these placeholders**:
- JENKINS_URL=http://localhost:8080
- JENKINS_USERNAME=admin
- JENKINS_API_TOKEN=placeholder_jenkins_token

You can update them later when you set up Jenkins.

---

## Troubleshooting

### Port 8080 already in use
```bash
# Check what's using port 8080
netstat -ano | findstr :8080

# Use different port for Jenkins
docker run -d -p 8081:8080 ... (change to 8081)
```

### Docker not running
```bash
# Windows/Mac: Start Docker Desktop
# Linux: sudo systemctl start docker
```

### Can't access http://localhost:8080
- Wait 2-3 minutes after starting Jenkins
- Check if Jenkins container is running: `docker ps`
- Check logs: `docker logs jenkins`

---

## Recommended Approach

**For now**: Use **Option 3 (Placeholder)** unless you specifically need Jenkins for CI/CD.

You can always set up Jenkins later and update the credentials.

**Start ServiceNow setup first** (it takes longer), then decide on Jenkins.

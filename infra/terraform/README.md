# AWS Infrastructure Provisioning (Terraform)

This section outlines the advanced deployment path utilizing HashiCorp Terraform for AWS infrastructure automation. 

> [!WARNING]
> **Prioritize Core Requirements**
> This path represents a bonus objective. Attempt this implementation only after the primary application functionality and standard deployment requirements are thoroughly validated. An incomplete automated deployment yields a lower evaluation score than a fully functional manual VM deployment.

## Architectural Minimum Viable Product (MVP)

To ensure the infrastructure remains easily reproducible within the strict 12-hour hackathon window, we strongly recommend adhering to this streamlined architectural blueprint:

```text
AWS VPC (Default Configuration)
 └─ EC2 (t3.small)
    │  - Installs Docker + Docker Compose via User Data
    │  - Clones this repository
    │  - Executes the production compose overlay
    ├─ Security Group
    │  - Port 80 (HTTP Traffic)
    │  - Port 22 (SSH Management, restricted to trusted IPs)
    │  - Port 9000 (Mock Gateway callback exposure)
    └─ Elastic IP
       - Associates a static IP to ensure webhook callback URLs survive instance reboots
```

This configuration is sufficient for the deployment grading criteria. Complex managed services (e.g., RDS, ElastiCache, Application Load Balancers) require significant provisioning overhead and do not inherently contribute to higher scores in this specific evaluation context.

## Terraform Project Structure

The automated provisioning relies on the following core files:

| File | Purpose |
| --- | --- |
| `main.tf` | Core resource definitions: VPC data lookup, EC2 instance provisioning, Security Group configuration, and Elastic IP association. |
| `variables.tf` | Input declarations: AWS region, instance specifications, SSH key pairs, and authorized CIDR blocks for administrative access. |
| `outputs.tf` | Post-apply exports: The provisioned Elastic IP and the formatted URL required for the main `README.md` submission. |
| `user-data.sh` | The bootstrap shell script executed on first boot to install dependencies, retrieve the source code, and initialize the Docker Compose stack. |
| `terraform.tfvars.example` | Template for environment-specific variables. (The actual `terraform.tfvars` must remain gitignored to prevent credential leakage). |

## Critical DevOps Guidelines

- **Ephemeral Environment**: The provisioned AWS account will be purged at the end of the hackathon. Under no circumstances should manual configurations be applied to the AWS console; everything must be defined in Code/Terraform.
- **Reproducible Bootstrapping**: The `user-data.sh` script is the cornerstone of reproducibility. It must fully automate the gap between raw infrastructure and a running application.
- **CI/CD Secrets**: If configuring automated deployments via GitHub Actions, ensure `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, and `DEPLOY_URL` are strictly configured as encrypted repository secrets.
- **State Security**: Never commit `.tfvars` files or Terraform state (`.tfstate`) to version control. Both are strictly excluded via `.gitignore`.

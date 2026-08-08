# AWS (bonus)

The harder path. Attempt it only when the required milestones are solid — a half-built bonus is
worth less than a finished requirement, and the Deployment criterion scores a Poridhi VM exactly
the same.

## Suggested minimum

Keep it small enough to rebuild from scratch inside the lab window.

```
VPC (default is fine)
 └─ EC2 t3.small           docker + compose, this repo, prod overlay
    ├─ security group      80 open, 22 from your IP, 9000 for the gateway
    └─ Elastic IP          so the callback URL survives a restart
```

That is genuinely enough. RDS, ElastiCache and ALB all cost setup time you may not get back, and
none of them earn a mark on their own.

## Files to add

| File | Purpose |
| --- | --- |
| `main.tf` | VPC lookup, EC2 instance, security group, Elastic IP |
| `variables.tf` | region, instance type, SSH key name, allowed SSH CIDR |
| `outputs.tf` | public IP and the URL to paste into README.md |
| `user-data.sh` | install docker, clone the repo, bring the prod overlay up |
| `terraform.tfvars.example` | committed; the real `.tfvars` is gitignored |

## Remember

- The AWS account dies with the lab. Do not put anything in it you cannot recreate from here.
- `user-data.sh` is the difference between "reproducible" and "I remember roughly what I typed".
- CD needs `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY` and `DEPLOY_URL` as GitHub secrets.
- Never commit `.tfvars` or state. Both are gitignored.

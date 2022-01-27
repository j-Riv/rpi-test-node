# Raspberry Pi Test Node
> Simple Node App that serves an image, with Kubernetes deployment.

### Access Kubernetes Dashboard from outside cluster
> SCP config file from master /etc/kubernetes/admin.conf
```bash
kubectl proxy --kubeconfig=admin.conf
```

[Kubernetes Dashboard](https://github.com/kubernetes/dashboard)

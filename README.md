# Raspberry Pi 4 Kubernetes Cluster
> Kubernetes Cluster with Simple NodeJS Kubernetes deployment.

#### Requirements
- At least 2 Raspberry Pi 4 boards, with some way to power each one. I will be using 4 in this example.
- A decent speed SD card per Pi.

### Ubuntu Server 20.04 LTS Installation
Flash each SD card with [Ubuntu Server 20.04 LTS](https://ubuntu.com/download/raspberry-pi) using something like [balenaEtcher](https://www.balena.io/etcher/).

#### Set Up
> You will prob want to give each pi a static ip to make it easier to reach. If you add static ips, you could create an ssh hosts file to make ssh even easier.
```bash
sudo nano ~/.ssh/config
```

```bash
# master
Host k8s-master
    HostName XXX.XXX.X.XXX
    User your-user
# worker
Host k8s-worker-01
    HostName XXX.XXX.X.XXX
    User your-user
# worker
Host k8s-worker-02
    HostName XXX.XXX.X.XXX
    User your-user
# worker    
Host k8s-worker-03
    HostName XXX.XXX.X.XXX
    User your-user
```

Do this on each pi.

Edit the host name ex: `k8s-master` for the master and `k8s-worker-01`, `k8s-worker-02`, `k8s-worker-03` for the workers.
```bash
sudo nano /etc/hostname
```

Configure boot options.
> Add `cgroup_enable=cpuset cgroup_enable=memory cgroup_memory=1 swapaccount=1` to the end of the first line.

```bash
sudo nano /boot/firmware/cmdline.txt
```
Install all updates and reboot
```bash
sudo apt update && sudo apt dist-upgrade
sudo reboot
```

Create a user
```bash
sudo adduser your-user
sudo usermod -aG sudo your-user
```

### Install Docker
```bash
curl -sSL get.docker.com | sh
# add your user to the docker group
sudo usermod -aG docker your-user

```
Set Docker daemon options
```bash
# file will most likely not exist so create it
sudo nano /etc/docker/daemon.json
```
Add the following snippet.
```bash
# /etc/docker/daemon.json
 {
   "exec-opts": ["native.cgroupdriver=systemd"],
   "log-driver": "json-file",
   "log-opts": {
     "max-size": "100m"
   },
   "storage-driver": "overlay2"
 }
```

Enable Routing
> Find the line `#net.ipv4.ip_forward=1` and uncomment it.
```bash
sudo nano /etc/sysctl.conf
# reboot
sudo reboot
```

Check that the Docker service is running and run hello-world
```bash
sudo systemctl status docker
# run hello-world
docker run hello-world
```

### Install Kubernetes

Add the Kubernetes Repo
```bash 
sudo nano /etc/apt/sources.list.d/kubernetes.list
deb http://apt.kubernetes.io/ kubernetes-xenial main
```
Add the GPG Key
```bash
curl -s https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo apt-key add -
```

Install required Kubernetes packages
```bash
sudo apt update
sudo apt install kubeadm kubectl kubelet
```

Initialize Kubernetes
> Run this command on the Master only. This will return some commands as well as the node join command, save this for later.
```bash
sudo kubeadm init --pod-network-cidr=10.244.0.0/16
```

Set up config directory
> If the commands returned above are different from the ones below run those instead as they may have changed.
```bash
mkdir -p ~.kube
sudo cp /etc/kubernetes/admin.conf ~/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config
```

Install the flannel network driver
```bash
kubectl apply -f https://raw.githubusercontent.com/coreos/flannel/master/Documentation/kube-flannel.yml
```

Check pod status
```bash
kubectl get pods --all-namespaces
```

Add the worker nodes to the cluster
```bash
# run the join command on each worker pi
# example command below, use the one you saved from the above steps
kubeadm join --discovery-token abcdef.1234567890abcdef --discovery-token-ca-cert-hash sha256:1234..cdef 1.2.3.4:6443
```

Check node status
```bash
kubectl get nodes
# more info
kubectl get pods -o wide
```

Next step is to run a service.

## Deployment
> Creates a Simple NodeJS Server that displays an image. Deployment with 3 replicas.
```bash
kubectl apply -f rpi-test-node-deploy.yaml

# Wait for the pods to be created, you can check the status with
kubectl get pods --all-namespaces

# Expose the pods, so they are accessible from outside the cluster via NodePort.

# In --type attribute, we can also provide ClusterIP, ExternalName, and LoadBalancer. In case of ClusterIP, the application will be exposed on a port that will not be accessible from outside the cluster. Services of type ExternalName, map a Service to a DNS name. In the case of LoadBalancer, it exposes the Service externally using a cloud provider’s load balancer. NodePort and ClusterIP Services, to which the external load balancer routes, are automatically created.
kubectl expose deployment rpi-test-node-deploy --type NodePort --port 3000

# Get the NodPort, it will look something like 3000:xxxx, xxxx will be your port
kubectl get service

# Get the node's external ip
kubectl get node -0 wide
```


## Kubernetes Dashboard

### Install
```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/dashboard/v2.4.0/aio/deploy/recommended.yaml
```
### Creating a sample user
In this guide, we will find out how to create a new user using the Service Account mechanism of Kubernetes, grant this user admin permissions and login to Dashboard using a bearer token tied to this user.

IMPORTANT: Make sure that you know what you are doing before proceeding. Granting admin privileges to Dashboard's Service Account might be a security risk.

#### Creating a Service Account
> We are creating Service Account with the name `admin-user` in namespace `kubernetes-dashboard` first.

`dashboard-adminuser.yaml`

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: admin-user
  namespace: kubernetes-dashboard
```
```bash
kubectl apply -f dashboard-adminuser.yaml
```

#### Creating a ClustorRoleBinding
> In most cases after provisioning the cluster using `kops`, `kubeadm` or any other popular tool, the `ClusterRole` `cluster-admin` already exists in the cluster. We can use it and create only a `ClusterRoleBinding` for our `ServiceAccount`. If it does not exist then you need to create this role first and grant required privileges manually.

`cluster-role-binding.yaml`

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: admin-user
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: cluster-admin
subjects:
- kind: ServiceAccount
  name: admin-user
  namespace: kubernetes-dashboard
```
```bash
kubectl apply -f cluster-role-binding.yaml
```

#### Getting a Bearer Token
> Now we need to find the token we can use to log in. Execute the following command:
```bash
kubectl -n kubernetes-dashboard get secret $(kubectl -n kubernetes-dashboard get sa/admin-user -o jsonpath="{.secrets[0].name}") -o go-template="{{.data.token | base64decode}}"
```

#### Access Kubernetes Dashboard from outside cluster
> SCP config file from master /etc/kubernetes/admin.conf
```bash
kubectl proxy --kubeconfig=admin.conf
```

#### Clean up
> Remove the admin `ServiceAccount` and `ClusterRoleBinding`.
```bash
kubectl -n kubernetes-dashboard delete serviceaccount admin-user
kubectl -n kubernetes-dashboard delete clusterrolebinding admin-user
```

### Kubernetes Metrics Server
Download file
```bash
wget https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml -O metrics-server-components.yaml
```

Kubelet certificate needs to be signed by cluster Certificate Authority (or disable certificate validation by passing --kubelet-insecure-tls to Metrics Server)

Modify the file (Do not do this in production)
> Add --kublet-insecure-tls to container args
```bash

nano metrics-server-components.yml
```


### kubectl commands

Get deployments across all namespaces
```bash
kubectl get deploy -A
```

Delete deployment
```bash
kubectl delete deploy deploymentname -n namespacename
```

## Resources
- [Setting up a Raspberry Pi Kubernetes Cluster with Ubuntu 20.04](https://www.learnlinux.tv/setting-up-a-raspberry-pi-kubernetes-cluster-with-ubuntu-20-04/)
- [Kubernetes Dashboard](https://github.com/kubernetes/dashboard)
- [Access Control](https://github.com/kubernetes/dashboard/tree/master/docs/user/access-control)
- [Creating a Sample User](https://github.com/kubernetes/dashboard/blob/master/docs/user/access-control/creating-sample-user.md)
- [Metrics Server](https://github.com/kubernetes-sigs/metrics-server)
- [Kubectl Cheatsheet](https://kubernetes.io/docs/reference/kubectl/cheatsheet/)

+++
author = "lf"
categories = ["PowerShell", "Active Directory", "dhcp", "dns"]
date = 2015-11-14T22:20:48Z
description = ""
draft = false
path = "/blog/setting-up-dhcp-on-a-dc"
tags = ["PowerShell", "Active Directory", "dhcp", "dns"]
title = "Setting up DHCP on a DC with secure dynamic DNS"

+++

So, in my virtual homelabbing, I decided I was going to get a Windows based network set up with more or less only PowerShell. In these efforts, I discovered a pretty poor pile of documentation (such as [this insanity](https://technet.microsoft.com/en-us/library/cc774834%28v=ws.10%29.aspx?f=255&MSPPError=-2147217396) where they tell you to create credentials with netsh, restart the service, then delete the credentials and restart again [optional step: wonder why it doesn't work]).

####Here's how I set it up:
#####Create AD account:
```powershell
# Get username and password for the new account (remember to include your domain!)
$cred = Get-Credential

# Create the user (it needs no special permissions)
New-ADUser -Enabled $true -SamAccountName $cred.UserName -AccountPassword $cred.Password
```
#####Make the DHCP server use it:
```powershell
# Set the credentials for the DHCP server
Set-DhcpServerDnsCredential $cred

# Restart the DHCP Server
Restart-Service DhcpServer
```

You're set!

###Bonus:

Also remember to set the DNS server to only allow secure updates!

```powershell
Set-DnsServerPrimaryZone -DynamicUpdate Secure
```


#!/bin/bash

PATH=$PATH:/usr/bin:/bin:/usr/local/bin:/usr/sbin:/sbin:/usr/local/sbin
export PATH

HOME=/root
export HOME

# Nightly backup of entire DB to S3
/usr/bin/aws s3 sync /data/storage/ s3://mendo.org/data/ --quiet

# Log archives too
/usr/bin/aws s3 sync /data/logs/archives/ s3://mendo.org/logs/ --quiet

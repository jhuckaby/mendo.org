#!/bin/bash

PATH=$PATH:/usr/bin:/bin:/usr/local/bin:/usr/sbin:/sbin:/usr/local/sbin
export PATH

HOME=/root
export HOME

# Nightly backup of entire DB to S3
# /usr/bin/aws s3 sync /data/storage/ s3://mendo.org/data/ --quiet

# Log archives too
# /usr/bin/aws s3 sync /data/logs/archives/ s3://mendo.org/logs/ --quiet
find /data/logs/archives/ -type f -name '*.gz' -mtime +30 -delete >/dev/null 2>&1

# Delete mail temp files after 7 days
find /data/mail/ -type f -name '*.json' -mtime +1 -delete >/dev/null 2>&1

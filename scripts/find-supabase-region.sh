#!/bin/bash

PROJECT_REF="gzhxgoigflftharcmdqj"
PASSWORD="#!January#2026!"
PASSWORD2="%23!January%232026!"

REGIONS=(
  "aws-0-us-east-1"
  "aws-0-us-east-2"
  "aws-0-us-west-1"
  "aws-0-us-west-2"
  "aws-0-eu-central-1"
  "aws-0-eu-west-1"
  "aws-0-eu-west-2"
  "aws-0-eu-west-3"
  "aws-0-eu-north-1"
  "aws-0-ap-southeast-1"
  "aws-0-ap-southeast-2"
  "aws-0-ap-northeast-1"
  "aws-0-ap-northeast-2"
  "aws-0-ap-south-1"
  "aws-0-sa-east-1"
  "aws-0-ca-central-1"
)

echo "Testing regions for project: $PROJECT_REF"

for region in "${REGIONS[@]}"; do
  host="$region.pooler.supabase.com"
  
  # Try Port 6543 (Transaction)
  echo "Checking $host:6543..."
  output=$(PGPASSWORD="$PASSWORD" psql "postgres://postgres.$PROJECT_REF@$host:6543/postgres?sslmode=require" -c "\l" 2>&1)
  
  if echo "$output" | grep -q "password authentication failed"; then
    echo "✅ FOUND REGION (Tx): $region (Password 123456 incorrect)"
  elif echo "$output" | grep -q "Tenant or user not found"; then
    # Try password 2 just in case
    output2=$(PGPASSWORD="$PASSWORD2" psql "postgres://postgres.$PROJECT_REF@$host:6543/postgres?sslmode=require" -c "\l" 2>&1)
     if echo "$output2" | grep -q "password authentication failed"; then
        echo "✅ FOUND REGION (Tx): $region (Password 2 incorrect)"
     elif echo "$output2" | grep -q "Tenant or user not found"; then
        echo "❌ Tenant not found (Tx)"
     elif [ $? -eq 0 ]; then
        echo "🎉 SUCCESS (Tx)! Connected to $region with Password 2"
        exit 0
     fi
  elif [ $? -eq 0 ]; then
    echo "🎉 SUCCESS (Tx)! Connected to $region with Password 123456"
    exit 0
  else 
    echo "⚠️  Error (Tx): $(echo "$output" | head -n 1)"
  fi

  # Try Port 5432 (Session)
  echo "Checking $host:5432..."
  output=$(PGPASSWORD="$PASSWORD" psql "postgres://postgres.$PROJECT_REF@$host:5432/postgres?sslmode=require" -c "\l" 2>&1)
  
  if echo "$output" | grep -q "password authentication failed"; then
    echo "✅ FOUND REGION (Session): $region"
  elif echo "$output" | grep -q "Tenant or user not found"; then
    echo "❌ Tenant not found (Session)"
  elif [ $? -eq 0 ]; then
    echo "🎉 SUCCESS (Session)! Connected to $region"
    exit 0
  else
    echo "⚠️  Error (Session): $(echo "$output" | head -n 1)"
  fi
done

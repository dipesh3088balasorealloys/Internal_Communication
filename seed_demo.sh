#!/bin/bash
API="http://localhost:3000/api"

echo "=== Creating Demo Users ==="

# Register demo users
curl -s -X POST "$API/auth/register" -H "Content-Type: application/json" -d '{
  "username": "sarah.ahmed",
  "email": "sarah.ahmed@company.com",
  "password": "Demo1234",
  "display_name": "Sarah Ahmed",
  "department": "Engineering",
  "title": "Senior Developer"
}' | head -c 60
echo ""

curl -s -X POST "$API/auth/register" -H "Content-Type: application/json" -d '{
  "username": "john.smith",
  "email": "john.smith@company.com",
  "password": "Demo1234",
  "display_name": "John Smith",
  "department": "Product Management",
  "title": "Product Manager"
}' | head -c 60
echo ""

curl -s -X POST "$API/auth/register" -H "Content-Type: application/json" -d '{
  "username": "maria.garcia",
  "email": "maria.garcia@company.com",
  "password": "Demo1234",
  "display_name": "Maria Garcia",
  "department": "Design",
  "title": "UI/UX Designer"
}' | head -c 60
echo ""

curl -s -X POST "$API/auth/register" -H "Content-Type: application/json" -d '{
  "username": "david.chen",
  "email": "david.chen@company.com",
  "password": "Demo1234",
  "display_name": "David Chen",
  "department": "Engineering",
  "title": "Tech Lead"
}' | head -c 60
echo ""

curl -s -X POST "$API/auth/register" -H "Content-Type: application/json" -d '{
  "username": "priya.sharma",
  "email": "priya.sharma@company.com",
  "password": "Demo1234",
  "display_name": "Priya Sharma",
  "department": "HR",
  "title": "HR Manager"
}' | head -c 60
echo ""

curl -s -X POST "$API/auth/register" -H "Content-Type: application/json" -d '{
  "username": "admin",
  "email": "admin@company.com",
  "password": "Admin1234",
  "display_name": "Admin User",
  "department": "IT",
  "title": "System Administrator"
}' | head -c 60
echo ""

echo ""
echo "=== Demo Users Created ==="

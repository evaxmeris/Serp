#!/bin/bash
# Batch migrate all files from @/lib/auth-api to @/lib/auth-unified
# Excluding: main orders, customers, products, quotations, inquiries, users, profile modules
# (these were already migrated in R4/R5)
# NOTE: dashboard/orders, logistics/orders, v1/products etc are SEPARATE modules, NOT excluded

cd /Users/apple/clawd/trade-erp

echo "=== Files still importing from @/lib/auth-api (excluding already migrated modules) ==="

# Find all files importing from auth-api
FILES=$(grep -rl "from '@/lib/auth-api'" src/ \
  | grep -v "lib/auth-unified.ts" \
  || true)

# Apply path-based exclusions for already-migrated modules
# We exclude exact module paths, not substring matches
EXCLUDED=""
INCLUDED=""
for file in $FILES; do
  # Normalize: remove src/ prefix
  rel="${file#src/}"
  
  # Check if this file belongs to an already-migrated module
  # These are the main API routes: /api/orders/, /api/customers/, etc.
  # We check if the path starts with api/<module>/ (but NOT api/v1/*/ or api/dashboard/*/)
  case "$rel" in
    api/orders/*)           EXCLUDED+="  [SKIP] $file (orders module)\n" ;;
    api/customers/*)        EXCLUDED+="  [SKIP] $file (customers module)\n" ;;
    api/products/*)         EXCLUDED+="  [SKIP] $file (products module)\n" ;;
    api/quotations/*)       EXCLUDED+="  [SKIP] $file (quotations module)\n" ;;
    api/inquiries/*)        EXCLUDED+="  [SKIP] $file (inquiries module)\n" ;;
    api/users/*)            EXCLUDED+="  [SKIP] $file (users module)\n" ;;
    api/profile/*)          EXCLUDED+="  [SKIP] $file (profile module)\n" ;;
    *)
      INCLUDED+="$file\n"
      ;;
  esac
done

echo ""
echo "--- Excluded files (already migrated modules) ---"
printf "$EXCLUDED"
echo ""
echo "--- Files to migrate ---"
printf "$INCLUDED" | sort
echo ""

# Count
INCLUDED_COUNT=$(printf "$INCLUDED" | grep -c . || true)
echo "Total files to migrate: $INCLUDED_COUNT"

# Perform migration
if [ "$INCLUDED_COUNT" -gt 0 ]; then
  echo ""
  echo "=== Migrating... ==="
  printf "$INCLUDED" | while IFS= read -r file; do
    [ -z "$file" ] && continue
    echo "  Patching: $file"
    sed -i '' "s|from '@/lib/auth-api'|from '@/lib/auth-unified'|g" "$file"
  done
  echo ""
  echo "=== Migration complete ==="
else
  echo "No files to migrate."
fi

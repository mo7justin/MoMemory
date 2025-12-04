#!/bin/sh
set -e

# Define placeholders that were used during the Next.js build
# These should match the ARGs defined in the Dockerfile
NEXT_PUBLIC_API_URL_PLACEHOLDER="__NEXT_PUBLIC_API_URL_PLACEHOLDER__"
NEXT_PUBLIC_USER_ID_PLACEHOLDER="__NEXT_PUBLIC_USER_ID_PLACEHOLDER__"

# Ensure the working directory is correct
cd /app

echo "Replacing NEXT_PUBLIC_API_URL placeholder with actual value..."
# Check if NEXT_PUBLIC_API_URL is provided at runtime
if [ -z "$NEXT_PUBLIC_API_URL" ]; then
  echo "Warning: NEXT_PUBLIC_API_URL is not set. Using default or empty string."
  RUNTIME_API_URL="" # Or a default value if you have one
else
  RUNTIME_API_URL="$NEXT_PUBLIC_API_URL"
fi

# Use sed to replace the placeholder in all relevant files
# Note: Next.js bundles are minified, so the placeholder might appear multiple times or be split.
# A simple string replace should work for most cases.
# Also, ensure your sed command handles potential special characters in the URL
# We use a different delimiter for sed to avoid issues with slashes in URLs
find .next/ -type f -name "*.js" -exec sed -i "s|${NEXT_PUBLIC_API_URL_PLACEHOLDER}|${RUNTIME_API_URL}|g" {} \;
echo "Replaced NEXT_PUBLIC_API_URL_PLACEHOLDER with $RUNTIME_API_URL"


echo "Replacing NEXT_PUBLIC_USER_ID placeholder with actual value..."
# Check if NEXT_PUBLIC_USER_ID is provided at runtime
if [ -z "$NEXT_PUBLIC_USER_ID" ]; then
  echo "Warning: NEXT_PUBLIC_USER_ID is not set. Using default 'user'."
  RUNTIME_USER_ID="user" # Default value from profileSlice.ts
else
  RUNTIME_USER_ID="$NEXT_PUBLIC_USER_ID"
fi

# Use sed to replace the placeholder
find .next/ -type f -name "*.js" -exec sed -i "s|__NEXT_PUBLIC_USER_ID_PLACEHOLDER__|${RUNTIME_USER_ID}|g" {} \;
echo "Replaced NEXT_PUBLIC_USER_ID_PLACEHOLDER with $RUNTIME_USER_ID"


# Execute the container's main process (CMD in Dockerfile)
exec "$@"

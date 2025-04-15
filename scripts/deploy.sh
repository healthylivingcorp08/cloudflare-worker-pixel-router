#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if there are changes to commit
if [[ -n $(git status -s) ]]; then
    echo -e "${GREEN}Changes detected. Committing...${NC}"
    
    # Add all changes
    git add .
    
    # Get commit message from argument or use default
    COMMIT_MSG=${1:-"Update pixel router configuration"}
    
    # Commit changes
    git commit -m "$COMMIT_MSG"
    
    # Push to main branch
    echo -e "${GREEN}Pushing to main branch...${NC}"
    git push origin main
    
    echo -e "${GREEN}Deployment triggered! Check GitHub Actions for status.${NC}"
else
    echo -e "${RED}No changes detected.${NC}"
fi